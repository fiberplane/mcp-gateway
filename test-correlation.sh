#!/bin/bash

# Test LLM-MCP Correlation
echo "Testing LLM-MCP Correlation..."
echo ""

# Generate unique IDs for this test
SESSION_ID="test-session-$(date +%s)"
TRACE_ID="trace-$(date +%s)"

echo "1️⃣  Simulating LLM request with session ID: $SESSION_ID"

# Simulate LLM request (will auto-generate conversation ID)
LLM_RESPONSE=$(curl -s -X POST http://localhost:3333/llm/v1/messages \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -H "Authorization: Bearer fake-key" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }' 2>&1)

echo "   Response: $(echo $LLM_RESPONSE | head -c 100)..."

# Extract conversation ID from response headers (if available)
CONVERSATION_ID=$(echo "$LLM_RESPONSE" | grep -i "x-conversation-id" | cut -d: -f2 | tr -d ' \r')

echo "   Conversation ID: $CONVERSATION_ID"
echo ""

sleep 1

echo "2️⃣  Making MCP tool call with same session ID: $SESSION_ID"

# Make MCP tool call with same session ID (should auto-inject conversation ID)
MCP_RESPONSE=$(curl -s -X POST http://localhost:3333/s/everything/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }')

echo "   Response: $(echo $MCP_RESPONSE | head -c 100)..."
echo ""

sleep 1

echo "3️⃣  Querying database for correlation..."
echo ""

# Query database to verify correlation
sqlite3 ~/.mcp-gateway/logs.db << SQL
.mode line
.headers on

-- Check if LLM request was captured
SELECT 'LLM Request:' as record_type, 
       trace_id, 
       conversation_id, 
       provider,
       model,
       datetime(timestamp, 'localtime') as timestamp
FROM llm_requests 
WHERE trace_id LIKE '%$(date +%s)%' OR conversation_id IS NOT NULL
ORDER BY timestamp DESC 
LIMIT 1;

-- Check if MCP call was captured with conversation_id
SELECT 'MCP Call:' as record_type,
       method,
       conversation_id,
       server_name,
       session_id,
       datetime(timestamp, 'localtime') as timestamp
FROM mcp_logs 
WHERE session_id = '$SESSION_ID'
ORDER BY timestamp DESC 
LIMIT 1;
SQL

echo ""
echo "✅ Test complete! Both records should have the same conversation_id"
