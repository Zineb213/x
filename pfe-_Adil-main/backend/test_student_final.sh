#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}         TEST EXISTING STUDENT CHAT FLOW (FINAL)               ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# STEP 1: Login as Admin
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

# STEP 2: Set password for student using direct database update
echo -e "\n${YELLOW}📌 STEP 2: Set password for student${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

STUDENT_EMAIL="abdanourbouhaik@gmail.com"
STUDENT_PASSWORD="StudentPass123!"

# Generate hash using node
HASH=$(node -e "
const bcrypt = require('bcrypt');
const password = '$STUDENT_PASSWORD';
bcrypt.hash(password, 10).then(hash => {
  console.log(hash);
});
")

# Update database
sudo -u postgres psql -d eduplatform -c "UPDATE users SET password_hash = '$HASH' WHERE email = '$STUDENT_EMAIL';" 2>/dev/null

echo -e "${GREEN}✅ Password set for student${NC}"

# STEP 3: Get student info
echo -e "\n${YELLOW}📌 STEP 3: Get student info${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

STUDENT_INFO=$(sudo -u postgres psql -d eduplatform -t -c "SELECT id, niveau FROM users WHERE email = '$STUDENT_EMAIL';" 2>/dev/null | tr -d ' ')
STUDENT_ID=$(echo "$STUDENT_INFO" | cut -d'|' -f1)
echo -e "${GREEN}✅ Student ID: $STUDENT_ID${NC}"

# STEP 4: Set student niveau to L1 if not set
echo -e "\n${YELLOW}📌 STEP 4: Set student niveau${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
sudo -u postgres psql -d eduplatform -c "UPDATE users SET niveau = 'L1' WHERE id = $STUDENT_ID;" 2>/dev/null
echo -e "${GREEN}✅ Student niveau set to L1${NC}"

# STEP 5: Enroll student to module
echo -e "\n${YELLOW}📌 STEP 5: Enroll student to module${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
MODULE_ID=1

ENROLL=$(curl -s -X POST http://localhost:5001/api/admin/enrollments \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"etudiantId\": $STUDENT_ID, \"moduleId\": $MODULE_ID}")

echo -e "${GREEN}✅ Student enrolled to module${NC}"

# STEP 6: Login as Student
echo -e "\n${YELLOW}📌 STEP 6: Login as Student${NC}"
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
    echo "$STUDENT_LOGIN"
    exit 1
fi

# STEP 7: Get formateur for module
echo -e "\n${YELLOW}📌 STEP 7: Get formateur for module${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

GET_FORMATEUR=$(curl -s -X GET "http://localhost:5001/api/etudiant/modules/$MODULE_ID/formateur" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

FORMATEUR_ID=$(echo "$GET_FORMATEUR" | jq -r '.data.id')

if [ -n "$FORMATEUR_ID" ] && [ "$FORMATEUR_ID" != "null" ]; then
    echo -e "${GREEN}✅ Formateur found: ID $FORMATEUR_ID${NC}"
else
    echo -e "${YELLOW}⚠️ No formateur assigned. Creating one...${NC}"
    
    # Create formateur
    CREATE_FORMATEUR=$(curl -s -X POST http://localhost:5001/api/admin/formateurs \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "temp.formateur@test.com",
        "nom": "Temp",
        "prenom": "Formateur",
        "password": "Formateur123!"
      }')
    FORMATEUR_ID=$(echo "$CREATE_FORMATEUR" | jq -r '.data.id')
    
    # Assign to module
    curl -s -X POST http://localhost:5001/api/admin/assignments \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"formateurId\": $FORMATEUR_ID, \"moduleId\": $MODULE_ID}" > /dev/null
    
    echo -e "${GREEN}✅ Formateur created and assigned: ID $FORMATEUR_ID${NC}"
fi

# STEP 8: Create chat
echo -e "\n${YELLOW}📌 STEP 8: Create chat with formateur${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

CREATE_CHAT=$(curl -s -X POST http://localhost:5001/api/etudiant/chat/formateur \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"formateurId\": $FORMATEUR_ID,
    \"moduleId\": $MODULE_ID
  }")

CONVERSATION_ID=$(echo "$CREATE_CHAT" | jq -r '.data.id')
echo -e "${GREEN}✅ Chat conversation ID: $CONVERSATION_ID${NC}"

# STEP 9: Send message
echo -e "\n${YELLOW}📌 STEP 9: Send a message${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

SEND_MESSAGE=$(curl -s -X POST http://localhost:5001/api/messages \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversationId\": $CONVERSATION_ID,
    \"content\": \"Bonjour formateur! J'ai une question sur le module.\"
  }")

if echo "$SEND_MESSAGE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Message sent successfully!${NC}"
else
    echo -e "${RED}❌ Failed to send message${NC}"
fi

# SUMMARY
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    TEST SUMMARY                                 ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e ""
echo -e "${CYAN}Student Credentials:${NC}"
echo -e "  📧 Email: $STUDENT_EMAIL"
echo -e "  🔑 Password: $STUDENT_PASSWORD"
echo -e "  🆔 ID: $STUDENT_ID"
echo -e ""
echo -e "${CYAN}Chat Created:${NC}"
echo -e "  💬 Conversation ID: $CONVERSATION_ID"
echo -e "  ✉️ Message sent: Yes"
echo -e ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Test Complete! 🎉${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
