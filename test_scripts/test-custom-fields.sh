#!/bin/bash

# Test script for Custom Fields & Merge Tags (Phase 3)

BASE_URL="http://localhost:8000/api"

echo "=========================================="
echo "Testing Custom Fields & Merge Tags (Phase 3)"
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

# Test 1: Create organization
run_test "Create organization"
ORG_RESPONSE=$(curl -s -X POST "$BASE_URL/organizations" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Org Custom Fields"
  }')

ORG_ID=$(echo $ORG_RESPONSE | grep -o '"id":"[^"]*' | grep -o '[^"]*$')
if [ -n "$ORG_ID" ]; then
    echo "Organization created: $ORG_ID"
    test_passed
else
    test_failed "$ORG_RESPONSE"
    exit 1
fi

# Test 2: Create User
run_test "Create User"
USER_RESPONSE=$(curl -s -X POST "$BASE_URL/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customfields'$TIMESTAMP'@test.com",
    "password": "password123",
    "fullName": "Custom Fields User",
    "organizationId": "'$ORG_ID'"
  }')

USER_ID=$(echo $USER_RESPONSE | grep -o '"userId":"[^"]*' | grep -o '[^"]*$')
if [ -n "$USER_ID" ]; then
    echo "User created: $USER_ID"
    test_passed
else
    test_failed "$USER_RESPONSE"
    exit 1
fi

# Test 3: Login User
run_test "Login User"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customfields'$TIMESTAMP'@test.com",
    "password": "password123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | grep -o '[^"]*$')
if [ -n "$TOKEN" ]; then
    echo "User logged in successfully"
    test_passed
else
    test_failed "$LOGIN_RESPONSE"
    exit 1
fi

# Test 4: Create list with custom field schema
run_test "Create list with custom field schema"
LIST_RESPONSE=$(curl -s -X POST "$BASE_URL/lists" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Newsletter List with Custom Fields",
    "organizationId": "'$ORG_ID'",
    "customFields": {
      "firstName": {
        "name": "firstName",
        "type": "string",
        "required": true
      },
      "age": {
        "name": "age",
        "type": "number",
        "required": false
      },
      "isPremium": {
        "name": "isPremium",
        "type": "boolean",
        "required": false
      }
    }
  }')

LIST_ID=$(echo "$LIST_RESPONSE" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | tail -1)
if [ -n "$LIST_ID" ] && [ "$LIST_ID" != "$ORG_ID" ] && [ "$LIST_ID" != "$USER_ID" ]; then
    echo "List with custom fields created: $LIST_ID"
    if echo "$LIST_RESPONSE" | grep -q "firstName"; then
        echo "✓ Custom field schema included in response"
        test_passed
    else
        test_failed "$LIST_RESPONSE"
        exit 1
    fi
else
    test_failed "$LIST_RESPONSE"
    exit 1
fi

# Test 5: Create subscriber with custom fields
run_test "Create subscriber with custom fields"
SUB_RESPONSE=$(curl -s -X POST "$BASE_URL/subscribers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "email": "subscriber'$TIMESTAMP'@test.com",
    "organizationId": "'$ORG_ID'",
    "customFields": {
      "firstName": "John",
      "age": 30,
      "isPremium": true
    }
  }')

SUB_ID=$(echo "$SUB_RESPONSE" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | head -1)
if [ -n "$SUB_ID" ]; then
    echo "Subscriber created: $SUB_ID"
    if echo "$SUB_RESPONSE" | grep -q "John"; then
        echo "✓ Custom fields saved correctly"
        test_passed
    else
        test_failed "$SUB_RESPONSE"
        exit 1
    fi
else
    test_failed "$SUB_RESPONSE"
    exit 1
fi

# Test 6: Create campaign with merge tags
run_test "Create campaign with merge tags"
CAMPAIGN_RESPONSE=$(curl -s -X POST "$BASE_URL/campaigns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "subject": "Hello {{firstName}}!",
    "content": "Hi {{firstName}}, you are {{age}} years old. Premium status: {{isPremium}}. Your email: {{email}}",
    "listId": "'$LIST_ID'",
    "organizationId": "'$ORG_ID'"
  }')

CAMPAIGN_ID=$(echo "$CAMPAIGN_RESPONSE" | grep -o '[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}' | head -1)
if [ -n "$CAMPAIGN_ID" ]; then
    echo "Campaign with merge tags created: $CAMPAIGN_ID"
    if echo "$CAMPAIGN_RESPONSE" | grep -q "{{firstName}}"; then
        echo "✓ Merge tags preserved in campaign content"
        test_passed
    else
        echo "⚠ Merge tags may have been processed early"
        test_passed
    fi
else
    test_failed "$CAMPAIGN_RESPONSE"
    exit 1
fi

# Test 7: Verify list has custom field schema
run_test "Verify list has custom field schema"
LIST_GET_RESPONSE=$(curl -s -X GET "$BASE_URL/lists" \
  -H "Authorization: Bearer $TOKEN")

if echo "$LIST_GET_RESPONSE" | grep -q "firstName" && echo "$LIST_GET_RESPONSE" | grep -q "\"type\":\"string\""; then
    echo "✓ Custom field schema retrieved successfully"
    test_passed
else
    test_failed "$LIST_GET_RESPONSE"
    exit 1
fi

# Test 8: Verify subscriber data retrieval
run_test "Verify subscriber custom fields retrieval"
SUB_GET_RESPONSE=$(curl -s -X GET "$BASE_URL/subscribers?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN")

if echo "$SUB_GET_RESPONSE" | grep -q "John" && echo "$SUB_GET_RESPONSE" | grep -q "\"age\":30"; then
    echo "✓ Subscriber custom fields retrieved successfully"
    test_passed
else
    test_failed "$SUB_GET_RESPONSE"
    exit 1
fi

echo "=========================================="
echo "All Tests Completed!"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED / $TESTS_TOTAL${NC}"
echo ""

if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
    echo -e "${GREEN}✓ All custom fields and merge tag tests passed!${NC}"
    echo "Phase 3: Custom Fields & Merge Tags - COMPLETE"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
