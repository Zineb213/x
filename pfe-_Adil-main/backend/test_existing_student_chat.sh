#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}         TEST EXISTING STUDENT CHAT FLOW                        ${NC}"
echo -e "${CYAN}         Student: abdanourbouhaik@gmail.com                     ${NC}"
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
    exit 1
fi
echo -e "${GREEN}✅ Admin logged in successfully${NC}"

# =============================================
# STEP 2: Check existing student
# =============================================
echo -e "\n${YELLOW}📌 STEP 2: Check existing student${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

STUDENT_EMAIL="abdanourbouhaik@gmail.com"

STUDENT_INFO=$(sudo -u postgres psql -d eduplatform -t -c "SELECT id, matricule, nom, prenom, role_global, niveau, password_hash IS NOT NULL as has_password FROM users WHERE email = '$STUDENT_EMAIL';" 2>/dev/null | tr -d ' ')

if [ -z "$STUDENT_INFO" ]; then
    echo -e "${RED}❌ Student not found in database${NC}"
    exit 1
fi

STUDENT_ID=$(echo "$STUDENT_INFO" | cut -d'|' -f1)
STUDENT_MATRICULE=$(echo "$STUDENT_INFO" | cut -d'|' -f2)
STUDENT_NOM=$(echo "$STUDENT_INFO" | cut -d'|' -f3)
STUDENT_PRENOM=$(echo "$STUDENT_INFO" | cut -d'|' -f4)
STUDENT_ROLE=$(echo "$STUDENT_INFO" | cut -d'|' -f5)
STUDENT_NIVEAU=$(echo "$STUDENT_INFO" | cut -d'|' -f6)
STUDENT_HAS_PASSWORD=$(echo "$STUDENT_INFO" | cut -d'|' -f7)

echo -e "${GREEN}✅ Student found${NC}"
echo -e "${CYAN}   ID: $STUDENT_ID${NC}"
echo -e "${CYAN}   Matricule: ${STUDENT_MATRICULE:-'NULL (Google user)'}${NC}"
echo -e "${CYAN}   Nom: $STUDENT_NOM${NC}"
echo -e "${CYAN}   Prénom: $STUDENT_PRENOM${NC}"
echo -e "${CYAN}   Rôle: $STUDENT_ROLE${NC}"
echo -e "${CYAN}   Niveau: ${STUDENT_NIVEAU:-'Not set'}${NC}"
echo -e "${CYAN}   Has Password: ${STUDENT_HAS_PASSWORD:-'No (Google user)'}${NC}"

# =============================================
# STEP 3: Update student role and niveau if needed
# =============================================
echo -e "\n${YELLOW}📌 STEP 3: Update student role to ETUDIANT and set niveau${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

if [ "$STUDENT_ROLE" != "ETUDIANT" ]; then
    sudo -u postgres psql -d eduplatform -c "UPDATE users SET role_global = 'ETUDIANT' WHERE id = $STUDENT_ID;" 2>/dev/null
    echo -e "${GREEN}✅ Student role updated to ETUDIANT${NC}"
else
    echo -e "${GREEN}✅ Student already has ETUDIANT role${NC}"
fi

if [ -z "$STUDENT_NIVEAU" ] || [ "$STUDENT_NIVEAU" = "null" ]; then
    sudo -u postgres psql -d eduplatform -c "UPDATE users SET niveau = 'L1' WHERE id = $STUDENT_ID;" 2>/dev/null
    echo -e "${GREEN}✅ Student niveau set to L1${NC}"
else
    echo -e "${GREEN}✅ Student already has niveau: $STUDENT_NIVEAU${NC}"
fi

# =============================================
# STEP 4: Enroll student to a module
# =============================================
echo -e "\n${YELLOW}📌 STEP 4: Enroll student to a module${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

MODULE_ID=1  # L1-INFO-101

# Check if already enrolled
ALREADY_ENROLLED=$(sudo -u postgres psql -d eduplatform -t -c "SELECT id FROM etudiant_module_enrollment WHERE etudiant_id = $STUDENT_ID AND module_id = $MODULE_ID;" 2>/dev/null | tr -d ' ')

if [ -z "$ALREADY_ENROLLED" ]; then
    ENROLL_STUDENT=$(curl -s -X POST http://localhost:5001/api/admin/enrollments \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"etudiantId\": $STUDENT_ID,
        \"moduleId\": $MODULE_ID
      }")
    
    if echo "$ENROLL_STUDENT" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Student enrolled to module ID: $MODULE_ID${NC}"
    else
        echo -e "${YELLOW}⚠️ Could not enroll student${NC}"
    fi
