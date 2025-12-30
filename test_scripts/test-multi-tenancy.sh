#!/bin/bash

# Test script for Multi-Tenancy Security (Phase 4)
# Verifies that organizations cannot access each other's data

BASE_URL="http://localhost:8000/api"

echo "=========================================="
echo "Testing Multi-Tenancy Security (Phase 4)"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_TOTAL=0

run_test() {
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo "Test $TESTS_TOTAL: $1"
}

test_passed() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}✓ PASSED${NC}"
    echo ""
}

test_failed() {
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $1"
    echo ""
}

cleanup() {
    echo "Cleaning up..."
}

trap cleanup EXIT

TIMESTAMP=$(date +%s)

# Test 1: Create Organization A
run_test "Create Organization A"
ORG_A_RESPONSE=$(curl -s -X POST "$BASE_URL/organizations" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Organization A"
  }')

ORG_A_ID=$(echo $ORG_A_RESPONSE | grep -o '"id":"[^"]*' | grep -o '[^"]*$')
if [ -n "$ORG_A_ID" ]; then
    echo "Organization A created: $ORG_A_ID"
    test_passed
else
    test_failed "$ORG_A_RESPONSE"
    exit 1
fi

# Test 2: Create Organization B
run_test "Create Organization B"
ORG_B_RESPONSE=$(curl -s -X POST "$BASE_URL/organizations" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Organization B"
  }')

ORG_B_ID=$(echo $ORG_B_RESPONSE | grep -o '"id":"[^"]*' | grep -o '[^"]*$')
if [ -n "$ORG_B_ID" ] && [ "$ORG_B_ID" != "$ORG_A_ID" ]; then
    echo "Organization B created: $ORG_B_ID"
    test_passed
else
    test_failed "$ORG_B_RESPONSE"
    exit 1
fi

# Test 3: Create User in Organization A
run_test "Create User in Organization A"
USER_A_RESPONSE=$(curl -s -X POST "$BASE_URL/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "userA'$TIMESTAMP'@test.com",
    "password": "password123",
    "fullName": "User A",
    "organizationId": "'$ORG_A_ID'"
  }')

USER_A_ID=$(echo $USER_A_RESPONSE | grep -o '"userId":"[^"]*' | grep -o '[^"]*$')
if [ -n "$USER_A_ID" ]; then
    echo "User A created: $USER_A_ID"
    test_passed
else
    test_failed "$USER_A_RESPONSE"
    exit 1
fi

# Test 4: Create User in Organization B
run_test "Create User in Organization B"
USER_B_RESPONSE=$(curl -s -X POST "$BASE_URL/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "userB'$TIMESTAMP'@test.com",
    "password": "password123",
    "fullName": "User B",
    "organizationId": "'$ORG_B_ID'"
  }')

USER_B_ID=$(echo $USER_B_RESPONSE | grep -o '"userId":"[^"]*' | grep -o '[^"]*$')
if [ -n "$USER_B_ID" ]; then
    echo "User B created: $USER_B_ID"
    test_passed
else
    test_failed "$USER_B_RESPONSE"
    exit 1
fi

# Test 5: Login User A
run_test "Login User A"
LOGIN_A_RESPONSE=$(curl -s -X POST "$BASE_URL/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "userA'$TIMESTAMP'@test.com",
    "password": "password123"
  }')

TOKEN_A=$(echo $LOGIN_A_RESPONSE | grep -o '"access_token":"[^"]*' | grep -o '[^"]*$')
if [ -n "$TOKEN_A" ]; then
    echo "User A logged in successfully"
    test_passed
else
    test_failed "$LOGIN_A_RESPONSE"
    exit 1
fi

# Test 6: Login User B
run_test "Login User B"
LOGIN_B_RESPONSE=$(curl -s -X POST "$BASE_URL/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "userB'$TIMESTAMP'@test.com",
    "password": "password123"
  }')

TOKEN_B=$(echo $LOGIN_B_RESPONSE | grep -o '"access_token":"[^"]*' | grep -o '[^"]*$')
if [ -n "$TOKEN_B" ]; then
    echo "User B logged in successfully"
    test_passed
else
    test_failed "$LOGIN_B_RESPONSE"
    exit 1
