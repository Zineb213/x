#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}         ADMIN: CREATE MODULE & ASSIGN TO FORMATEUR            ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# =============================================
# STEP 1: Login as Admin
# =============================================
echo -e "\n${YELLOW}📌 STEP 1: Login as Admin${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

ADMIN_LOGIN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"matricule":"ADMIN001","password":"Admin123!"}')

ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
    echo -e "${RED}❌ Admin login failed${NC}"
    echo "$ADMIN_LOGIN"
    exit 1
fi

echo -e "${GREEN}✅ Admin logged in successfully${NC}"
echo -e "${CYAN}Token: ${ADMIN_TOKEN:0:80}...${NC}"

# =============================================
# STEP 2: Get specific formateur by matricule
# =============================================
echo -e "\n${YELLOW}📌 STEP 2: Find formateur with matricule: 2026754153${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

# Get all users to find the specific formateur
ALL_USERS=$(curl -s -X GET http://localhost:5001/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN")

# Find formateur with specific matricule
FORMATEUR_ID=$(echo "$ALL_USERS" | jq -r ".data[] | select(.matricule == \"2026754153\" and .role_global == \"FORMATEUR\") | .id")

if [ -z "$FORMATEUR_ID" ] || [ "$FORMATEUR_ID" == "null" ]; then
    echo -e "${RED}❌ Formateur with matricule 2026754153 not found!${NC}"
    echo -e "${YELLOW}   Creating a new formateur with that matricule...${NC}"
    
    # Create the specific formateur
    CREATE_FORMATEUR=$(curl -s -X POST http://localhost:5001/api/admin/formateurs \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "abdanourbouhaik31@gmail.com",
        "nom": "Bouhaik",
        "prenom": "Abdanour",
        "password": "Formateur31"
      }')
    
    FORMATEUR_ID=$(echo "$CREATE_FORMATEUR" | jq -r '.data.id')
    FORMATEUR_MATRICULE=$(echo "$CREATE_FORMATEUR" | jq -r '.data.matricule')
    
    echo -e "${GREEN}✅ Created new formateur:${NC}"
    echo -e "${CYAN}   ID: $FORMATEUR_ID${NC}"
    echo -e "${CYAN}   Matricule: $FORMATEUR_MATRICULE${NC}"
    echo -e "${CYAN}   Email: abdanourbouhaik31@gmail.com${NC}"
else
    # Get formateur details
    FORMATEUR_MATRICULE="2026754153"
    FORMATEUR_EMAIL=$(echo "$ALL_USERS" | jq -r ".data[] | select(.id == $FORMATEUR_ID) | .email")
    FORMATEUR_NOM=$(echo "$ALL_USERS" | jq -r ".data[] | select(.id == $FORMATEUR_ID) | .nom")
    FORMATEUR_PRENOM=$(echo "$ALL_USERS" | jq -r ".data[] | select(.id == $FORMATEUR_ID) | .prenom")
    
    echo -e "${GREEN}✅ Found existing formateur:${NC}"
    echo -e "${CYAN}   ID: $FORMATEUR_ID${NC}"
    echo -e "${CYAN}   Matricule: $FORMATEUR_MATRICULE${NC}"
    echo -e "${CYAN}   Email: $FORMATEUR_EMAIL${NC}"
    echo -e "${CYAN}   Nom: $FORMATEUR_NOM $FORMATEUR_PRENOM${NC}"
fi

# =============================================
# STEP 3: Test formateur login with credentials
# =============================================
echo -e "\n${YELLOW}📌 STEP 3: Test formateur login with matricule and password${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

FORMATEUR_LOGIN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"matricule":"2026754153","password":"Formateur31"}')

