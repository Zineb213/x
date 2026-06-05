#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}              FORMATEUR FULL ACTIVITY SCRIPT                       ${NC}"
echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"

# =============================================
# STEP 1: Login as Formateur
# =============================================
echo -e "\n${YELLOW}📌 STEP 1: Login as Formateur${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"matricule":"2026163513","password":"Formateur123!"}')

FORMATEUR_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$FORMATEUR_TOKEN" ]; then
    echo -e "${RED}❌ Login failed!${NC}"
    echo "$LOGIN_RESPONSE" | jq '.'
    exit 1
fi

echo -e "${GREEN}✅ Login successful!${NC}"
echo -e "${CYAN}Token: ${FORMATEUR_TOKEN:0:80}...${NC}"

# =============================================
# STEP 2: Get Formateur Info
# =============================================
echo -e "\n${YELLOW}📌 STEP 2: Get Formateur Information${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

ME_RESPONSE=$(curl -s -X GET http://localhost:5001/api/auth/me \
  -H "Authorization: Bearer $FORMATEUR_TOKEN")

FORMATEUR_ID=$(echo "$ME_RESPONSE" | jq -r '.data.id')
FORMATEUR_EMAIL=$(echo "$ME_RESPONSE" | jq -r '.data.email')
FORMATEUR_NOM=$(echo "$ME_RESPONSE" | jq -r '.data.nom')
FORMATEUR_PRENOM=$(echo "$ME_RESPONSE" | jq -r '.data.prenom')
FORMATEUR_MATRICULE=$(echo "$ME_RESPONSE" | jq -r '.data.matricule')

echo -e "${GREEN}✅ Formateur Info:${NC}"
echo -e "${CYAN}   ID: $FORMATEUR_ID${NC}"
echo -e "${CYAN}   Matricule: $FORMATEUR_MATRICULE${NC}"
echo -e "${CYAN}   Email: $FORMATEUR_EMAIL${NC}"
echo -e "${CYAN}   Nom: $FORMATEUR_NOM $FORMATEUR_PRENOM${NC}"

# =============================================
# STEP 3: Get Assigned Modules
# =============================================
echo -e "\n${YELLOW}📌 STEP 3: Get Assigned Modules${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

MODULES_RESPONSE=$(curl -s -X GET http://localhost:5001/api/formateur/modules \
  -H "Authorization: Bearer $FORMATEUR_TOKEN")

MODULE_COUNT=$(echo "$MODULES_RESPONSE" | jq '.data | length')

if [ "$MODULE_COUNT" -eq 0 ]; then
    echo -e "${RED}❌ No modules assigned to this formateur!${NC}"
    echo -e "${YELLOW}   Admin needs to assign modules first.${NC}"
    
    # Try to assign a module using admin
    echo -e "\n${CYAN}Attempting to assign a module as admin...${NC}"
    
    # Login as admin
    ADMIN_TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"matricule":"ADMIN001","password":"Admin123!"}' \
      | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$ADMIN_TOKEN" ]; then
        # Assign module 1 to formateur
        ASSIGN_RESPONSE=$(curl -s -X POST http://localhost:5001/api/admin/assignments \
          -H "Authorization: Bearer $ADMIN_TOKEN" \
          -H "Content-Type: application/json" \
          -d "{\"formateurId\":$FORMATEUR_ID,\"moduleId\":1}")
        
        if echo "$ASSIGN_RESPONSE" | grep -q '"success":true'; then
            echo -e "${GREEN}✅ Module assigned!${NC}"
            # Get modules again
            MODULES_RESPONSE=$(curl -s -X GET http://localhost:5001/api/formateur/modules \
              -H "Authorization: Bearer $FORMATEUR_TOKEN")
            MODULE_COUNT=$(echo "$MODULES_RESPONSE" | jq '.data | length')
        else
            echo -e "${RED}❌ Assignment failed${NC}"
        fi
    fi
fi

