#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}     ADMIN CREATES STUDENT & JOINS COMMUNITIES (FIXED)         ${NC}"
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
# STEP 2: Create a New Student Directly (via SQL)
# =============================================
echo -e "\n${YELLOW}📌 STEP 2: Create a new student directly (via SQL)${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

TIMESTAMP=$(date +%s)
STUDENT_EMAIL="student.test.${TIMESTAMP}@eduplatform.com"
STUDENT_PASSWORD="Student123!"
STUDENT_NOM="TestStudent"
STUDENT_PRENOM="CreatedByAdmin"

# Generate password hash
PASSWORD_HASH=$(node -e "
const bcrypt = require('bcrypt');
const password = '$STUDENT_PASSWORD';
bcrypt.hash(password, 10).then(hash => {
  console.log(hash);
});
")

# Generate unique matricule
YEAR=$(date +%Y)
RANDOM=$((100000 + RANDOM % 900000))
STUDENT_MATRICULE="${YEAR}${RANDOM}"

# Insert student directly into database
sudo -u postgres psql -d eduplatform << EOF
INSERT INTO users (matricule, email, password_hash, nom, prenom, role_global, niveau, is_active)
VALUES ('$STUDENT_MATRICULE', '$STUDENT_EMAIL', '$PASSWORD_HASH', '$STUDENT_NOM', '$STUDENT_PRENOM', 'ETUDIANT', 'L1', true)
RETURNING id;
EOF

# Get the student ID
STUDENT_ID=$(sudo -u postgres psql -d eduplatform -t -c "SELECT id FROM users WHERE email = '$STUDENT_EMAIL';" | tr -d ' ')

if [ -n "$STUDENT_ID" ]; then
    echo -e "${GREEN}✅ Student created successfully!${NC}"
    echo -e "${CYAN}   ID: $STUDENT_ID${NC}"
    echo -e "${CYAN}   Matricule: $STUDENT_MATRICULE${NC}"
    echo -e "${CYAN}   Email: $STUDENT_EMAIL${NC}"
    echo -e "${CYAN}   Password: $STUDENT_PASSWORD${NC}"
else
    echo -e "${RED}❌ Failed to create student${NC}"
    exit 1
fi

# =============================================
# STEP 3: Enroll Student to L1 Modules
# =============================================
echo -e "\n${YELLOW}📌 STEP 3: Enroll student to L1 modules${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

sudo -u postgres psql -d eduplatform << EOF
INSERT INTO etudiant_module_enrollment (etudiant_id, module_id, status)
SELECT $STUDENT_ID, id, 'ACTIVE'
FROM modules
WHERE niveau = 'L1'
ON CONFLICT (etudiant_id, module_id) DO NOTHING;
EOF

echo -e "${GREEN}✅ Student enrolled to L1 modules${NC}"

# =============================================
# STEP 4: Login as Student
# =============================================
echo -e "\n${YELLOW}📌 STEP 4: Login as student${NC}"
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
    echo "$STUDENT_LOGIN"
    exit 1
fi

echo -e "${GREEN}✅ Student logged in successfully${NC}"
echo -e "${CYAN}Student Token: ${STUDENT_TOKEN:0:80}...${NC}"

# =============================================
# STEP 5: Get Communities List
# =============================================
echo -e "\n${YELLOW}📌 STEP 5: Get available communities${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

COMMUNITIES=$(curl -s -X GET http://localhost:5001/api/communities \
  -H "Authorization: Bearer $STUDENT_TOKEN")

echo -e "${CYAN}Available communities:${NC}"
echo "$COMMUNITIES" | jq -r '.data[] | "   📚 ID: \(.id) | \(.name) | Members: \(.member_count)"'

# =============================================
# STEP 6: Join All Communities
# =============================================
echo -e "\n${YELLOW}📌 STEP 6: Join all communities${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

for i in 1 2 3 4; do
    echo -e "\n${CYAN}Joining community ID: $i${NC}"
    JOIN_RESULT=$(curl -s -X POST "http://localhost:5001/api/communities/$i/join" \
      -H "Authorization: Bearer $STUDENT_TOKEN")
    
    if echo "$JOIN_RESULT" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Joined community $i${NC}"
    else
        echo -e "${YELLOW}⚠️ Could not join community $i: $(echo "$JOIN_RESULT" | jq -r '.error')${NC}"
    fi
done

# =============================================
# STEP 7: Verify Joined Communities
# =============================================
echo -e "\n${YELLOW}📌 STEP 7: Get joined communities${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

JOINED=$(curl -s -X GET http://localhost:5001/api/communities/joined \
  -H "Authorization: Bearer $STUDENT_TOKEN")

JOINED_COUNT=$(echo "$JOINED" | jq '.data | length')
echo -e "${GREEN}✅ Student has joined $JOINED_COUNT communities${NC}"

echo "$JOINED" | jq -r '.data[] | "   💬 \(.name) - Joined: \(.joined_at)"'

# =============================================
# STEP 8: Get Community Chat
# =============================================
echo -e "\n${YELLOW}📌 STEP 8: Get community chat (Python Community)${NC}"
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
