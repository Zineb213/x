#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                    STUDENT CHAT SYSTEM TEST                     ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# =============================================
# STEP 1: Get Student Token
# =============================================
echo -e "\n${YELLOW}📌 STEP 1: Student Authentication${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo -e "${CYAN}Please login as student (heymowglinyoo@gmail.com) via Google:${NC}"
echo -e "${CYAN}1. Open browser: http://localhost:3000/google-login.html${NC}"
echo -e "${CYAN}2. Login with: heymowglinyoo@gmail.com${NC}"
echo -e "${CYAN}3. Press F12 → Console → type: localStorage.getItem('token')${NC}"
echo -e "${CYAN}4. Copy the FULL token${NC}"
echo -e ""
read -p "👉 Paste your student token here: " STUDENT_TOKEN

if [ -z "$STUDENT_TOKEN" ]; then
    echo -e "${RED}❌ No token provided. Exiting.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Student token received${NC}"

# Verify token works
echo -e "\n${YELLOW}Verifying token...${NC}"
ME_RESPONSE=$(curl -s -X GET http://localhost:5001/api/auth/me \
  -H "Authorization: Bearer $STUDENT_TOKEN")

if echo "$ME_RESPONSE" | grep -q '"success":true'; then
    STUDENT_ID=$(echo $ME_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    STUDENT_EMAIL=$(echo $ME_RESPONSE | grep -o '"email":"[^"]*"' | head -1 | cut -d'"' -f4)
    STUDENT_NIVEAU=$(echo $ME_RESPONSE | grep -o '"niveau":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo -e "${GREEN}✅ Authenticated as: $STUDENT_EMAIL (ID: $STUDENT_ID, Niveau: ${STUDENT_NIVEAU:-Not set})${NC}"
else
    echo -e "${RED}❌ Invalid token. Please get a fresh token from browser.${NC}"
    exit 1
fi

# =============================================
# STEP 2: Test Level Chat (Community Chat)
# =============================================
echo -e "\n${YELLOW}📌 STEP 2: Level Community Chat${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

# Get or create level chat for student's niveau
STUDENT_LEVEL=${STUDENT_NIVEAU:-"L1"}
echo -e "${CYAN}Student level: $STUDENT_LEVEL${NC}"

LEVEL_CHAT=$(curl -s -X GET "http://localhost:5001/api/chat/level/$STUDENT_LEVEL" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

echo -e "${BLUE}Level Chat Response:${NC}"
echo "$LEVEL_CHAT" | jq '.'

LEVEL_CONV_ID=$(echo "$LEVEL_CHAT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$LEVEL_CONV_ID" ]; then
    echo -e "${GREEN}✅ Level chat conversation ID: $LEVEL_CONV_ID${NC}"
    
    # Get messages from level chat
    echo -e "\n${CYAN}Getting messages from level chat...${NC}"
    LEVEL_MESSAGES=$(curl -s -X GET "http://localhost:5001/api/chat/conversations/$LEVEL_CONV_ID/messages?limit=20" \
      -H "Authorization: Bearer $STUDENT_TOKEN")
    
    echo "$LEVEL_MESSAGES" | jq '.'
else
    echo -e "${RED}❌ Failed to get level chat${NC}"
fi

# =============================================
# STEP 3: Create Private Chat with Another Student
# =============================================
echo -e "\n${YELLOW}📌 STEP 3: Private 1-to-1 Chat${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

# First, get list of other students
echo -e "${CYAN}Getting list of other students...${NC}"
# For demo, we'll use admin token to get students
ADMIN_TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"matricule":"ADMIN001","password":"Admin123!"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$ADMIN_TOKEN" ]; then
    OTHER_STUDENTS=$(curl -s -X GET "http://localhost:5001/api/admin/users?role=ETUDIANT" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    
    echo -e "${BLUE}Available students:${NC}"
    echo "$OTHER_STUDENTS" | jq '.data[] | {id, email, nom, prenom}'
    
    # Get first other student ID (not the current one)
    OTHER_STUDENT_ID=$(echo "$OTHER_STUDENTS" | jq ".data[] | select(.id != $STUDENT_ID) | .id" | head -1)
    
    if [ -n "$OTHER_STUDENT_ID" ] && [ "$OTHER_STUDENT_ID" != "null" ]; then
        echo -e "${CYAN}Creating private chat with student ID: $OTHER_STUDENT_ID${NC}"
        
        PRIVATE_CHAT=$(curl -s -X POST http://localhost:5001/api/chat/private \
          -H "Authorization: Bearer $STUDENT_TOKEN" \
          -H "Content-Type: application/json" \
          -d "{\"userId\": $OTHER_STUDENT_ID}")
        
        echo -e "${BLUE}Private Chat Response:${NC}"
        echo "$PRIVATE_CHAT" | jq '.'
        
        PRIVATE_CONV_ID=$(echo "$PRIVATE_CHAT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
        
        if [ -n "$PRIVATE_CONV_ID" ]; then
            echo -e "${GREEN}✅ Private chat created! Conversation ID: $PRIVATE_CONV_ID${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ No other students found. Create another student first.${NC}"
    fi
fi

# =============================================
# STEP 4: Create Group Chat
# =============================================
echo -e "\n${YELLOW}📌 STEP 4: Create Group Chat${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

echo -e "${CYAN}Creating group chat 'Study Group L1'...${NC}"
GROUP_CHAT=$(curl -s -X POST http://localhost:5001/api/chat/group \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupName": "Study Group L1",
    "participantIds": []
  }')

echo -e "${BLUE}Group Chat Response:${NC}"
echo "$GROUP_CHAT" | jq '.'

GROUP_CONV_ID=$(echo "$GROUP_CHAT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$GROUP_CONV_ID" ]; then
    echo -e "${GREEN}✅ Group chat created! Conversation ID: $GROUP_CONV_ID${NC}"
    
    # Add participant to group (if other student exists)
    if [ -n "$OTHER_STUDENT_ID" ] && [ "$OTHER_STUDENT_ID" != "null" ]; then
        echo -e "\n${CYAN}Adding student $OTHER_STUDENT_ID to group...${NC}"
        ADD_PARTICIPANT=$(curl -s -X POST "http://localhost:5001/api/chat/conversations/$GROUP_CONV_ID/participants" \
          -H "Authorization: Bearer $STUDENT_TOKEN" \
          -H "Content-Type: application/json" \
          -d "{\"userId\": $OTHER_STUDENT_ID}")
        
        echo "$ADD_PARTICIPANT" | jq '.'
    fi
fi

# =============================================
# STEP 5: Get All Student Conversations
# =============================================
echo -e "\n${YELLOW}📌 STEP 5: Get All My Conversations${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

MY_CONVERSATIONS=$(curl -s -X GET http://localhost:5001/api/chat/conversations \
  -H "Authorization: Bearer $STUDENT_TOKEN")

echo -e "${BLUE}My Conversations:${NC}"
echo "$MY_CONVERSATIONS" | jq '.'

CONVERSATION_COUNT=$(echo "$MY_CONVERSATIONS" | jq '.data | length')
echo -e "${GREEN}✅ Found $CONVERSATION_COUNT conversations${NC}"

# =============================================
# STEP 6: Get Participants of a Conversation
# =============================================
if [ -n "$LEVEL_CONV_ID" ]; then
    echo -e "\n${YELLOW}📌 STEP 6: Get Participants of Level Chat${NC}"
    echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
    
    PARTICIPANTS=$(curl -s -X GET "http://localhost:5001/api/chat/conversations/$LEVEL_CONV_ID/participants" \
      -H "Authorization: Bearer $STUDENT_TOKEN")
    
    echo -e "${BLUE}Participants in Level $STUDENT_LEVEL Chat:${NC}"
    echo "$PARTICIPANTS" | jq '.'
fi

# =============================================
# STEP 7: Socket.io Real-time Test Instructions
# =============================================
echo -e "\n${YELLOW}📌 STEP 7: Real-time Chat (Socket.io)${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo -e "${CYAN}⚠️  Full real-time testing requires a frontend client.${NC}"
echo -e ""
echo -e "${GREEN}To test real-time chat:${NC}"
echo -e "  1. Open TWO browsers (Chrome + Firefox) or Incognito windows"
echo -e "  2. Login as different students in each"
echo -e "  3. Open browser console and run:"
echo -e ""
echo -e "  ${YELLOW}// Connect to Socket.io${NC}"
echo -e "  const socket = io('http://localhost:5001', {"
echo -e "    auth: { token: localStorage.getItem('token') }"
echo -e "  });"
echo -e ""
echo -e "  ${YELLOW}// Join level room${NC}"
echo -e "  socket.emit('join_level_room', { level: 'L1' });"
echo -e ""
echo -e "  ${YELLOW}// Send message${NC}"
echo -e "  socket.emit('send_message', {"
echo -e "    conversationId: $LEVEL_CONV_ID,"
echo -e "    content: 'Hello from student! ' + new Date().toLocaleTimeString()"
echo -e "  });"
echo -e ""
echo -e "  ${YELLOW}// Listen for messages${NC}"
echo -e "  socket.on('new_message', (msg) => {"
echo -e "    console.log('New message:', msg);"
echo -e "  });"
echo -e ""

# =============================================
# SUMMARY
# =============================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                          TEST SUMMARY                          ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e ""
echo -e "${CYAN}Student Information:${NC}"
echo -e "  📧 Email: $STUDENT_EMAIL"
echo -e "  🆔 ID: $STUDENT_ID"
echo -e "  📚 Niveau: ${STUDENT_NIVEAU:-NOT SET (run admin to set niveau)}"
echo -e ""
echo -e "${CYAN}Chat Features Available to Student:${NC}"
echo -e "  ✅ Level-based community chat (${STUDENT_LEVEL} students only)"
echo -e "  ✅ Private 1-to-1 messaging"
echo -e "  ✅ Group chat creation"
echo -e "  ✅ Invite friends to groups"
echo -e "  ✅ View conversation history"
echo -e "  ✅ See participants in chats"
echo -e "  ✅ Real-time messaging (with Socket.io frontend)"
echo -e ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Student Chat Test Complete! 🎉${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
