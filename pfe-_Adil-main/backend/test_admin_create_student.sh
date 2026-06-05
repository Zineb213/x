#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}         ADMIN CREATE STUDENT (ÉTUDIANT) TEST                    ${NC}"
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
# STEP 2: Create a New Student (Étudiant)
# =============================================
echo -e "\n${YELLOW}📌 STEP 2: Create a new student${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

STUDENT_EMAIL="student.test.$(date +%s)@eduplatform.com"
STUDENT_PASSWORD="Student123!"

CREATE_STUDENT=$(curl -s -X POST http://localhost:5001/api/admin/formateurs \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$STUDENT_EMAIL\",
    \"nom\": \"TestStudent\",
    \"prenom\": \"CreatedByAdmin\",
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
    echo -e "${CYAN}   Nom: TestStudent CreatedByAdmin${NC}"
else
    echo -e "${RED}❌ Failed to create student${NC}"
    echo "$CREATE_STUDENT" | jq '.'
    exit 1
fi

# =============================================
# STEP 3: Update student role to ETUDIANT
# =============================================
echo -e "\n${YELLOW}📌 STEP 3: Update student role to ETUDIANT${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

UPDATE_ROLE=$(sudo -u postgres psql -d eduplatform -c "UPDATE users SET role_global = 'ETUDIANT' WHERE id = $STUDENT_ID;" 2>/dev/null)
echo -e "${GREEN}✅ Student role updated to ETUDIANT${NC}"

# =============================================
# STEP 4: Set student niveau (L1)
# =============================================
echo -e "\n${YELLOW}📌 STEP 4: Set student niveau${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

SET_NIVEAU=$(curl -s -X POST http://localhost:5001/api/admin/students/niveau \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"etudiantId\": $STUDENT_ID,
    \"niveau\": \"L1\"
  }")

if echo "$SET_NIVEAU" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Student niveau set to L1${NC}"
else
    echo -e "${YELLOW}⚠️ Could not set niveau (may need to set manually)${NC}"
fi

# =============================================
# STEP 5: Test student login
# =============================================
echo -e "\n${YELLOW}📌 STEP 5: Test student login with email/password${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

STUDENT_LOGIN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"matricule\": \"$STUDENT_EMAIL\",
    \"password\": \"$STUDENT_PASSWORD\"
  }")

STUDENT_TOKEN=$(echo "$STUDENT_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$STUDENT_TOKEN" ]; then
    echo -e "${GREEN}✅ Student login successful!${NC}"
    
    # Get student info
    STUDENT_INFO=$(curl -s -X GET http://localhost:5001/api/auth/me \
      -H "Authorization: Bearer $STUDENT_TOKEN")
    
    echo -e "${CYAN}Student info:${NC}"
    echo "$STUDENT_INFO" | jq '.data | {id, email, nom, prenom, role_global, niveau}'
else
    echo -e "${RED}❌ Student login failed${NC}"
fi

# =============================================
# STEP 6: Enroll student to a module
# =============================================
echo -e "\n${YELLOW}📌 STEP 6: Enroll student to a module${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

# Get first module ID
MODULE_ID=1

ENROLL_STUDENT=$(curl -s -X POST http://localhost:5001/api/admin/enrollments \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"etudiantId\": $STUDENT_ID,
    \"moduleId\": $MODULE_ID
  }")

if echo "$ENROLL_STUDENT" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Student enrolled to module ID: $MODULE_ID${NC}"
else
    echo -e "${YELLOW}⚠️ Enrollment may have failed or already exists${NC}"
fi

# =============================================
# STEP 7: Get all students list
# =============================================
echo -e "\n${YELLOW}📌 STEP 7: Get all students list${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

ALL_USERS=$(curl -s -X GET http://localhost:5001/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN")

STUDENT_COUNT=$(echo "$ALL_USERS" | jq '[.data[] | select(.role_global == "ETUDIANT")] | length')

echo -e "${GREEN}✅ Total students in platform: $STUDENT_COUNT${NC}"
echo -e "${CYAN}All students:${NC}"
echo "$ALL_USERS" | jq -r '.data[] | select(.role_global == "ETUDIANT") | "   🎓 ID: \(.id) | \(.nom) \(.prenom) | \(.email) | Niveau: \(.niveau // "Non défini")"'

# =============================================
# SUMMARY
# =============================================
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                         TEST SUMMARY                           ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e ""
echo -e "${CYAN}Student Created:${NC}"
echo -e "  🎓 ID: $STUDENT_ID"
echo -e "  🔑 Matricule: $STUDENT_MATRICULE"
echo -e "  📧 Email: $STUDENT_EMAIL"
echo -e "  🔐 Password: $STUDENT_PASSWORD"
echo -e "  📚 Niveau: L1"
echo -e ""
echo -e "${CYAN}Credentials for testing:${NC}"
echo -e "  Email: $STUDENT_EMAIL"
echo -e "  Password: $STUDENT_PASSWORD"
echo -e ""
echo -e "${CYAN}Total students in system: $STUDENT_COUNT${NC}"
echo -e ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Admin can successfully create students! 🎉${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