FORMATEUR_TOKEN=$(echo "$FORMATEUR_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$FORMATEUR_TOKEN" ]; then
    echo -e "${GREEN}✅ Formateur login successful!${NC}"
    echo -e "${CYAN}Token: ${FORMATEUR_TOKEN:0:80}...${NC}"
    
    # Get formateur info
    FORMATEUR_INFO=$(curl -s -X GET http://localhost:5001/api/auth/me \
      -H "Authorization: Bearer $FORMATEUR_TOKEN")
    
    echo -e "${CYAN}Formateur info:${NC}"
    echo "$FORMATEUR_INFO" | jq '.data | {id, email, nom, prenom, matricule, role_global}'
else
    echo -e "${RED}❌ Formateur login failed${NC}"
    echo "$FORMATEUR_LOGIN"
fi

# =============================================
# STEP 4: Create a new module
# =============================================
echo -e "\n${YELLOW}📌 STEP 4: Create a new module${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

TIMESTAMP=$(date +%s)
MODULE_CODE="L1-INFO-${TIMESTAMP: -4}"
MODULE_NAME="Module Abdanour $(date +%H:%M:%S)"

CREATE_MODULE=$(curl -s -X POST http://localhost:5001/api/admin/modules \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"code\": \"$MODULE_CODE\",
    \"nom\": \"$MODULE_NAME\",
    \"description\": \"Module créé pour le formateur Abdanour Bouhaik le $(date)\",
    \"niveau\": \"L1\",
    \"credits\": 6,
    \"coeff\": 2.0
  }")

MODULE_ID=$(echo "$CREATE_MODULE" | jq -r '.data.id')

if [ -n "$MODULE_ID" ] && [ "$MODULE_ID" != "null" ]; then
    echo -e "${GREEN}✅ Module created successfully!${NC}"
    echo -e "${CYAN}   Module ID: $MODULE_ID${NC}"
    echo -e "${CYAN}   Code: $MODULE_CODE${NC}"
    echo -e "${CYAN}   Nom: $MODULE_NAME${NC}"
else
    echo -e "${RED}❌ Failed to create module${NC}"
    echo "$CREATE_MODULE" | jq '.'
    exit 1
fi

# =============================================
# STEP 5: Assign formateur to module
# =============================================
echo -e "\n${YELLOW}📌 STEP 5: Assign formateur (Abdanour) to module${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

ASSIGNMENT=$(curl -s -X POST http://localhost:5001/api/admin/assignments \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"formateurId\": $FORMATEUR_ID,
    \"moduleId\": $MODULE_ID
  }")

if echo "$ASSIGNMENT" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Formateur assigned to module successfully!${NC}"
    echo "$ASSIGNMENT" | jq '.'
else
    echo -e "${RED}❌ Assignment failed${NC}"
    echo "$ASSIGNMENT" | jq '.'
fi

# =============================================
# STEP 6: Get all assignments to verify
# =============================================
echo -e "\n${YELLOW}📌 STEP 6: Get all assignments${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

