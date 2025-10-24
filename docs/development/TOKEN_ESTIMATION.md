# Token Estimation for MCP Tool Calls

## Overview

The MCP Gateway includes token estimation capabilities to help users understand the "cost" of using MCP tools in their LLM applications. This feature estimates the number of tokens consumed when LLMs (like Claude) make tool calls through the MCP protocol.

## Purpose

Token estimation serves several key purposes:

1. **Cost Tracking** - Monitor the token usage of MCP tool calls for billing and budget purposes
2. **Performance Analysis** - Identify expensive tool calls that may need optimization
3. **Rate Limiting** - Support future rate limiting features based on token consumption
4. **Usage Analytics** - Provide insights into which tools consume the most tokens

## How It Works

### Architecture

Token estimation happens at the **capture layer** when MCP traffic is logged:

```
Claude → MCP Gateway → MCP Server
             ↓
        Capture Layer
             ↓
    Token Estimation
             ↓
        SQLite Log
```

### What Gets Counted

For each MCP tool call, we estimate two types of tokens:

1. **Input Tokens** - The cost of the LLM's request (tool name + arguments)
2. **Output Tokens** - The cost of the tool's response (result or error)

### Heuristic Used

We use the industry-standard heuristic: **~4 characters per token**

This is based on:
- OpenAI's guidance for GPT models
- Anthropic's Claude tokenization patterns
- Widely used by LangChain, cost estimators, and monitoring tools

#### Accuracy

- **For English text**: ~4-5 chars/token
- **For JSON payloads**: ~3.5-4.5 chars/token
- **For code/paths**: ~3-4 chars/token
- **Overall accuracy**: ±10-20% (intentionally conservative, slightly overestimates)

This is **sufficient for cost monitoring** but not precise enough for exact billing. For exact token counts, use a proper tokenizer like `tiktoken`.

## Implementation Details

### Input Token Estimation

File: `packages/core/src/utils/tokens.ts`

```typescript
estimateInputTokens(method: string, params: unknown): number
```

**What it extracts:**

| MCP Method | Extracted Data | Example |
|------------|---------------|---------|
| `tools/call` | `{name, arguments}` | `{name: "fetch_url", arguments: {url: "..."}}` |
| `resources/read` | `{uri}` | `{uri: "file:///path/to/file"}` |
| `prompts/get` | `{name, arguments}` | `{name: "code_review", arguments: {...}}` |
| `tools/list` | `{cursor?}` | `{cursor: "abc123"}` or `{}` |
| Other methods | Full params | All parameters |

**Why these fields?**

These are the exact fields that Claude sends to the Gateway when making tool calls. We exclude MCP protocol overhead (like session IDs, metadata) because the LLM doesn't pay for those.

### Output Token Estimation

```typescript
estimateOutputTokens(result: unknown): number
```

**Handles multiple response formats:**

1. **MCP Content Arrays** (most common):
   ```json
   {
     "content": [
       {"type": "text", "text": "Hello, world!"},
       {"type": "image", "data": "base64..."}
     ]
   }
   ```
   - Optimized: Counts actual text/data content + structure overhead
   - More accurate than full JSON stringification

2. **Structured Objects**:
   ```json
   {
     "status": "success",
     "data": {...}
   }
   ```
   - Stringifies entire object

3. **Error Responses**:
   ```json
   {
     "code": -32601,
     "message": "Method not found"
   }
   ```
   - Counts full error object (code + message + data)

4. **Primitive Values**:
   - Strings, numbers, booleans are stringified

### Edge Cases Handled

| Case | Behavior |
|------|----------|
| `null` / `undefined` | Returns minimal count (1 token for `{}`) |
| Circular references | Estimates based on object keys (~20 chars/key) |
| Very large responses | Counts full content length (10KB+ supported) |
| Base64 image data | Counts encoded string length |
| Empty content | Counts structure overhead only |
| Invalid JSON | Returns 0 (graceful degradation) |

## Usage in Capture Layer

File: `packages/core/src/capture/index.ts`

### Request Capture

```typescript
const record: CaptureRecord = {
  // ...
  metadata: {
    inputTokens: estimateInputTokens(request.method, request.params),
  }
};
```

### Response Capture

```typescript
const record: CaptureRecord = {
  // ...
  metadata: {
    outputTokens: estimateOutputTokens(response.result ?? response.error),
  }
};
```

### SSE (Streaming) Capture

```typescript
// For request events
metadata: {
  inputTokens: !isResponse
    ? estimateInputTokens(jsonRpcMessage.method, jsonRpcMessage.params)
    : undefined,
}

// For response events
metadata: {
  outputTokens: isResponse
    ? estimateOutputTokens(response.result ?? response.error)
    : undefined,
}
```

## Web UI Integration

The Web UI displays token counts in the log table:

File: `packages/web/src/components/log-table.tsx`

```tsx
{
  id: "tokens",
  header: "Tokens",
  sortField: "tokens",
  cell: (log) => {
    const inputTokens = log.metadata.inputTokens ?? 0;
    const outputTokens = log.metadata.outputTokens ?? 0;
    const total = inputTokens + outputTokens;

    if (total === 0) {
      return <span className="text-muted-foreground">−</span>;
    }

    return (
      <span
        className="text-sm text-muted-foreground tabular-nums text-right"
        title={`Input: ${inputTokens}, Output: ${outputTokens}`}
      >
        {total.toLocaleString()}
      </span>
    );
  },
}
```

