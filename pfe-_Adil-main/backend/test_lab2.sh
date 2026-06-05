#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}LAB 2: Testing Posts System${NC}"
echo -e "${BLUE}=========================================${NC}"

# Login as student (get token from browser first)
echo -e "\n${YELLOW}1. Enter your student token from browser:${NC}"
read -p "Student Token: " STUDENT_TOKEN

if [ -z "$STUDENT_TOKEN" ]; then
    echo -e "${RED}❌ No token provided${NC}"
    exit 1
fi

# 2. Create a post
echo -e "\n${YELLOW}2. Creating a post...${NC}"
CREATE_POST=$(curl -s -X POST http://localhost:5001/api/posts \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello everyone! This is my first post on EduPlatform!",
    "post_type": "DISCUSSION"
  }')

echo -e "${BLUE}Response: $CREATE_POST${NC}"

POST_ID=$(echo $CREATE_POST | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo -e "${GREEN}✅ Post created with ID: $POST_ID${NC}"

# 3. Get all posts
echo -e "\n${YELLOW}3. Getting all posts...${NC}"
curl -s -X GET http://localhost:5001/api/posts \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.'

# 4. Add reaction (Insightful)
echo -e "\n${YELLOW}4. Adding insightful reaction...${NC}"
curl -s -X POST http://localhost:5001/api/posts/$POST_ID/reactions \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reaction_type":"INSIGHTFUL"}' | jq '.'

# 5. Add comment
echo -e "\n${YELLOW}5. Adding comment...${NC}"
curl -s -X POST http://localhost:5001/api/posts/$POST_ID/comments \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Great post! Very insightful!"}' | jq '.'

# 6. Share post
echo -e "\n${YELLOW}6. Sharing post...${NC}"
curl -s -X POST http://localhost:5001/api/posts/$POST_ID/shares \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.'

# 7. Get single post with comments
echo -e "\n${YELLOW}7. Getting post details...${NC}"
curl -s -X GET http://localhost:5001/api/posts/$POST_ID \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.'

echo -e "\n${BLUE}=========================================${NC}"
echo -e "${GREEN}LAB 2 Test Complete!${NC}"
echo -e "${BLUE}=========================================${NC}"
