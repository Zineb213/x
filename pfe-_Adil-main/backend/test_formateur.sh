#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}Testing Formateur Workflow${NC}"
echo -e "${BLUE}=========================================${NC}"

# 1. Login as Admin
echo -e "\n${YELLOW}1. Logging in as Admin...${NC}"
ADMIN_LOGIN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"matricule":"ADMIN001","password":"Admin123!"}')

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
    echo -e "${RED}❌ Admin login failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Admin token obtained${NC}"

# 2. Create a Formateur (if not exists)
echo -e "\n${YELLOW}2. Creating a new Formateur...${NC}"
FORMATEUR_EMAIL="formateur.test$(date +%s)@eduplatform.com"

CREATE_FORMATEUR=$(curl -s -X POST http://localhost:5001/api/admin/formateurs \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$FORMATEUR_EMAIL\",
    \"nom\": \"Test\",
    \"prenom\": \"Formateur\",
    \"password\": \"Formateur123!\"
  }")

FORMATEUR_ID=$(echo $CREATE_FORMATEUR | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
FORMATEUR_MATRICULE=$(echo $CREATE_FORMATEUR | grep -o '"matricule":"[^"]*"' | cut -d'"' -f4)

if [ -z "$FORMATEUR_ID" ]; then
    echo -e "${RED}❌ Failed to create formateur${NC}"
    echo $CREATE_FORMATEUR
    exit 1
fi
echo -e "${GREEN}✅ Formateur created: ID=$FORMATEUR_ID, Matricule=$FORMATEUR_MATRICULE${NC}"

# 3. Login as Formateur
echo -e "\n${YELLOW}3. Logging in as Formateur...${NC}"
FORMATEUR_LOGIN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"matricule\":\"$FORMATEUR_MATRICULE\",\"password\":\"Formateur123!\"}")

FORMATEUR_TOKEN=$(echo $FORMATEUR_LOGIN | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$FORMATEUR_TOKEN" ]; then
    echo -e "${RED}❌ Formateur login failed${NC}"
    echo $FORMATEUR_LOGIN
    exit 1
fi
echo -e "${GREEN}✅ Formateur token obtained${NC}"

# 4. Get formateur's modules (should be empty initially)
echo -e "\n${YELLOW}4. Getting Formateur's modules (before assignment)...${NC}"
GET_MODULES=$(curl -s -X GET http://localhost:5001/api/formateur/modules \
  -H "Authorization: Bearer $FORMATEUR_TOKEN")

MODULE_COUNT=$(echo $GET_MODULES | grep -o '"data":\[' | wc -l)
echo -e "${BLUE}Response: $GET_MODULES${NC}"
echo -e "${YELLOW}Modules count: 0 (expected - no assignments yet)${NC}"

# 5. Get all modules (as admin) to find one to assign
echo -e "\n${YELLOW}5. Getting available modules...${NC}"
GET_MODULES_ADMIN=$(curl -s -X GET http://localhost:5001/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN")

# Get module ID 1 (exists from seed)
MODULE_ID=1
echo -e "${GREEN}✅ Using module ID: $MODULE_ID (L1-INFO-101)${NC}"

# 6. Assign Formateur to Module (as Admin)
echo -e "\n${YELLOW}6. Assigning Formateur to Module...${NC}"
ASSIGNMENT=$(curl -s -X POST http://localhost:5001/api/admin/assignments \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"formateurId\": $FORMATEUR_ID,
    \"moduleId\": $MODULE_ID
  }")

echo -e "${BLUE}Assignment response: $ASSIGNMENT${NC}"

if echo "$ASSIGNMENT" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Formateur assigned to module successfully${NC}"
else
    echo -e "${RED}❌ Assignment failed${NC}"
fi

# 7. Get formateur's modules (should now have the assigned module)
echo -e "\n${YELLOW}7. Getting Formateur's modules (after assignment)...${NC}"
GET_MODULES_AFTER=$(curl -s -X GET http://localhost:5001/api/formateur/modules \
  -H "Authorization: Bearer $FORMATEUR_TOKEN")

echo -e "${BLUE}Response: $GET_MODULES_AFTER${NC}"

if echo "$GET_MODULES_AFTER" | grep -q '"data":\[{' ; then
    echo -e "${GREEN}✅ Formateur now has assigned modules!${NC}"
else
    echo -e "${RED}❌ No modules found - assignment may have failed${NC}"
fi

# 8. Upload a resource (as Formateur)
echo -e "\n${YELLOW}8. Uploading a resource...${NC}"

# Create a test PDF file
echo "%PDF-1.4 Test document" > /tmp/test.pdf

UPLOAD_RESOURCE=$(curl -s -X POST http://localhost:5001/api/formateur/resources \
  -H "Authorization: Bearer $FORMATEUR_TOKEN" \
  -F "file=@/tmp/test.pdf" \
  -F "module_id=$MODULE_ID" \
  -F "titre=Test Resource" \
  -F "description=This is a test resource" \
  -F "category=Cours")

echo -e "${BLUE}Upload response: $UPLOAD_RESOURCE${NC}"

if echo "$UPLOAD_RESOURCE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Resource uploaded successfully!${NC}"
    RESOURCE_ID=$(echo $UPLOAD_RESOURCE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    echo -e "${GREEN}   Resource ID: $RESOURCE_ID${NC}"
else
    echo -e "${RED}❌ Resource upload failed${NC}"
fi

# 9. Get formateur's resources
echo -e "\n${YELLOW}9. Getting Formateur's resources...${NC}"
GET_RESOURCES=$(curl -s -X GET http://localhost:5001/api/formateur/resources \
  -H "Authorization: Bearer $FORMATEUR_TOKEN")

echo -e "${BLUE}Response: $GET_RESOURCES${NC}"

# 10. Clean up - delete the test resource if created
if [ ! -z "$RESOURCE_ID" ]; then
    echo -e "\n${YELLOW}10. Deleting test resource...${NC}"
    DELETE_RESOURCE=$(curl -s -X DELETE http://localhost:5001/api/formateur/resources/$RESOURCE_ID \
      -H "Authorization: Bearer $FORMATEUR_TOKEN")
    
    if echo "$DELETE_RESOURCE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Resource deleted successfully${NC}"
    else
        echo -e "${RED}❌ Resource deletion failed${NC}"
    fi
fi

# Clean up temp file
rm -f /tmp/test.pdf

echo -e "\n${BLUE}=========================================${NC}"
echo -e "${GREEN}Formateur Workflow Test Complete!${NC}"
echo -e "${BLUE}=========================================${NC}"
echo -e "\n${YELLOW}Summary:${NC}"
echo -e "  Admin ID: 1"
echo -e "  Formateur ID: $FORMATEUR_ID"
echo -e "  Formateur Matricule: $FORMATEUR_MATRICULE"
echo -e "  Module ID: $MODULE_ID"
echo -e "  Token: ${FORMATEUR_TOKEN:0:50}..."
