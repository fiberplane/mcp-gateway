#!/bin/bash

echo "🧪 Testing LLM-MCP Auto-Correlation"
echo "====================================="
echo ""

# Generate unique session ID
SESSION_ID="session-$(date +%s)"

echo "Session ID: $SESSION_ID"
echo ""

echo "Step 1: Simulate LLM request (stores session→conversation mapping)"
echo "--------------------------------------------------------------------"

# Make fake LLM request through gateway proxy
LLM_RESULT=$(curl -s -X POST http://localhost:3333/llm/v1/messages \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -H "Authorization: Bearer sk-fake" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "test"}]
  }')

# Extract conversation ID from response (will fail but that's okay)
echo "   LLM request sent (will fail auth but that's OK)"
echo ""

sleep 1

echo "Step 2: Make MCP tool call with same session (should auto-inject conversation ID)"
echo "---------------------------------------------------------------------------------"

# Make MCP call with same session ID
MCP_RESULT=$(curl -s -X POST http://localhost:3333/s/everything/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }')

echo "   MCP call sent: $(echo $MCP_RESULT | jq -r '.result.tools[0].name' 2>/dev/null || echo 'request made')"
echo ""

sleep 1

echo "Step 3: Query database to verify correlation"
echo "---------------------------------------------"

# Check both tables for conversation_id
sqlite3 ~/.mcp-gateway/logs.db << SQL
.mode column
.headers on
.width 12 40 20 16

-- Show LLM request
SELECT 'LLM' as type,
       substr(conversation_id, 1, 40) as conversation_id,
       provider || '/' || model as details,
       strftime('%H:%M:%S', timestamp) as time
FROM llm_requests 
WHERE conversation_id IN (
  SELECT conversation_id FROM logs WHERE session_id = '$SESSION_ID'
)
LIMIT 1;

-- Show MCP call
SELECT 'MCP' as type,
       substr(conversation_id, 1, 40) as conversation_id, 
       method as details,
       strftime('%H:%M:%S', timestamp) as time
FROM logs 
WHERE session_id = '$SESSION_ID'
LIMIT 1;
SQL

echo ""
echo "✅ If both rows show the same conversation_id, auto-correlation works!"