if [ "$MODULE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $MODULE_COUNT assigned modules:${NC}"
    echo "$MODULES_RESPONSE" | jq -r '.data[] | "   📚 Module \(.id): \(.code) - \(.nom) (Niveau: \(.niveau))"'
    
    # Store first module ID for later use
    FIRST_MODULE_ID=$(echo "$MODULES_RESPONSE" | jq -r '.data[0].id')
    FIRST_MODULE_CODE=$(echo "$MODULES_RESPONSE" | jq -r '.data[0].code')
    echo -e "${CYAN}   Using Module ID: $FIRST_MODULE_ID ($FIRST_MODULE_CODE) for uploads${NC}"
fi

# =============================================
# STEP 4: Upload Multiple Resources (Cours, TD, TP, Examen)
# =============================================
if [ "$MODULE_COUNT" -gt 0 ]; then
    echo -e "\n${YELLOW}📌 STEP 4: Upload Resources${NC}"
    echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
    
    # Create test files
    echo "%PDF-1.4 Cours - Introduction" > /tmp/cours.pdf
    echo "%PDF-1.4 TD - Exercises" > /tmp/td.pdf
    echo "%PDF-1.4 TP - Practical Work" > /tmp/tp.pdf
    echo "%PDF-1.4 Examen - Final Exam" > /tmp/examen.pdf
    
    # Resources to upload
    declare -a RESOURCES=(
        "Cours|Introduction au Module|Cours|/tmp/cours.pdf"
        "TD|Exercices pratiques|TD|/tmp/td.pdf"
        "TP|Travaux pratiques|TP|/tmp/tp.pdf"
        "Examen|Examen final|Examen|/tmp/examen.pdf"
    )
    
    UPLOADED_IDS=()
    
    for resource in "${RESOURCES[@]}"; do
        IFS='|' read -r TITRE DESCRIPTION CATEGORY FILEPATH <<< "$resource"
        
        echo -e "\n${CYAN}Uploading $CATEGORY: $TITRE${NC}"
        
        UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:5001/api/formateur/resources \
          -H "Authorization: Bearer $FORMATEUR_TOKEN" \
          -F "file=@$FILEPATH" \
          -F "module_id=$FIRST_MODULE_ID" \
          -F "titre=$TITRE" \
          -F "description=$DESCRIPTION" \
          -F "category=$CATEGORY")
        
        if echo "$UPLOAD_RESPONSE" | grep -q '"success":true'; then
            RESOURCE_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
            echo -e "${GREEN}   ✅ Uploaded! Resource ID: $RESOURCE_ID${NC}"
            UPLOADED_IDS+=($RESOURCE_ID)
        else
            echo -e "${RED}   ❌ Upload failed for $CATEGORY${NC}"
        fi
    done
    
    # Clean up temp files
    rm -f /tmp/cours.pdf /tmp/td.pdf /tmp/tp.pdf /tmp/examen.pdf
    
    echo -e "\n${GREEN}✅ Total resources uploaded: ${#UPLOADED_IDS[@]}${NC}"
fi

# =============================================
# STEP 5: Get All My Resources
# =============================================
echo -e "\n${YELLOW}📌 STEP 5: Get My Resources${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

RESOURCES_RESPONSE=$(curl -s -X GET http://localhost:5001/api/formateur/resources \
  -H "Authorization: Bearer $FORMATEUR_TOKEN")

RESOURCE_COUNT=$(echo "$RESOURCES_RESPONSE" | jq '.data | length')
echo -e "${GREEN}✅ Total resources in your library: $RESOURCE_COUNT${NC}"

if [ "$RESOURCE_COUNT" -gt 0 ]; then
    echo -e "\n${CYAN}Your Resources:${NC}"
    echo "$RESOURCES_RESPONSE" | jq -r '.data[] | "   📄 ID: \(.id) | \(.titre) | Catégorie: \(.category) | Téléchargements: \(.download_count)"'
fi

