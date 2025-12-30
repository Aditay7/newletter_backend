#!/bin/bash

# Test script for list privacy (Phase 2)
# Verifies that lists are private to users

BASE_URL="http://localhost:8000/api"

echo "=========================================="
echo "Testing List Privacy (Phase 2)"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_TOTAL=0

# Function to run a test
run_test() {
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo "Test $TESTS_TOTAL: $1"
}

# Function to mark test as passed
test_passed() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}✓ PASSED${NC}"
    echo ""
}

# Function to mark test as failed
test_failed() {
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $1"
    echo ""
}

# Clean up function
cleanup() {
    echo "Cleaning up..."
}

trap cleanup EXIT

# Generate unique timestamp for this test run
TIMESTAMP=$(date +%s)

# Test 1: Create organization
run_test "Create organization"
ORG_RESPONSE=$(curl -s -X POST "$BASE_URL/organizations" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Org Privacy"
  }')

ORG_ID=$(echo $ORG_RESPONSE | grep -o '"id":"[^"]*' | grep -o '[^"]*$')
if [ -n "$ORG_ID" ]; then
    echo "Organization created: $ORG_ID"
    test_passed
else
    test_failed "$ORG_RESPONSE"
    exit 1
fi

# Test 2: Create User 1
run_test "Create User 1"
USER1_RESPONSE=$(curl -s -X POST "$BASE_URL/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user1privacy'$TIMESTAMP'@test.com",
    "password": "password123",
    "fullName": "User One",
    "organizationId": "'$ORG_ID'"
  }')

USER1_ID=$(echo $USER1_RESPONSE | grep -o '"userId":"[^"]*' | grep -o '[^"]*$')
if [ -n "$USER1_ID" ]; then
    echo "User 1 created: $USER1_ID"
    test_passed
else
    test_failed "$USER1_RESPONSE"
    exit 1
fi

# Test 3: Create User 2
run_test "Create User 2"
USER2_RESPONSE=$(curl -s -X POST "$BASE_URL/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user2privacy'$TIMESTAMP'@test.com",
    "password": "password123",
    "fullName": "User Two",
    "organizationId": "'$ORG_ID'"
  }')

USER2_ID=$(echo $USER2_RESPONSE | grep -o '"userId":"[^"]*' | grep -o '[^"]*$')
if [ -n "$USER2_ID" ]; then
    echo "User 2 created: $USER2_ID"
    test_passed
else
    test_failed "$USER2_RESPONSE"
    exit 1
fi

# Test 4: Login User 1
run_test "Login User 1"
LOGIN1_RESPONSE=$(curl -s -X POST "$BASE_URL/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user1privacy'$TIMESTAMP'@test.com",
    "password": "password123"
  }')

TOKEN1=$(echo $LOGIN1_RESPONSE | grep -o '"access_token":"[^"]*' | grep -o '[^"]*$')
if [ -n "$TOKEN1" ]; then
    echo "User 1 logged in successfully"
    test_passed
else
    test_failed "$LOGIN1_RESPONSE"
    exit 1
fi

# Test 5: Login User 2
run_test "Login User 2"
LOGIN2_RESPONSE=$(curl -s -X POST "$BASE_URL/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user2privacy'$TIMESTAMP'@test.com",
    "password": "password123"
  }')

TOKEN2=$(echo $LOGIN2_RESPONSE | grep -o '"access_token":"[^"]*' | grep -o '[^"]*$')
if [ -n "$TOKEN2" ]; then
    echo "User 2 logged in successfully"
    test_passed
else
    test_failed "$LOGIN2_RESPONSE"
    exit 1
fi

# Test 6: User 1 creates a list
run_test "User 1 creates a list"
LIST1_RESPONSE=$(curl -s -X POST "$BASE_URL/lists" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d '{
    "name": "User 1 Private List",
    "organizationId": "'$ORG_ID'"
  }')

# Extract the last UUID which should be the list ID (it comes at the end before createdAt)
LIST1_ID=$(echo "$LIST1_RESPONSE" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | tail -1)
if [ -n "$LIST1_ID" ] && [ "$LIST1_ID" != "$ORG_ID" ] && [ "$LIST1_ID" != "$USER1_ID" ]; then
    echo "User 1 list created: $LIST1_ID"
    test_passed