else
    echo -e "${GREEN}✅ Student already enrolled in module ID: $MODULE_ID${NC}"
fi

# =============================================
# STEP 5: Ensure formateur exists for the module
# =============================================
echo -e "\n${YELLOW}📌 STEP 5: Ensure formateur exists for module${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

# Check if formateur 2 exists and is FORMATEUR
FORMATEUR_CHECK=$(sudo -u postgres psql -d eduplatform -t -c "SELECT id FROM users WHERE id = 2 AND role_global = 'FORMATEUR';" 2>/dev/null | tr -d ' ')

if [ -z "$FORMATEUR_CHECK" ]; then
    echo -e "${YELLOW}Creating a new formateur...${NC}"
    CREATE_FORMATEUR=$(curl -s -X POST http://localhost:5001/api/admin/formateurs \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "chat.formateur@test.com",
        "nom": "Chat",
        "prenom": "Formateur",
        "password": "Formateur123!"
      }')
    FORMATEUR_ID=$(echo "$CREATE_FORMATEUR" | jq -r '.data.id')
    echo -e "${GREEN}✅ Formateur created with ID: $FORMATEUR_ID${NC}"
    
    # Assign formateur to module
    curl -s -X POST http://localhost:5001/api/admin/assignments \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"formateurId\": $FORMATEUR_ID, \"moduleId\": $MODULE_ID}" > /dev/null
    echo -e "${GREEN}✅ Formateur assigned to module${NC}"
else
    FORMATEUR_ID=2
    echo -e "${GREEN}✅ Using existing formateur ID: $FORMATEUR_ID${NC}"
fi

# =============================================
# STEP 6: Set a password for the student (if Google user)
# =============================================
echo -e "\n${YELLOW}📌 STEP 6: Set password for student (if needed)${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

if [ "$STUDENT_HAS_PASSWORD" = "f" ] || [ -z "$STUDENT_HAS_PASSWORD" ]; then
    echo -e "${YELLOW}Student is a Google user. Setting a password for API login...${NC}"
    
    # First, we need to get a Google token or use admin to set password
    # For testing, we'll use the admin endpoint to reset password
    RESET_PASSWORD=$(curl -s -X POST http://localhost:5001/api/admin/users/reset-password \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"userId\": $STUDENT_ID,
        \"newPassword\": \"StudentPass123!\"
      }")
    
    if echo "$RESET_PASSWORD" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Password set for student${NC}"
        STUDENT_PASSWORD="StudentPass123!"
    else
        echo -e "${RED}❌ Could not set password${NC}"
        exit 1
    fi
else
    STUDENT_PASSWORD="StudentPass123!"
    echo -e "${GREEN}✅ Student already has a password${NC}"
fi

# =============================================
# STEP 7: Login as Student
# =============================================
echo -e "\n${YELLOW}📌 STEP 7: Login as Student${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

STUDENT_LOGIN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"matricule\": \"$STUDENT_EMAIL\",
    \"password\": \"$STUDENT_PASSWORD\"
  }")

STUDENT_TOKEN=$(echo "$STUDENT_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$STUDENT_TOKEN" ]; then
    echo -e "${GREEN}✅ Student logged in successfully${NC}"
else
    echo -e "${RED}❌ Student login failed${NC}"
    echo -e "${YELLOW}Trying with matricule...${NC}"
    
    STUDENT_LOGIN=$(curl -s -X POST http://localhost:5001/api/auth/login \
      -H "Content-Type: application/json" \
      -d "{
        \"matricule\": \"$STUDENT_MATRICULE\",
        \"password\": \"$STUDENT_PASSWORD\"
      }")
    
    STUDENT_TOKEN=$(echo "$STUDENT_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$STUDENT_TOKEN" ]; then
        echo -e "${GREEN}✅ Student logged in successfully with matricule!${NC}"
    else
        echo -e "${RED}❌ Student login still failed${NC}"
        echo "$STUDENT_LOGIN"
        exit 1
    fi
fi

# =============================================
# STEP 8: Get formateur for the module (Student endpoint)
# =============================================
echo -e "\n${YELLOW}📌 STEP 8: Get formateur for module (Student view)${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