# =============================================
# STEP 6: Download a Resource (Test)
# =============================================
if [ "$RESOURCE_COUNT" -gt 0 ]; then
    echo -e "\n${YELLOW}📌 STEP 6: Test Resource Download${NC}"
    echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
    
    FIRST_RESOURCE_ID=$(echo "$RESOURCES_RESPONSE" | jq -r '.data[0].id')
    echo -e "${CYAN}Downloading resource ID: $FIRST_RESOURCE_ID${NC}"
    
    curl -s -X GET "http://localhost:5001/api/resources/$FIRST_RESOURCE_ID/download" \
      -H "Authorization: Bearer $FORMATEUR_TOKEN" \
      --output /tmp/downloaded_resource.pdf
    
    if [ -f /tmp/downloaded_resource.pdf ]; then
        echo -e "${GREEN}✅ Resource downloaded successfully!${NC}"
        rm -f /tmp/downloaded_resource.pdf
    else
        echo -e "${RED}❌ Download failed${NC}"
    fi
fi

# =============================================
# STEP 7: Delete a Resource (Test)
# =============================================
if [ ${#UPLOADED_IDS[@]} -gt 0 ]; then
    echo -e "\n${YELLOW}📌 STEP 7: Delete a Resource${NC}"
    echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
    
    RESOURCE_TO_DELETE=${UPLOADED_IDS[0]}
    echo -e "${CYAN}Deleting resource ID: $RESOURCE_TO_DELETE${NC}"
    
    DELETE_RESPONSE=$(curl -s -X DELETE "http://localhost:5001/api/formateur/resources/$RESOURCE_TO_DELETE" \
      -H "Authorization: Bearer $FORMATEUR_TOKEN")
    
    if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Resource deleted successfully!${NC}"
    else
        echo -e "${RED}❌ Delete failed${NC}"
    fi
    
    # Verify resource was deleted
    RESOURCES_RESPONSE=$(curl -s -X GET http://localhost:5001/api/formateur/resources \
      -H "Authorization: Bearer $FORMATEUR_TOKEN")
    
    NEW_RESOURCE_COUNT=$(echo "$RESOURCES_RESPONSE" | jq '.data | length')
    echo -e "${CYAN}Remaining resources: $NEW_RESOURCE_COUNT (was $RESOURCE_COUNT)${NC}"
fi

# =============================================
# STEP 8: Get Resources by Category (Optional)
# =============================================
echo -e "\n${YELLOW}📌 STEP 8: Resource Categories Summary${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

if [ "$RESOURCE_COUNT" -gt 0 ]; then
    echo "$RESOURCES_RESPONSE" | jq -r '.data | group_by(.category) | map({category: .[0].category, count: length}) | .[] | "   📁 \(.category): \(.count) resources"'
fi

# =============================================
# FINAL SUMMARY
# =============================================
echo -e "\n${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    FORMATEUR ACTIVITY SUMMARY                     ${NC}"
echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo -e ""
echo -e "${CYAN}Formateur:${NC}"
echo -e "  📛 Nom: $FORMATEUR_NOM $FORMATEUR_PRENOM"
echo -e "  📧 Email: $FORMATEUR_EMAIL"
echo -e "  🔑 Matricule: $FORMATEUR_MATRICULE"
echo -e "  🆔 ID: $FORMATEUR_ID"
echo -e ""
echo -e "${CYAN}Activities Performed:${NC}"
echo -e "  ✅ Login with matricule/password"
echo -e "  ✅ Get formateur information"
echo -e "  ✅ Get assigned modules ($MODULE_COUNT modules)"
echo -e "  ✅ Upload multiple resources ($((${#UPLOADED_IDS[@]})) uploaded)"
echo -e "  ✅ Get my resources list"
echo -e "  ✅ Download a resource"
echo -e "  ✅ Delete a resource"
echo -e ""
echo -e "${CYAN}Formateur Token (save for later):${NC}"
echo -e "${YELLOW}$FORMATEUR_TOKEN${NC}"
echo -e ""
echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Formateur Full Activity Test Complete! 🎉${NC}"
echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
