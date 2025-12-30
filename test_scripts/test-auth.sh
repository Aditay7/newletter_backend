#!/bin/bash

echo "================================"
echo "🧪 AUTHENTICATION TEST SUITE"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAILED++))
}

info() {
    echo -e "${YELLOW}ℹ INFO${NC}: $1"
}

echo "Step 1: Create Organization"
echo "----------------------------"
ORG_RESPONSE=$(curl -s -X POST http://localhost:8000/api/organizations \
  -H "Content-Type: application/json" \
  -d '{"name":"TestCompany"}')

ORG_ID=$(echo $ORG_RESPONSE | jq -r '.id' 2>/dev/null)

if [ "$ORG_ID" != "null" ] && [ "$ORG_ID" != "" ]; then
    pass "Organization created with ID: $ORG_ID"
else
    fail "Failed to create organization"
    echo "Response: $ORG_RESPONSE"
    exit 1
fi
echo ""

echo "Step 2: Register New User"
echo "----------------------------"
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8000/api/users/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"testuser@example.com\",
    \"fullName\": \"Test User\",
    \"password\": \"password123\",
    \"organizationId\": \"$ORG_ID\"
  }")

USER_ID=$(echo $REGISTER_RESPONSE | jq -r '.userId' 2>/dev/null)

if [ "$USER_ID" != "null" ] && [ "$USER_ID" != "" ]; then
    pass "User registered with ID: $USER_ID"
else
    fail "Failed to register user"
    echo "Response: $REGISTER_RESPONSE"
fi
echo ""

echo "Step 3: Check Password is Hashed in Database"
echo "----------------------------------------------"
DB_PASSWORD=$(psql -d NewsLetter -t -c "SELECT password FROM users WHERE id='$USER_ID';" 2>/dev/null | tr -d ' ')

if [[ $DB_PASSWORD == \$2b\$* ]]; then
    pass "Password is properly hashed (bcrypt)"
    info "Hash starts with: ${DB_PASSWORD:0:20}..."
else
    fail "Password is NOT hashed!"
    echo "Password in DB: $DB_PASSWORD"
fi
echo ""

echo "Step 4: Login with Correct Credentials"
echo "---------------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "password123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token' 2>/dev/null)

if [ "$TOKEN" != "null" ] && [ "$TOKEN" != "" ] && [ ${#TOKEN} -gt 50 ]; then
    pass "Login successful - JWT token received"
    info "Token: ${TOKEN:0:50}..."
else
    fail "Login failed - No JWT token"
    echo "Response: $LOGIN_RESPONSE"
fi
echo ""

echo "Step 5: Login with Wrong Password"
echo "----------------------------------"
WRONG_LOGIN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "wrongpassword"
  }')

ERROR_MSG=$(echo $WRONG_LOGIN | jq -r '.message' 2>/dev/null)

if [[ $ERROR_MSG == *"Invalid"* ]] || [[ $ERROR_MSG == *"Unauthorized"* ]]; then
    pass "Wrong password correctly rejected"
else
    fail "Wrong password was not rejected!"
    echo "Response: $WRONG_LOGIN"
fi
echo ""

echo "Step 6: Access Protected Route WITHOUT Token"
echo "---------------------------------------------"
NO_TOKEN_RESPONSE=$(curl -s http://localhost:8000/api/users/profile/$USER_ID)
NO_TOKEN_STATUS=$(echo $NO_TOKEN_RESPONSE | jq -r '.statusCode' 2>/dev/null)

if [ "$NO_TOKEN_STATUS" == "401" ]; then
    pass "Protected route blocked without token (401 Unauthorized)"
else
    fail "Protected route accessible without token!"
    echo "Response: $NO_TOKEN_RESPONSE"
fi
echo ""

echo "Step 7: Access Protected Route WITH Token"
echo "------------------------------------------"
WITH_TOKEN_RESPONSE=$(curl -s http://localhost:8000/api/users/profile/$USER_ID \
  -H "Authorization: Bearer $TOKEN")

PROFILE_EMAIL=$(echo $WITH_TOKEN_RESPONSE | jq -r '.email' 2>/dev/null)

if [ "$PROFILE_EMAIL" == "testuser@example.com" ]; then
    pass "Protected route accessible with valid token"
else
    fail "Protected route not accessible with token"
    echo "Response: $WITH_TOKEN_RESPONSE"
fi
echo ""

echo "Step 8: Verify JWT Token Structure"
echo "-----------------------------------"
# Decode JWT payload (middle part)
JWT_PAYLOAD=$(echo $TOKEN | cut -d '.' -f 2)
# Add padding if needed
while [ $((${#JWT_PAYLOAD} % 4)) -ne 0 ]; do
    JWT_PAYLOAD="${JWT_PAYLOAD}="
done

DECODED=$(echo $JWT_PAYLOAD | base64 -d 2>/dev/null | jq '.' 2>/dev/null)

if [ $? -eq 0 ]; then
    pass "JWT token is valid and decodable"
    info "Token payload:"
    echo "$DECODED" | jq '{email, sub, role, organizationId}' 2>/dev/null || echo "$DECODED"
else
    fail "JWT token cannot be decoded"
fi
echo ""

echo "================================"
echo "📊 TEST RESULTS SUMMARY"
echo "================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo ""
    echo "✅ Authentication system is working correctly!"
    echo ""
    echo "Next steps:"
    echo "1. Update IMPLEMENTATION_REQUIREMENTS.md"
    echo "2. Mark Chunks 1.1-1.9 as complete"
    echo "3. Move to Phase 2: Private Lists"
    exit 0
else
    echo -e "${RED}⚠️  SOME TESTS FAILED${NC}"
    echo ""
    echo "Please review the failures above and fix them."
    exit 1
fi