Features:
- **Total tokens** displayed as comma-separated number
- **Tooltip** shows input/output breakdown
- **Sortable column** for finding expensive calls
- **Null-safe** (shows "−" when no tokens)

## Testing

File: `packages/core/src/utils/tokens.test.ts`

### Coverage

- ✅ Standard MCP methods (`tools/call`, `resources/read`, `prompts/get`)
- ✅ List methods with cursors
- ✅ Unknown/custom methods
- ✅ Complex nested arguments
- ✅ Content arrays (text + images)
- ✅ Error responses
- ✅ Very large responses (10KB+)
- ✅ Edge cases (null, undefined, circular refs)
- ✅ Primitive values

### Running Tests

```bash
# All core tests
cd packages/core && bun test

# Token estimation tests only
bun test packages/core/src/utils/tokens.test.ts
```

## Best Practices

### ✅ Do This

1. **Use for monitoring** - Track trends and identify expensive tools
2. **Show to users** - Help them understand tool call costs
3. **Use for rate limiting** - Implement soft limits based on token estimates
4. **Compare tools** - Identify which tools are most/least efficient

### ❌ Don't Do This

1. **Don't use for exact billing** - This is an estimate, not precise
2. **Don't assume 100% accuracy** - Expect ±10-20% variance
3. **Don't ignore large responses** - Some tools return huge payloads (MB+)
4. **Don't forget errors** - Error responses also consume tokens

## Anthropic/Claude Specific Considerations

### How Claude Uses MCP Tools

1. **Tool Definition** - Claude receives MCP tool schemas from the Gateway
2. **Tool Call** - Claude sends a `tool_use` block in the Messages API
3. **Translation** - Gateway translates to MCP `tools/call` JSON-RPC request
4. **Tool Result** - MCP server responds with result
5. **Translation Back** - Gateway formats result as `tool_result` for Claude
6. **Claude Continues** - Claude processes the result and continues conversation

### Token Cost Breakdown

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude API Request                       │
│                                                             │
│  System Prompt: "You have access to MCP tools..."          │
│  + User Message: "Fetch https://example.com"               │
│  + Tool Definitions: [fetch_url: {...}]                    │ ← Input tokens (NOT counted by us)
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                    Tool Use Block                           │
│                                                             │
│  {                                                          │
│    "type": "tool_use",                                      │
│    "name": "fetch_url",                        ← START: We count from here
│    "input": {                                               │
│      "url": "https://example.com"                          │
│    }                                          ← END: Input tokens
│  }                                                          │
├─────────────────────────────────────────────────────────────┤
│                    Tool Result Block                        │
│                                                             │
│  {                                                          │
│    "type": "tool_result",                                   │
│    "content": [                                ← START: Output tokens
│      {                                                      │
│        "type": "text",                                      │
│        "text": "<html>...</html>"            ← Actual content
│      }                                                      │
│    ]                                          ← END: Output tokens
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

**What we count:**
- ✅ Tool name and arguments (input tokens)
- ✅ Tool result content (output tokens)

**What we DON'T count:**
- ❌ System prompts
- ❌ User messages
- ❌ Tool definitions/schemas
- ❌ Claude's thinking/reasoning
- ❌ Assistant responses after tool use

This is **correct** because:
1. We're only tracking the **incremental cost** of the tool call itself
2. System prompts and tool definitions are **shared across all tool calls**
3. Users care about **per-tool costs**, not total conversation costs

## Future Enhancements

### Potential Improvements

1. **Precise Token Counting** (Optional)
   - Add `tiktoken` for exact Claude token counts
   - Make it opt-in (requires ~1MB WASM file)
   - Fallback to heuristic if not available

2. **Token Budgets**
   - Set per-server token limits
   - Warn when approaching limits
   - Block or throttle expensive tools

3. **Cost Estimation**
   - Map tokens to dollar costs (based on model pricing)
   - Show cost breakdown by server/tool/session
   - Export cost reports

4. **Real-time Alerts**
   - Alert when a single tool call exceeds threshold
   - Alert on sustained high token usage
   - Integrate with monitoring systems

5. **Token Analytics**
   - Average tokens per tool
   - Peak token usage times
   - Token efficiency trends over time
   - Identify token-heavy workflows

6. **Compression Optimization**
   - Detect when responses could be compressed
   - Suggest tool improvements for efficiency
   - Auto-summarization for large results

## References

- [MCP Specification](https://modelcontextprotocol.io/)
- [Anthropic Messages API](https://docs.anthropic.com/claude/reference/messages)
- [OpenAI Tokenizer Guide](https://platform.openai.com/tokenizer)
- [tiktoken (OpenAI's tokenizer)](https://github.com/openai/tiktoken)

## Migration Notes

Token estimation was added in v0.5.0. For older capture records without token estimates:
- The Web UI shows "−" for missing token counts
- Sorting by tokens puts null values at the end
- No migration needed - new captures will include tokens

## Contributing

When modifying token estimation:

1. **Update tests** - Add tests for new cases
2. **Update this doc** - Keep documentation in sync
3. **Verify accuracy** - Compare with actual Claude API token usage
4. **Run full test suite** - `cd packages/core && bun test`
5. **Lint and format** - `bun run lint && bun run format`