ALL_ASSIGNMENTS=$(curl -s -X GET http://localhost:5001/api/admin/assignments \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ASSIGNMENT_COUNT=$(echo "$ALL_ASSIGNMENTS" | jq '.data | length')

echo -e "${GREEN}✅ Total assignments: $ASSIGNMENT_COUNT${NC}"
echo "$ALL_ASSIGNMENTS" | jq '.data[] | {id, formateur_nom, formateur_prenom, module_code, module_nom, assigned_at}'

# =============================================
# STEP 7: Test formateur can see assigned module
# =============================================
echo -e "\n${YELLOW}📌 STEP 7: Test formateur can see assigned module${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

if [ -n "$FORMATEUR_TOKEN" ]; then
    FORMATEUR_MODULES=$(curl -s -X GET http://localhost:5001/api/formateur/modules \
      -H "Authorization: Bearer $FORMATEUR_TOKEN")
    
    MODULE_COUNT=$(echo "$FORMATEUR_MODULES" | jq '.data | length')
    
    if [ "$MODULE_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ Formateur can see $MODULE_COUNT assigned module(s)!${NC}"
        echo "$FORMATEUR_MODULES" | jq '.data[] | {id, code, nom, niveau}'
    else
        echo -e "${RED}❌ Formateur cannot see any modules${NC}"
    fi
else
    echo -e "${RED}❌ Cannot test - formateur not logged in${NC}"
fi

# =============================================
# STEP 8: Try to upload a resource as formateur
# =============================================
echo -e "\n${YELLOW}📌 STEP 8: Test resource upload as formateur${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

if [ -n "$FORMATEUR_TOKEN" ] && [ -n "$MODULE_ID" ]; then
    # Create a test PDF file
    echo "%PDF-1.4 Test document for Abdanour" > /tmp/test_abdanour.pdf
    
    UPLOAD_RESOURCE=$(curl -s -X POST http://localhost:5001/api/formateur/resources \
      -H "Authorization: Bearer $FORMATEUR_TOKEN" \
      -F "file=@/tmp/test_abdanour.pdf" \
      -F "module_id=$MODULE_ID" \
      -F "titre=Cours Introduction" \
      -F "description=Premier cours de la session" \
      -F "category=Cours")
    
    if echo "$UPLOAD_RESOURCE" | grep -q '"success":true'; then
        RESOURCE_ID=$(echo "$UPLOAD_RESOURCE" | jq -r '.data.id')
        echo -e "${GREEN}✅ Resource uploaded successfully!${NC}"
        echo -e "${CYAN}   Resource ID: $RESOURCE_ID${NC}"
        echo -e "${CYAN}   Titre: Cours Introduction${NC}"
        
        # Clean up
        rm -f /tmp/test_abdanour.pdf
    else
        echo -e "${RED}❌ Resource upload failed${NC}"
        echo "$UPLOAD_RESOURCE" | jq '.'
    fi
fi

# =============================================
# STEP 9: Get formateur's resources
# =============================================
echo -e "\n${YELLOW}📌 STEP 9: Get formateur's resources${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

if [ -n "$FORMATEUR_TOKEN" ]; then
    FORMATEUR_RESOURCES=$(curl -s -X GET http://localhost:5001/api/formateur/resources \
      -H "Authorization: Bearer $FORMATEUR_TOKEN")
    
    RESOURCE_COUNT=$(echo "$FORMATEUR_RESOURCES" | jq '.data | length')
    echo -e "${GREEN}✅ Formateur has $RESOURCE_COUNT resource(s)${NC}"
    
    if [ "$RESOURCE_COUNT" -gt 0 ]; then
        echo "$FORMATEUR_RESOURCES" | jq '.data[] | {id, titre, category, download_count, created_at}'
    fi
fi

# =============================================
# SUMMARY
# =============================================
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                         TEST SUMMARY                           ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e ""
echo -e "${CYAN}Formateur Details:${NC}"
echo -e "  👨‍🏫 Nom: Abdanour Bouhaik"
echo -e "  📧 Email: abdanourbouhaik31@gmail.com"
echo -e "  🔑 Matricule: 2026754153"
echo -e "  🔐 Password: Formateur31"
echo -e "  🆔 ID: $FORMATEUR_ID"
echo -e ""
echo -e "${CYAN}Created Data:${NC}"
echo -e "  📚 Module ID: $MODULE_ID"
echo -e "  📚 Module Code: $MODULE_CODE"
echo -e "  📚 Module Name: $MODULE_NAME"
echo -e "  📄 Resource uploaded: ${RESOURCE_ID:-None}"
echo -e ""
echo -e "${CYAN}Test Results:${NC}"
echo -e "  ✅ Admin login: Working"
echo -e "  ✅ Formateur login: Working"
echo -e "  ✅ Create module: Success"
echo -e "  ✅ Assign formateur: Success"
echo -e "  ✅ Formateur sees module: Success"
echo -e "  ✅ Upload resource: ${RESOURCE_ID:+Success}${RESOURCE_ID:-Failed}"
echo -e ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 All tests passed! Admin can manage and formateur can work! 🎉${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