GET_FORMATEUR=$(curl -s -X GET "http://localhost:5001/api/etudiant/modules/$MODULE_ID/formateur" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

echo -e "${CYAN}Response:${NC}"
echo "$GET_FORMATEUR" | jq '.'

FORMATEUR_FROM_API=$(echo "$GET_FORMATEUR" | jq -r '.data.id')

if [ -n "$FORMATEUR_FROM_API" ] && [ "$FORMATEUR_FROM_API" != "null" ]; then
    echo -e "${GREEN}✅ Formateur found: ID $FORMATEUR_FROM_API${NC}"
else
    echo -e "${RED}❌ Could not get formateur${NC}"
    echo -e "${YELLOW}Make sure a formateur is assigned to module $MODULE_ID${NC}"
fi

# =============================================
# STEP 9: Create chat with formateur
# =============================================
echo -e "\n${YELLOW}📌 STEP 9: Create chat with formateur${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

CREATE_CHAT=$(curl -s -X POST http://localhost:5001/api/etudiant/chat/formateur \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"formateurId\": $FORMATEUR_ID,
    \"moduleId\": $MODULE_ID
  }")

echo -e "${CYAN}Response:${NC}"
echo "$CREATE_CHAT" | jq '.'

CONVERSATION_ID=$(echo "$CREATE_CHAT" | jq -r '.data.id')

if [ -n "$CONVERSATION_ID" ] && [ "$CONVERSATION_ID" != "null" ]; then
    echo -e "${GREEN}✅ Chat conversation created! ID: $CONVERSATION_ID${NC}"
else
    echo -e "${YELLOW}⚠️ Could not create chat (may already exist)${NC}"
    CONVERSATION_ID=$(echo "$CREATE_CHAT" | jq -r '.data.id')
fi

# =============================================
# STEP 10: Send a message as Student
# =============================================
echo -e "\n${YELLOW}📌 STEP 10: Send a message as Student${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

if [ -n "$CONVERSATION_ID" ] && [ "$CONVERSATION_ID" != "null" ]; then
    SEND_MESSAGE=$(curl -s -X POST http://localhost:5001/api/messages \
      -H "Authorization: Bearer $STUDENT_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"conversationId\": $CONVERSATION_ID,
        \"content\": \"Bonjour formateur! J'ai une question sur le module L1-INFO-101.\"
      }")
    
    if echo "$SEND_MESSAGE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Message sent successfully!${NC}"
        MESSAGE_ID=$(echo "$SEND_MESSAGE" | jq -r '.data.id')
        echo -e "${CYAN}   Message ID: $MESSAGE_ID${NC}"
    else
        echo -e "${RED}❌ Failed to send message${NC}"
        echo "$SEND_MESSAGE"
    fi
else
    echo -e "${RED}❌ No conversation ID available${NC}"
fi

# =============================================
# STEP 11: Get conversation messages
# =============================================
echo -e "\n${YELLOW}📌 STEP 11: Get conversation messages${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

if [ -n "$CONVERSATION_ID" ] && [ "$CONVERSATION_ID" != "null" ]; then
    GET_MESSAGES=$(curl -s -X GET "http://localhost:5001/api/chat/conversations/$CONVERSATION_ID/messages" \
      -H "Authorization: Bearer $STUDENT_TOKEN")
    
    MESSAGE_COUNT=$(echo "$GET_MESSAGES" | jq '.data | length')
    echo -e "${GREEN}✅ Found $MESSAGE_COUNT message(s)${NC}"
    
    if [ "$MESSAGE_COUNT" -gt 0 ]; then
        echo -e "${CYAN}Messages:${NC}"
        echo "$GET_MESSAGES" | jq '.data[] | {id, content, created_at}'
    fi
fi

# =============================================
# SUMMARY
# =============================================
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    TEST SUMMARY                                 ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e ""
echo -e "${CYAN}Student Information:${NC}"
echo -e "  🆔 ID: $STUDENT_ID"
echo -e "  📧 Email: $STUDENT_EMAIL"
echo -e "  🔑 Password: $STUDENT_PASSWORD"
echo -e "  📚 Niveau: L1"
echo -e ""
echo -e "${CYAN}Formateur Information:${NC}"
echo -e "  🆔 ID: $FORMATEUR_ID"
echo -e ""
echo -e "${CYAN}Chat Information:${NC}"
echo -e "  💬 Conversation ID: ${CONVERSATION_ID:-N/A}"
echo -e ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Student-Formateur Chat Test Complete! 🎉${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