fi

# Test 7: User A creates a list in Org A
run_test "User A creates a list"
LIST_A_RESPONSE=$(curl -s -X POST "$BASE_URL/lists" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d '{
    "name": "List from Org A",
    "organizationId": "'$ORG_A_ID'"
  }')

LIST_A_ID=$(echo "$LIST_A_RESPONSE" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | tail -1)
if [ -n "$LIST_A_ID" ] && [ "$LIST_A_ID" != "$ORG_A_ID" ]; then
    echo "List A created: $LIST_A_ID"
    test_passed
else
    test_failed "$LIST_A_RESPONSE"
    exit 1
fi

# Test 8: User B creates a list in Org B
run_test "User B creates a list"
LIST_B_RESPONSE=$(curl -s -X POST "$BASE_URL/lists" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d '{
    "name": "List from Org B",
    "organizationId": "'$ORG_B_ID'"
  }')

LIST_B_ID=$(echo "$LIST_B_RESPONSE" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | tail -1)
if [ -n "$LIST_B_ID" ] && [ "$LIST_B_ID" != "$ORG_B_ID" ] && [ "$LIST_B_ID" != "$LIST_A_ID" ]; then
    echo "List B created: $LIST_B_ID"
    test_passed
else
    test_failed "$LIST_B_RESPONSE"
    exit 1
fi

# Test 9: User A fetches lists (should only see Org A lists)
run_test "User A fetches lists (should only see Org A)"
LISTS_A_RESPONSE=$(curl -s -X GET "$BASE_URL/lists" \
  -H "Authorization: Bearer $TOKEN_A")

if echo "$LISTS_A_RESPONSE" | grep -q "$LIST_A_ID"; then
    echo "✓ User A can see their own list"
else
    echo "✗ User A cannot see their own list"
    test_failed "$LISTS_A_RESPONSE"
    exit 1
fi

if echo "$LISTS_A_RESPONSE" | grep -q "$LIST_B_ID"; then
    echo "✗ SECURITY VIOLATION: User A can see Org B's list!"
    test_failed "$LISTS_A_RESPONSE"
    exit 1
else
    echo "✓ User A cannot see Org B's list (correct)"
    test_passed
fi

# Test 10: User B fetches lists (should only see Org B lists)
run_test "User B fetches lists (should only see Org B)"
LISTS_B_RESPONSE=$(curl -s -X GET "$BASE_URL/lists" \
  -H "Authorization: Bearer $TOKEN_B")

if echo "$LISTS_B_RESPONSE" | grep -q "$LIST_B_ID"; then
    echo "✓ User B can see their own list"
else
    echo "✗ User B cannot see their own list"
    test_failed "$LISTS_B_RESPONSE"
    exit 1
fi

if echo "$LISTS_B_RESPONSE" | grep -q "$LIST_A_ID"; then
    echo "✗ SECURITY VIOLATION: User B can see Org A's list!"
    test_failed "$LISTS_B_RESPONSE"
    exit 1
else
    echo "✓ User B cannot see Org A's list (correct)"
    test_passed
fi

# Test 11: User A creates subscriber in Org A
run_test "User A creates subscriber"
SUB_A_RESPONSE=$(curl -s -X POST "$BASE_URL/subscribers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d '{
    "email": "subA'$TIMESTAMP'@test.com",
    "organizationId": "'$ORG_A_ID'",
    "customFields": {
      "company": "Company A"
    }
  }')

SUB_A_ID=$(echo "$SUB_A_RESPONSE" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | head -1)
if [ -n "$SUB_A_ID" ]; then
    echo "Subscriber A created: $SUB_A_ID"
    test_passed
else
    test_failed "$SUB_A_RESPONSE"
    exit 1
fi

# Test 12: User B creates subscriber in Org B
run_test "User B creates subscriber"
SUB_B_RESPONSE=$(curl -s -X POST "$BASE_URL/subscribers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d '{
    "email": "subB'$TIMESTAMP'@test.com",
    "organizationId": "'$ORG_B_ID'",
    "customFields": {
      "company": "Company B"
    }
  }')

SUB_B_ID=$(echo "$SUB_B_RESPONSE" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | head -1)
if [ -n "$SUB_B_ID" ]; then
    echo "Subscriber B created: $SUB_B_ID"
    test_passed
