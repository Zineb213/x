#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}           CREATE FRESH STUDENT WITH WORKING PASSWORD         ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# First, login as admin to get token
echo -e "\n${YELLOW}1. Logging in as Admin...${NC}"
ADMIN_LOGIN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"matricule":"ADMIN001","password":"Admin123!"}')

ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
    echo -e "${RED}❌ Admin login failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Admin logged in${NC}"

# Create fresh student using the admin API (this ensures proper password hashing)
TIMESTAMP=$(date +%s)
STUDENT_EMAIL="fresh.student.${TIMESTAMP}@eduplatform.com"
STUDENT_PASSWORD="Student123!"

echo -e "\n${YELLOW}2. Creating fresh student...${NC}"
echo -e "   Email: $STUDENT_EMAIL"
echo -e "   Password: $STUDENT_PASSWORD"

CREATE_STUDENT=$(curl -s -X POST http://localhost:5001/api/admin/formateurs \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$STUDENT_EMAIL\",
    \"nom\": \"Fresh\",
    \"prenom\": \"Student\",
    \"password\": \"$STUDENT_PASSWORD\"
  }")

STUDENT_ID=$(echo "$CREATE_STUDENT" | jq -r '.data.id')
STUDENT_MATRICULE=$(echo "$CREATE_STUDENT" | jq -r '.data.matricule')

if [ -n "$STUDENT_ID" ] && [ "$STUDENT_ID" != "null" ]; then
    echo -e "${GREEN}✅ Student created with ID: $STUDENT_ID${NC}"
    echo -e "${GREEN}   Matricule: $STUDENT_MATRICULE${NC}"
    
    # Update role to ETUDIANT and set niveau
    sudo -u postgres psql -d eduplatform << EOF
UPDATE users SET role_global = 'ETUDIANT', niveau = 'L1' WHERE id = $STUDENT_ID;
EOF
    echo -e "${GREEN}✅ Role updated to ETUDIANT, niveau set to L1${NC}"
else
    echo -e "${RED}❌ Failed to create student${NC}"
    exit 1
fi

# Test login with email
echo -e "\n${YELLOW}3. Testing login with EMAIL...${NC}"
LOGIN_EMAIL=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"matricule\": \"$STUDENT_EMAIL\",
    \"password\": \"$STUDENT_PASSWORD\"
  }")

if echo "$LOGIN_EMAIL" | grep -q '"success":true'; then
    STUDENT_TOKEN=$(echo "$LOGIN_EMAIL" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}✅ Login with EMAIL successful!${NC}"
    echo -e "${CYAN}Token: ${STUDENT_TOKEN:0:80}...${NC}"
    
    # Join communities
    echo -e "\n${YELLOW}4. Joining communities...${NC}"
    for i in 1 2 3 4; do
        JOIN_RESULT=$(curl -s -X POST "http://localhost:5001/api/communities/$i/join" \
          -H "Authorization: Bearer $STUDENT_TOKEN")
        if echo "$JOIN_RESULT" | grep -q '"success":true'; then
            echo -e "${GREEN}✅ Joined community $i${NC}"
        else
            echo -e "${RED}❌ Failed to join community $i${NC}"
        fi
    done
    
    # Get joined communities
    echo -e "\n${YELLOW}5. Getting joined communities...${NC}"
    curl -s -X GET "http://localhost:5001/api/communities/joined" \
      -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.'
    
else
    echo -e "${RED}❌ Login with EMAIL failed${NC}"
    echo "$LOGIN_EMAIL"
fi

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Fresh Student Credentials:${NC}"
echo -e "  Email: $STUDENT_EMAIL"
echo -e "  Password: $STUDENT_PASSWORD"
echo -e "  Matricule: $STUDENT_MATRICULE"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
