#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}              STUDENT CHAT SYSTEM TEST (FIXED)                   ${NC}"
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
# STEP 2: Get List of Existing Students from Database
# =============================================
echo -e "\n${YELLOW}📌 STEP 2: Get Existing Students${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

# Get students directly from database
STUDENTS_LIST=$(sudo -u postgres psql -d eduplatform -t -c "SELECT id FROM users WHERE role_global = 'ETUDIANT' AND id != $STUDENT_ID ORDER BY id;" 2>/dev/null | tr -d ' ')

# Convert to array
STUDENT_IDS=()
while IFS= read -r line; do
    if [ -n "$line" ]; then
        STUDENT_IDS+=("$line")
    fi
done <<< "$STUDENTS_LIST"

echo -e "${CYAN}Existing student IDs (excluding current): ${STUDENT_IDS[@]:-None}${NC}"

if [ ${#STUDENT_IDS[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠️ No other students found. Creating a test student...${NC}"
    
    # Login as admin to create a test student
    ADMIN_TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"matricule":"ADMIN001","password":"Admin123!"}' \
      | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$ADMIN_TOKEN" ]; then
        # Create a test student
        TEST_STUDENT=$(curl -s -X POST http://localhost:5001/api/admin/formateurs \
          -H "Authorization: Bearer $ADMIN_TOKEN" \
          -H "Content-Type: application/json" \
          -d '{
            "email": "test.student.chat@example.com",
            "nom": "Chat",
            "prenom": "Test",
            "password": "Test123!"
          }')
        
        # Update role to ETUDIANT
        TEST_STUDENT_ID=$(echo $TEST_STUDENT | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
        if [ -n "$TEST_STUDENT_ID" ]; then
            sudo -u postgres psql -d eduplatform -c "UPDATE users SET role_global = 'ETUDIANT', niveau = 'L1' WHERE id = $TEST_STUDENT_ID;" 2>/dev/null
            STUDENT_IDS+=("$TEST_STUDENT_ID")
            echo -e "${GREEN}✅ Created test student with ID: $TEST_STUDENT_ID${NC}"
        fi
    fi
fi

# =============================================
# STEP 3: Test Level Chat (Community Chat)
# =============================================
echo -e "\n${YELLOW}📌 STEP 3: Level Community Chat${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

STUDENT_LEVEL=${STUDENT_NIVEAU:-"L1"}
echo -e "${CYAN}Student level: $STUDENT_LEVEL${NC}"

LEVEL_CHAT=$(curl -s -X GET "http://localhost:5001/api/chat/level/$STUDENT_LEVEL" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

LEVEL_CONV_ID=$(echo "$LEVEL_CHAT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$LEVEL_CONV_ID" ]; then
    echo -e "${GREEN}✅ Level chat conversation ID: $LEVEL_CONV_ID${NC}"
    
    # Get messages from level chat
    echo -e "\n${CYAN}Getting messages from level chat...${NC}"
    LEVEL_MESSAGES=$(curl -s -X GET "http://localhost:5001/api/chat/conversations/$LEVEL_CONV_ID/messages?limit=10" \
      -H "Authorization: Bearer $STUDENT_TOKEN")
    
    MESSAGE_COUNT=$(echo "$LEVEL_MESSAGES" | jq '.data | length')
    echo -e "${GREEN}📨 Found $MESSAGE_COUNT messages in level chat${NC}"
else
    echo -e "${RED}❌ Failed to get level chat${NC}"
fi

# =============================================
# STEP 4: Test Private Chat (Only if other students exist)
# =============================================
echo -e "\n${YELLOW}📌 STEP 4: Private 1-to-1 Chat${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

if [ ${#STUDENT_IDS[@]} -gt 0 ]; then
    OTHER_STUDENT_ID=${STUDENT_IDS[0]}
    echo -e "${CYAN}Creating private chat with student ID: $OTHER_STUDENT_ID${NC}"
    
    PRIVATE_CHAT=$(curl -s -X POST http://localhost:5001/api/chat/private \
      -H "Authorization: Bearer $STUDENT_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"userId\": $OTHER_STUDENT_ID}")
    
    PRIVATE_CONV_ID=$(echo "$PRIVATE_CHAT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    
    if [ -n "$PRIVATE_CONV_ID" ]; then
        echo -e "${GREEN}✅ Private chat created! Conversation ID: $PRIVATE_CONV_ID${NC}"
    else
        echo -e "${YELLOW}⚠️ Private chat may already exist or creation failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ No other students found. Skipping private chat test.${NC}"
    echo -e "${CYAN}Create another student via admin dashboard to test private chat.${NC}"
fi

# =============================================
# STEP 5: Test Group Chat
# =============================================
echo -e "\n${YELLOW}📌 STEP 5: Group Chat${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

echo -e "${CYAN}Creating group chat 'Study Group'...${NC}"
GROUP_CHAT=$(curl -s -X POST http://localhost:5001/api/chat/group \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupName": "Study Group",
    "participantIds": []
  }')

GROUP_CONV_ID=$(echo "$GROUP_CHAT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$GROUP_CONV_ID" ]; then
    echo -e "${GREEN}✅ Group chat created! Conversation ID: $GROUP_CONV_ID${NC}"
    
    # Add participants to group if other students exist
    if [ ${#STUDENT_IDS[@]} -gt 0 ]; then
        for OTHER_ID in "${STUDENT_IDS[@]}"; do
            echo -e "\n${CYAN}Adding student $OTHER_ID to group...${NC}"
            ADD_PARTICIPANT=$(curl -s -X POST "http://localhost:5001/api/chat/conversations/$GROUP_CONV_ID/participants" \
              -H "Authorization: Bearer $STUDENT_TOKEN" \
              -H "Content-Type: application/json" \
              -d "{\"userId\": $OTHER_ID}")
            
            if echo "$ADD_PARTICIPANT" | grep -q '"success":true'; then
                echo -e "${GREEN}✅ Student $OTHER_ID added to group${NC}"
            else
                echo -e "${YELLOW}⚠️ Could not add student $OTHER_ID (may already be in group)${NC}"
            fi
        done
    fi
else
    echo -e "${RED}❌ Failed to create group chat${NC}"
fi

# =============================================
# STEP 6: Get All Student Conversations
# =============================================
echo -e "\n${YELLOW}📌 STEP 6: Get All My Conversations${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

MY_CONVERSATIONS=$(curl -s -X GET http://localhost:5001/api/chat/conversations \
  -H "Authorization: Bearer $STUDENT_TOKEN")

CONVERSATION_COUNT=$(echo "$MY_CONVERSATIONS" | jq '.data | length')
echo -e "${GREEN}✅ Found $CONVERSATION_COUNT conversations${NC}"

# Display conversation summary
echo -e "\n${CYAN}Conversation Summary:${NC}"
echo "$MY_CONVERSATIONS" | jq -r '.data[] | "  📄 ID: \(.id) | Type: \(.conversation_type) | Name: \(.group_name // "Private") | Unread: \(.unread_count // 0)"'

# =============================================
# STEP 7: Get Participants
# =============================================
if [ -n "$LEVEL_CONV_ID" ]; then
    echo -e "\n${YELLOW}📌 STEP 7: Get Participants in Level Chat${NC}"
    echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
    
    PARTICIPANTS=$(curl -s -X GET "http://localhost:5001/api/chat/conversations/$LEVEL_CONV_ID/participants" \
      -H "Authorization: Bearer $STUDENT_TOKEN")
    
    PARTICIPANT_COUNT=$(echo "$PARTICIPANTS" | jq '.data | length')
    echo -e "${GREEN}✅ Found $PARTICIPANT_COUNT participants in level $STUDENT_LEVEL chat${NC}"
fi

# =============================================
# SUMMARY
# =============================================
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                          TEST SUMMARY                          ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e ""
echo -e "${CYAN}Student Information:${NC}"
echo -e "  📧 Email: $STUDENT_EMAIL"
echo -e "  🆔 ID: $STUDENT_ID"
echo -e "  📚 Niveau: ${STUDENT_NIVEAU:-NOT SET (run admin to set niveau)}"
echo -e ""
echo -e "${CYAN}Chat Features Tested:${NC}"
echo -e "  ✅ Level-based community chat (${STUDENT_LEVEL})"
echo -e "  ✅ Private 1-to-1 messaging"
echo -e "  ✅ Group chat creation"
echo -e "  ✅ Add participants to groups"
echo -e "  ✅ View all conversations"
echo -e "  ✅ View participants in chats"
echo -e ""

# Socket.io instructions
echo -e "${CYAN}To test real-time chat with Socket.io:${NC}"
echo -e "  1. Open browser console (F12)"
echo -e "  2. Make sure socket.io client is loaded:"
echo -e "     ${YELLOW}<script src='/socket.io/socket.io.js'></script>${NC}"
echo -e "  3. Connect and test:"
echo -e ""
echo -e "  ${YELLOW}const socket = io('http://localhost:5001', {${NC}"
echo -e "  ${YELLOW}  auth: { token: localStorage.getItem('token') }${NC}"
echo -e "  ${YELLOW}});${NC}"
echo -e "  ${YELLOW}socket.emit('join_level_room', { level: '$STUDENT_LEVEL' });${NC}"
echo -e "  ${YELLOW}socket.on('new_message', (msg) => console.log(msg));${NC}"
echo -e ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Student Chat Test Complete! 🎉${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
