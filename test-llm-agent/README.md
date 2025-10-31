# Test LLM Agent

A test agent that uses the AI SDK to create realistic LLM-MCP interaction loops for validating the AI Gateway's correlation capabilities.

## Overview

This agent simulates real-world LLM agent behavior:
1. Sends LLM requests through the gateway proxy (`/llm/v1/*`)
2. LLM responds with tool calls
3. AI SDK executes tools by calling MCP servers through the gateway (`/s/{server}/mcp`)
4. Gateway correlates LLM requests with triggered MCP calls

## Prerequisites

1. **Gateway running**: `bun run dev` (from project root)
2. **Test MCP server running**: `bun run --filter test-mcp-server dev`
3. **Environment variables**: Create `.env` file (see Configuration below)

## Usage

```bash
# Install dependencies
bun install

# Run weather scenario (default)
bun start

# Run specific scenario
bun run weather
bun run echo
bun run time
bun run multi-step
```

## Available Scenarios

### `weather`
Simple single tool call to get weather for a city.
```bash
bun run weather
```

### `echo`
Test the echo tool (simple validation).
```bash
bun run echo
```

### `time`
Get current time.
```bash
bun run time
```

### `multi-step`
Multi-step scenario with sequential tool calls.
```bash
bun run multi-step
```

### `parallel`
Parallel tool execution (same tool, different arguments).
```bash
bun start parallel
```

## How It Works

```typescript
// 1. AI SDK sends request through gateway
const result = await generateText({
  model: openai('gpt-4-turbo', {
    baseURL: 'http://localhost:3333/llm/v1'  // Gateway proxy
  }),
  tools: mcpTools,  // Tool definitions
  headers: {
    'X-Conversation-Id': conversationId  // Correlation ID
  }
});

// 2. Tools execute by calling MCP through gateway
async function callMCPTool(method, params) {
  const response = await fetch('http://localhost:3333/s/everything/mcp', {
    method: 'POST',
    body: JSON.stringify({ method, params })
  });
  return response.json();
}
```

## Validation

After running a scenario, check:

1. **Gateway logs**: See LLM and MCP traffic in terminal
2. **Web UI**: View conversation at `http://localhost:3333/ui/conversations/{id}`
3. **Database**: Query correlation:
   ```sql
   SELECT * FROM llm_requests WHERE conversation_id = '...';
   SELECT * FROM logs WHERE llm_trace_id IS NOT NULL;
   ```

## Configuration

### Environment Variables

Create a `.env` file in this directory:

```bash
# Copy the example file
cp .env.example .env

# Edit with your values
nano .env
```

Available variables:
- `OPENAI_API_KEY` - **Required** - Your OpenAI API key for real LLM calls
- `GATEWAY_URL` - Gateway base URL (default: `http://localhost:3333`)
- `MCP_SERVER` - MCP server name in gateway config (default: `everything`)
- `CORRELATION_MODE` - How conversation IDs are propagated (default: `manual`)

**Note**: Bun automatically loads `.env` files, so no additional setup needed!

### Correlation Modes

The agent supports three correlation modes to test different correlation strategies:

#### `manual` (default)
Explicitly sends `X-Conversation-Id` header with every MCP call.

**Use case**: Testing explicit correlation propagation
```bash
CORRELATION_MODE=manual bun run weather
```

Gateway sees:
- LLM request with `X-Conversation-Id: abc123`
- MCP call with `X-Conversation-Id: abc123`
- ✅ Direct correlation via matching IDs

#### `auto`
Relies on session-based automatic propagation by the gateway.

**Use case**: Testing automatic correlation without user code changes
```bash
CORRELATION_MODE=auto bun run weather
```

Gateway behavior:
1. Captures LLM request with `X-Conversation-Id: abc123`
2. Stores mapping: `{sessionId: "test-agent-session" → conversationId: "abc123"}`
3. MCP call arrives with `Mcp-Session-Id: test-agent-session` (no conversation ID)
4. Gateway auto-injects `conversation_id: abc123` into logs
5. ✅ Automatic correlation via session lookup

#### `none`
No correlation headers sent - tests fuzzy matching fallback.

**Use case**: Testing correlation when no explicit linking is available
```bash
CORRELATION_MODE=none bun run weather
```

Gateway sees:
- LLM request with tool call: `getWeather({"location": "Amsterdam"})`
- MCP call: `tools/call` with `{"name": "getWeather", "arguments": {"location": "Amsterdam"}}`
- ✅ Fuzzy matching correlation via tool name + arguments + temporal proximity

### Testing All Modes

```bash
# Test manual propagation
CORRELATION_MODE=manual bun run weather

# Test automatic propagation
CORRELATION_MODE=auto bun run weather

# Test fuzzy matching
CORRELATION_MODE=none bun run weather

# Verify correlation in database
sqlite3 ~/.mcp-gateway/logs.db "
  SELECT
    llm.conversation_id,
    llm.tool_calls_json,
    logs.method,
    logs.conversation_id IS NOT NULL as correlated
  FROM llm_requests llm
  LEFT JOIN logs ON logs.conversation_id = llm.conversation_id
  WHERE llm.direction = 'response'
  ORDER BY llm.timestamp DESC LIMIT 10;
"
```

## Adding New Scenarios

1. Add scenario to `src/scenarios.ts`:
```typescript
export const scenarios = {
  myScenario: {
    name: 'my-scenario',
    prompt: 'Your prompt here',
    expectedTools: ['tool1', 'tool2'],
    description: 'What this tests'
  }
};
```

2. Add script to `package.json`:
```json
{
  "scripts": {
    "my-scenario": "bun src/agent.ts myScenario"
  }
}
```

## Troubleshooting

### Gateway not responding
- Check gateway is running: `bun run dev`
- Check URL: `http://localhost:3333/health`

### MCP server not found
- Check test-mcp-server is running
- Check gateway config: `~/.mcp-gateway/mcp.json` includes `everything` server

### OpenAI API errors
- Verify `OPENAI_API_KEY` is set
- Check gateway is forwarding requests correctly

## Next Steps

Once the gateway implements LLM proxy:
- [ ] Update `baseURL` to point to actual LLM proxy endpoint
- [ ] Add correlation validation checks
- [ ] Add streaming scenarios
- [ ] Add error handling scenarios
