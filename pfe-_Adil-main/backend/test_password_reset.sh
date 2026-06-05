#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}Testing Password Reset System${NC}"
echo -e "${BLUE}=========================================${NC}"

# 1. First, create a test user (if not exists)
echo -e "\n${YELLOW}1. Creating a test user for password reset...${NC}"

# Login as admin to create a user
ADMIN_TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"matricule":"ADMIN001","password":"Admin123!"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Create a test student
CREATE_USER=$(curl -s -X POST http://localhost:5001/api/admin/formateurs \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "reset.test@eduplatform.com",
    "nom": "Reset",
    "prenom": "Test",
    "password": "OldPassword123!"
  }')

echo -e "${GREEN}✅ Test user created${NC}"

# 2. Test forgot password
echo -e "\n${YELLOW}2. Requesting password reset...${NC}"
FORGOT_RESPONSE=$(curl -s -X POST http://localhost:5001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"identifier":"reset.test@eduplatform.com"}')

echo -e "${BLUE}Response: $FORGOT_RESPONSE${NC}"

# Extract token from response (development mode)
RESET_TOKEN=$(echo $FORGOT_RESPONSE | grep -o '"dev_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$RESET_TOKEN" ]; then
    echo -e "${YELLOW}⚠️ No token in response. Check server logs for token.${NC}"
    echo -e "${YELLOW}   The token is logged in the terminal where server is running.${NC}"
    echo -e "${YELLOW}   Look for: '📧 DEVELOPMENT MODE - Password Reset Token:'${NC}"
    
    # Prompt user to enter token manually
    echo -e "\n${YELLOW}Please enter the token from server logs:${NC}"
    read -p "Token: " RESET_TOKEN
fi

if [ -n "$RESET_TOKEN" ]; then
    # 3. Test reset password
    echo -e "\n${YELLOW}3. Resetting password...${NC}"
    RESET_RESPONSE=$(curl -s -X POST http://localhost:5001/api/auth/reset-password \
      -H "Content-Type: application/json" \
      -d "{
        \"token\": \"$RESET_TOKEN\",
        \"new_password\": \"NewPassword456!\"
      }")
    
    echo -e "${BLUE}Response: $RESET_RESPONSE${NC}"
    
    # 4. Test login with new password
    echo -e "\n${YELLOW}4. Testing login with new password...${NC}"
    LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5001/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"matricule":"reset.test@eduplatform.com","password":"NewPassword456!"}')
    
    if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Login successful! Password reset worked!${NC}"
    else
        echo -e "${RED}❌ Login failed. Password reset may have issues.${NC}"
    fi
fi

echo -e "\n${BLUE}=========================================${NC}"
echo -e "${GREEN}Password Reset Test Complete!${NC}"
echo -e "${BLUE}=========================================${NC}"
