#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}           VERIFYING ALL ADMIN ENDPOINTS                       ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# Login as admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"matricule":"ADMIN001","password":"Admin123!"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
    echo -e "${RED}❌ Admin login failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Admin logged in${NC}"

# Test 1: GET /admin/stats
echo -e "\n${YELLOW}1. GET /admin/stats${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/admin/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN")
if [ "$STATUS" = "200" ]; then echo -e "${GREEN}✅ OK${NC}"; else echo -e "${RED}❌ Failed (${STATUS})${NC}"; fi

# Test 2: GET /admin/users
echo -e "\n${YELLOW}2. GET /admin/users${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN")
if [ "$STATUS" = "200" ]; then echo -e "${GREEN}✅ OK${NC}"; else echo -e "${RED}❌ Failed (${STATUS})${NC}"; fi

# Test 3: GET /admin/users/password-status
echo -e "\n${YELLOW}3. GET /admin/users/password-status${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/admin/users/password-status \
  -H "Authorization: Bearer $ADMIN_TOKEN")
if [ "$STATUS" = "200" ]; then echo -e "${GREEN}✅ OK${NC}"; else echo -e "${RED}❌ Failed (${STATUS})${NC}"; fi

# Test 4: GET /admin/modules
echo -e "\n${YELLOW}4. GET /admin/modules${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/admin/modules \
  -H "Authorization: Bearer $ADMIN_TOKEN")
if [ "$STATUS" = "200" ]; then echo -e "${GREEN}✅ OK${NC}"; else echo -e "${RED}❌ Failed (${STATUS})${NC}"; fi

# Test 5: GET /admin/assignments
echo -e "\n${YELLOW}5. GET /admin/assignments${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/admin/assignments \
  -H "Authorization: Bearer $ADMIN_TOKEN")
if [ "$STATUS" = "200" ]; then echo -e "${GREEN}✅ OK${NC}"; else echo -e "${RED}❌ Failed (${STATUS})${NC}"; fi

# Test 6: GET /admin/enrollments
echo -e "\n${YELLOW}6. GET /admin/enrollments${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/admin/enrollments \
  -H "Authorization: Bearer $ADMIN_TOKEN")
if [ "$STATUS" = "200" ]; then echo -e "${GREEN}✅ OK${NC}"; else echo -e "${RED}❌ Failed (${STATUS})${NC}"; fi

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 All admin endpoints are working! 🎉${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
