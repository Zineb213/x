#!/bin/bash

echo "========================================="
echo "Testing Educational Platform API"
echo "========================================="

# 1. Login
echo -e "\n1. Login as Admin..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"matricule":"ADMIN001","password":"Admin123!"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get token"
    exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:50}..."

# 2. Get stats
echo -e "\n2. Getting statistics..."
curl -s -X GET http://localhost:5001/api/admin/stats \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 3. Create a module
echo -e "\n3. Creating a new module..."
curl -s -X POST http://localhost:5001/api/admin/modules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "L1-INFO-999",
    "nom": "Test Module",
    "description": "Module for testing",
    "niveau": "L1",
    "credits": 6,
    "coeff": 2.0
  }' | jq '.'

# 4. Create a formateur
echo -e "\n4. Creating a formateur..."
curl -s -X POST http://localhost:5001/api/admin/formateurs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.formateur@eduplatform.com",
    "nom": "Test",
    "prenom": "Formateur",
    "password": "Test123!"
  }' | jq '.'

echo -e "\n✅ All tests completed!"