else
    test_failed "$SUB_B_RESPONSE"
    exit 1
fi

# Test 13: User A fetches subscribers (should only see Org A)
run_test "User A fetches subscribers (should only see Org A)"
SUBS_A_RESPONSE=$(curl -s -X GET "$BASE_URL/subscribers?page=1&limit=50" \
  -H "Authorization: Bearer $TOKEN_A")

if echo "$SUBS_A_RESPONSE" | grep -q "subA$TIMESTAMP"; then
    echo "✓ User A can see their own subscriber"
else
    echo "✗ User A cannot see their own subscriber"
    test_failed "$SUBS_A_RESPONSE"
    exit 1
fi

if echo "$SUBS_A_RESPONSE" | grep -q "subB$TIMESTAMP"; then
    echo "✗ SECURITY VIOLATION: User A can see Org B's subscriber!"
    test_failed "$SUBS_A_RESPONSE"
    exit 1
else
    echo "✓ User A cannot see Org B's subscriber (correct)"
    test_passed
fi

# Test 14: User B tries to update User A's list (should fail)
run_test "User B tries to update User A's list (should fail)"
UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/lists/$LIST_A_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d '{
    "name": "Hacked List from Org A"
  }')

HTTP_CODE=$(echo "$UPDATE_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "404" ]; then
    echo "✓ User B cannot update Org A's list (404 Not Found)"
    test_passed
else
    echo "✗ SECURITY VIOLATION: User B was able to update Org A's list (HTTP $HTTP_CODE)"
    test_failed "$UPDATE_RESPONSE"
    exit 1
fi

# Test 15: User A creates campaign
run_test "User A creates campaign"
CAMPAIGN_A_RESPONSE=$(curl -s -X POST "$BASE_URL/campaigns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d '{
    "subject": "Campaign from Org A",
    "content": "This is from Organization A",
    "listId": "'$LIST_A_ID'",
    "organizationId": "'$ORG_A_ID'"
  }')

CAMPAIGN_A_ID=$(echo "$CAMPAIGN_A_RESPONSE" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | head -1)
if [ -n "$CAMPAIGN_A_ID" ]; then
    echo "Campaign A created: $CAMPAIGN_A_ID"
    test_passed
else
    test_failed "$CAMPAIGN_A_RESPONSE"
    exit 1
fi

# Test 16: User B tries to create campaign with Org A's list (should fail)
run_test "User B tries to use Org A's list in campaign (should fail)"
CAMPAIGN_HACK_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/campaigns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d '{
    "subject": "Hacked Campaign",
    "content": "Trying to use Org A list",
    "listId": "'$LIST_A_ID'",
    "organizationId": "'$ORG_B_ID'"
  }')

HTTP_CODE=$(echo "$CAMPAIGN_HACK_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$CAMPAIGN_HACK_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "404" ] || echo "$RESPONSE_BODY" | grep -q "not found"; then
    echo "✓ User B cannot create campaign with Org A's list"
    test_passed
else
    echo "✗ SECURITY VIOLATION: User B created campaign with Org A's list (HTTP $HTTP_CODE)"
    test_failed "$CAMPAIGN_HACK_RESPONSE"
    exit 1
fi

# Test 17: User A fetches campaigns (should only see Org A)
run_test "User A fetches campaigns (should only see Org A)"
CAMPAIGNS_A_RESPONSE=$(curl -s -X GET "$BASE_URL/campaigns" \
  -H "Authorization: Bearer $TOKEN_A")

if echo "$CAMPAIGNS_A_RESPONSE" | grep -q "$CAMPAIGN_A_ID"; then
    echo "✓ User A can see their own campaign"
    test_passed
else
    echo "✗ User A cannot see their own campaign"
    test_failed "$CAMPAIGNS_A_RESPONSE"
    exit 1
fi

echo "=========================================="
echo "All Tests Completed!"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED / $TESTS_TOTAL${NC}"
echo ""

if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
    echo -e "${GREEN}✓ All multi-tenancy security tests passed!${NC}"
    echo "Phase 4: Multi-Tenancy Security - COMPLETE"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
