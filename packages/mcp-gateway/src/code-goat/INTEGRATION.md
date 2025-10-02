# Code Goat Gateway Integration Guide

This guide shows you how to integrate the code-goat module into the MCP Gateway.

## Quick Integration (30 minutes)

### 1. Import the Module

```typescript
// In your main gateway file
import { createCodeMode, type CodeMode } from './code-goat';
```

### 2. Add to Gateway State

```typescript
interface GatewayState {
  // ... existing state
  codeMode?: CodeMode;
}

const state: GatewayState = {
  // ... existing state
  codeMode: undefined,
};
```

### 3. Initialize on Startup

Add this to your gateway initialization:

```typescript
async function initializeCodeMode(config: GatewayConfig) {
  if (!config.codeMode?.enabled) return;
  
  // Collect tools from all MCP servers
  const servers = Array.from(state.mcpServers.entries()).map(([name, conn]) => ({
    name,
    tools: conn.tools || [],
  }));
  
  // Create code mode instance
  state.codeMode = await createCodeMode({
    servers,
    rpcHandler: async (serverName, toolName, args) => {
      // Route to actual MCP server
      const connection = state.mcpServers.get(serverName);
      if (!connection) {
        throw new Error(`Unknown MCP server: ${serverName}`);
      }
      return await connection.callTool(toolName, args);
    },
    timeout: config.codeMode?.timeout || 5000,
  });
  
  console.log('✅ Code mode initialized');
}
```

### 4. Modify list_tools Handler

```typescript
function handleListTools(req: MCPRequest): MCPResponse {
  // If code mode is enabled, return only execute_code tool
  if (state.codeMode) {
    return {
      tools: [state.codeMode.getExecuteCodeToolSchema()],
    };
  }
  
  // Otherwise, return all tools from all servers
  return {
    tools: getAllToolsFromServers(),
  };
}
```

### 5. Handle execute_code Calls

```typescript
async function handleCallTool(req: MCPRequest): Promise<MCPResponse> {
  const { name, arguments: args } = req.params;
  
  // Handle execute_code tool
  if (name === 'execute_code' && state.codeMode) {
    const result = await state.codeMode.executeCode(args.code);
    
    return {
      content: [
        {
          type: 'text',
          text: result.success 
            ? result.output 
            : `Execution failed:\n${result.error}\n\n${result.output}`,
        },
      ],
    };
  }
  
  // Handle normal tool calls
  return handleNormalToolCall(req);
}
```

### 6. Add Configuration

```typescript
// In your config file/schema
interface GatewayConfig {
  // ... existing config
  codeMode?: {
    enabled: boolean;
    timeout?: number;  // Optional, defaults to 5000ms
  };
}

// Example config
{
  "servers": [
    { "name": "filesystem", "command": "mcp-server-filesystem" },
    { "name": "github", "command": "mcp-server-github" }
  ],
  "codeMode": {
    "enabled": true,
    "timeout": 5000
  }
}
```

## Per-Server Opt-In (Advanced)

If you want to enable code mode for only specific servers:

```typescript
interface MCPServerConfig {
  name: string;
  command: string;
  codeMode?: boolean;  // Per-server flag
}

async function initializeCodeMode(config: GatewayConfig) {
  // Filter to only code-mode-enabled servers
  const enabledServers = config.servers
    .filter(s => s.codeMode === true)
    .map(s => ({
      name: s.name,
      tools: state.mcpServers.get(s.name)?.tools || [],
    }));
  
  if (enabledServers.length === 0) return;
  
  state.codeMode = await createCodeMode({
    servers: enabledServers,
    rpcHandler: /* ... */,
  });
}
```

Example config:
```json
{
  "servers": [
    { "name": "filesystem", "command": "...", "codeMode": true },
    { "name": "github", "command": "...", "codeMode": true },
    { "name": "legacy-api", "command": "...", "codeMode": false }
  ]
}
```

## Adding Observability

Add logging in the `rpcHandler`:

```typescript
rpcHandler: async (serverName, toolName, args) => {
  const startTime = Date.now();
  const traceId = generateTraceId();
  
  logger.info('Tool call started', {
    traceId,
    serverName,
    toolName,
    args,
  });
  
  try {
    const connection = state.mcpServers.get(serverName);
    if (!connection) {
      throw new Error(`Unknown server: ${serverName}`);
    }
    
    const result = await connection.callTool(toolName, args);
    
    logger.info('Tool call succeeded', {
      traceId,
      serverName,
      toolName,
      duration: Date.now() - startTime,
    });
    
    return result;
  } catch (error) {
    logger.error('Tool call failed', {
      traceId,
      serverName,
      toolName,
      error: error.message,
      duration: Date.now() - startTime,
    });
    throw error;
  }
}
```

## Testing the Integration

### 1. Start Gateway with Code Mode

```bash
bun run dev --code-mode
```

### 2. Connect MCP Client

Your client should see only one tool: `execute_code`

### 3. Test with Simple Code

```json
{
  "method": "tools/call",
  "params": {
    "name": "execute_code",
    "arguments": {
      "code": "console.log('Hello from code mode!');"
    }
  }
}
```

### 4. Test with Tool Calls

```json
{
  "method": "tools/call",
  "params": {
    "name": "execute_code",
    "arguments": {
      "code": "const file = await mcpTools.Filesystem.readFile({ path: '/test.txt' });\nconsole.log('File:', file.content);"
    }
  }
}
```

## Comparison Testing

To compare LLM behavior with and without code mode:

```bash
# Without code mode (normal tools)
bun run dev

# With code mode (execute_code only)
bun run dev --code-mode
```

Use the same prompts with both configurations and measure:
- Number of tool calls
- Total execution time
- Success rate
- LLM reasoning quality

## Rollback Plan

If code mode causes issues:

1. Set `codeMode.enabled: false` in config
2. Restart gateway
3. All clients will see normal tools again

No data loss or breaking changes.

## Security Checklist

Before enabling in any production-like environment:

- [ ] Replace eval with proper sandboxing (child process, Deno, container)
- [ ] Add resource limits (CPU, memory, time)
- [ ] Add rate limiting per client
- [ ] Add input validation for user code
- [ ] Add audit logging for all executions
- [ ] Test with malicious code samples
- [ ] Review code for injection vulnerabilities

**Current Status:** ⚠️ PROTOTYPE ONLY - NOT PRODUCTION READY

## Troubleshooting

### Issue: "mcpTools is not defined"

The runtime API wasn't loaded. Check:
- Code mode initialized correctly
- TypeScript generation succeeded
- Runtime API generation succeeded

### Issue: "Tool X is not a function"

The tool name casing is wrong. Use:
- PascalCase for servers: `mcpTools.Filesystem`
- camelCase for tools: `mcpTools.Filesystem.readFile`

### Issue: "Execution timeout"

Increase the timeout:
```typescript
codeMode: {
  enabled: true,
  timeout: 10000  // 10 seconds
}
```

### Issue: Code executes but no output

Check that user code uses `console.log()` for output:
```javascript
// ✅ Good - will capture output
console.log('Result:', result);

// ❌ Bad - return value not shown to LLM
return result;
```

## Next Steps

1. ✅ Complete eval-based prototype (DONE)
2. ⏳ Test with real MCP servers
3. ⏳ Integrate into gateway
4. ⏳ Compare with normal mode
5. ⏳ Measure performance impact
6. ⏳ Replace eval with sandboxing
7. ⏳ Add production safeguards

## Questions?

See the main [README.md](./README.md) for more details on the module architecture and API.

