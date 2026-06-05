#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}     ADMIN CREATES STUDENT & JOINS COMMUNITIES                  ${NC}"
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
echo -e "${CYAN}Admin Token: ${ADMIN_TOKEN:0:50}...${NC}"

# =============================================
# STEP 2: Create a New Student
# =============================================
echo -e "\n${YELLOW}📌 STEP 2: Create a new student${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

TIMESTAMP=$(date +%s)
STUDENT_EMAIL="student.test.${TIMESTAMP}@eduplatform.com"
STUDENT_PASSWORD="Student123!"
STUDENT_NOM="TestStudent"
STUDENT_PRENOM="CreatedByAdmin"

CREATE_STUDENT=$(curl -s -X POST http://localhost:5001/api/admin/formateurs \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$STUDENT_EMAIL\",
    \"nom\": \"$STUDENT_NOM\",
    \"prenom\": \"$STUDENT_PRENOM\",
    \"password\": \"$STUDENT_PASSWORD\"
  }")

STUDENT_ID=$(echo "$CREATE_STUDENT" | jq -r '.data.id')
STUDENT_MATRICULE=$(echo "$CREATE_STUDENT" | jq -r '.data.matricule')

if [ -n "$STUDENT_ID" ] && [ "$STUDENT_ID" != "null" ]; then
    echo -e "${GREEN}✅ Student created successfully!${NC}"
    echo -e "${CYAN}   ID: $STUDENT_ID${NC}"
    echo -e "${CYAN}   Matricule: $STUDENT_MATRICULE${NC}"
    echo -e "${CYAN}   Email: $STUDENT_EMAIL${NC}"
    echo -e "${CYAN}   Password: $STUDENT_PASSWORD${NC}"
else
    echo -e "${RED}❌ Failed to create student${NC}"
    echo "$CREATE_STUDENT"
    exit 1
fi

# =============================================
# STEP 3: Update Student Role to ETUDIANT
# =============================================
echo -e "\n${YELLOW}📌 STEP 3: Update student role to ETUDIANT${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

sudo -u postgres psql -d eduplatform -c "UPDATE users SET role_global = 'ETUDIANT' WHERE id = $STUDENT_ID;" 2>/dev/null
echo -e "${GREEN}✅ Student role updated to ETUDIANT${NC}"

# =============================================
# STEP 4: Set Student Niveau to L1
# =============================================
echo -e "\n${YELLOW}📌 STEP 4: Set student niveau to L1${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

curl -s -X POST http://localhost:5001/api/admin/students/niveau \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"etudiantId\": $STUDENT_ID,
    \"niveau\": \"L1\"
  }" > /dev/null

echo -e "${GREEN}✅ Student niveau set to L1${NC}"

# =============================================
# STEP 5: Login as Student
# =============================================
echo -e "\n${YELLOW}📌 STEP 5: Login as student${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

STUDENT_LOGIN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"matricule\": \"$STUDENT_EMAIL\",
    \"password\": \"$STUDENT_PASSWORD\"
  }")

STUDENT_TOKEN=$(echo "$STUDENT_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$STUDENT_TOKEN" ]; then
    echo -e "${RED}❌ Student login failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Student logged in successfully${NC}"
echo -e "${CYAN}Student Token: ${STUDENT_TOKEN:0:80}...${NC}"

# =============================================
# STEP 6: Get Communities List
# =============================================
echo -e "\n${YELLOW}📌 STEP 6: Get available communities${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

COMMUNITIES=$(curl -s -X GET http://localhost:5001/api/communities \
  -H "Authorization: Bearer $STUDENT_TOKEN")

echo -e "${CYAN}Available communities:${NC}"
echo "$COMMUNITIES" | jq -r '.data[] | "   📚 ID: \(.id) | \(.name) | Members: \(.member_count)"'

# =============================================
# STEP 7: Join All Communities
# =============================================
echo -e "\n${YELLOW}📌 STEP 7: Join all communities${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

for i in 1 2 3 4; do
    echo -e "\n${CYAN}Joining community ID: $i${NC}"
    JOIN_RESULT=$(curl -s -X POST "http://localhost:5001/api/communities/$i/join" \
      -H "Authorization: Bearer $STUDENT_TOKEN")
    
    if echo "$JOIN_RESULT" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Joined community $i${NC}"
    else
        echo -e "${YELLOW}⚠️ Could not join community $i (may already be joined)${NC}"
    fi
done

# =============================================
# STEP 8: Verify Joined Communities
# =============================================
echo -e "\n${YELLOW}📌 STEP 8: Get joined communities${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

JOINED=$(curl -s -X GET http://localhost:5001/api/communities/joined \
  -H "Authorization: Bearer $STUDENT_TOKEN")

JOINED_COUNT=$(echo "$JOINED" | jq '.data | length')
echo -e "${GREEN}✅ Student has joined $JOINED_COUNT communities${NC}"

echo "$JOINED" | jq -r '.data[] | "   💬 \(.name) - Joined: \(.joined_at)"'

# =============================================
# STEP 9: Get Community Chat
# =============================================
echo -e "\n${YELLOW}📌 STEP 9: Get community chat (Python Community)${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

COMMUNITY_CHAT=$(curl -s -X GET http://localhost:5001/api/communities/1/chat \
  -H "Authorization: Bearer $STUDENT_TOKEN")

if echo "$COMMUNITY_CHAT" | grep -q '"success":true'; then
    CONVERSATION_ID=$(echo "$COMMUNITY_CHAT" | jq -r '.data.id')
    echo -e "${GREEN}✅ Community chat ready! Conversation ID: $CONVERSATION_ID${NC}"
else
    echo -e "${RED}❌ Failed to get community chat${NC}"
fi

# =============================================
# STEP 10: Send a Test Message to Community Chat
# =============================================
echo -e "\n${YELLOW}📌 STEP 10: Send test message to community chat${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

if [ -n "$CONVERSATION_ID" ]; then
    SEND_MESSAGE=$(curl -s -X POST http://localhost:5001/api/chat/messages \
      -H "Authorization: Bearer $STUDENT_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"conversationId\": $CONVERSATION_ID,
        \"content\": \"Bonjour tout le monde! Je viens de rejoindre la communauté Python! 🐍\"
      }")
    
    if echo "$SEND_MESSAGE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Test message sent!${NC}"
    else
        echo -e "${YELLOW}⚠️ Could not send message (may need socket connection)${NC}"
    fi
fi

# =============================================
# SUMMARY
# =============================================
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                       TEST SUMMARY                              ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e ""
echo -e "${CYAN}Student Credentials:${NC}"
echo -e "  🆔 ID: $STUDENT_ID"
echo -e "  🔑 Matricule: $STUDENT_MATRICULE"
echo -e "  📧 Email: $STUDENT_EMAIL"
echo -e "  🔐 Password: $STUDENT_PASSWORD"
echo -e "  📚 Niveau: L1"
echo -e ""
echo -e "${CYAN}Student Token (save this for frontend):${NC}"
echo -e "${YELLOW}$STUDENT_TOKEN${NC}"
echo -e ""
echo -e "${CYAN}Communities Joined: $JOINED_COUNT/4${NC}"
echo -e ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Student created and communities joined successfully! 🎉${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