else
    test_failed "$LIST1_RESPONSE"
    exit 1
fi

# Test 7: User 2 creates a list
run_test "User 2 creates a list"
LIST2_RESPONSE=$(curl -s -X POST "$BASE_URL/lists" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN2" \
  -d '{
    "name": "User 2 Private List",
    "organizationId": "'$ORG_ID'"
  }')

# Extract the last UUID which should be the list ID
LIST2_ID=$(echo "$LIST2_RESPONSE" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | tail -1)
if [ -n "$LIST2_ID" ] && [ "$LIST2_ID" != "$ORG_ID" ] && [ "$LIST2_ID" != "$USER2_ID" ] && [ "$LIST2_ID" != "$LIST1_ID" ]; then
    echo "User 2 list created: $LIST2_ID"
    test_passed
else
    test_failed "$LIST2_RESPONSE"
    exit 1
fi

# Test 8: User 1 fetches all lists (should only see their own)
run_test "User 1 fetches all lists (should only see their own)"
LISTS1_RESPONSE=$(curl -s -X GET "$BASE_URL/lists" \
  -H "Authorization: Bearer $TOKEN1")

# Check if User 1 can see their list
if echo "$LISTS1_RESPONSE" | grep -q "$LIST1_ID"; then
    echo "✓ User 1 can see their own list"
else
    echo "✗ User 1 cannot see their own list"
    test_failed "$LISTS1_RESPONSE"
    exit 1
fi

# Check if User 1 CANNOT see User 2's list
if echo "$LISTS1_RESPONSE" | grep -q "$LIST2_ID"; then
    echo "✗ User 1 can see User 2's list (PRIVACY VIOLATION)"
    test_failed "$LISTS1_RESPONSE"
    exit 1
else
    echo "✓ User 1 cannot see User 2's list (correct)"
    test_passed
fi

# Test 9: User 2 fetches all lists (should only see their own)
run_test "User 2 fetches all lists (should only see their own)"
LISTS2_RESPONSE=$(curl -s -X GET "$BASE_URL/lists" \
  -H "Authorization: Bearer $TOKEN2")

# Check if User 2 can see their list
if echo "$LISTS2_RESPONSE" | grep -q "$LIST2_ID"; then
    echo "✓ User 2 can see their own list"
else
    echo "✗ User 2 cannot see their own list"
    test_failed "$LISTS2_RESPONSE"
    exit 1
fi

# Check if User 2 CANNOT see User 1's list
if echo "$LISTS2_RESPONSE" | grep -q "$LIST1_ID"; then
    echo "✗ User 2 can see User 1's list (PRIVACY VIOLATION)"
    test_failed "$LISTS2_RESPONSE"
    exit 1
else
    echo "✓ User 2 cannot see User 1's list (correct)"
    test_passed
fi

# Test 10: User 2 tries to update User 1's list (should fail)
run_test "User 2 tries to update User 1's list (should fail)"
UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/lists/$LIST1_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN2" \
  -d '{
    "name": "Hacked List Name"
  }')

HTTP_CODE=$(echo "$UPDATE_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "404" ]; then
    echo "✓ User 2 cannot update User 1's list (404 Not Found)"
    test_passed
else
    echo "✗ User 2 was able to update User 1's list (HTTP $HTTP_CODE)"
    test_failed "$UPDATE_RESPONSE"
    exit 1
fi

# Test 11: User 1 updates their own list (should succeed)
run_test "User 1 updates their own list (should succeed)"
UPDATE1_RESPONSE=$(curl -s -X PUT "$BASE_URL/lists/$LIST1_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d '{
    "name": "User 1 Updated List"
  }')

if echo "$UPDATE1_RESPONSE" | grep -q "User 1 Updated List"; then
    echo "✓ User 1 successfully updated their own list"
    test_passed
else
    test_failed "$UPDATE1_RESPONSE"
    exit 1
fi

echo "=========================================="
echo "All Tests Completed!"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED / $TESTS_TOTAL${NC}"
echo ""

if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
    echo -e "${GREEN}✓ All list privacy tests passed!${NC}"
    echo "Phase 2: Private Lists - COMPLETE"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
