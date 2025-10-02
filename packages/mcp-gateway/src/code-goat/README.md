# Code Goat - MCP Gateway Code Mode

A module that adds "code mode" capabilities to MCP gateways, allowing LLMs to write and execute code that calls MCP tools programmatically.

## What This Module Does

1. **Generates TypeScript API definitions** from MCP tool schemas
2. **Creates a JavaScript runtime API** that LLMs can use to call tools
3. **Executes user code** via eval with access to the runtime API
4. **Routes tool calls** back to actual MCP servers
5. **Captures console output** and errors for observability

## Status: Eval-Based Prototype ⚠️

This is a **prototype implementation** using Node.js `eval()` for rapid development and testing. 

**Not suitable for production use** - no sandboxing, no security isolation, full process access.

## Quick Start

### Basic Usage

```typescript
import { createCodeMode, type MCPServer } from './code-goat';

// 1. Define your MCP servers and tools
const servers: MCPServer[] = [{
  name: 'filesystem',
  tools: [{
    name: 'read_file',
    description: 'Read contents of a file',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path']
    }
  }]
}];

// 2. Create RPC handler
async function rpcHandler(serverName: string, toolName: string, args: unknown) {
  const server = mcpServers.get(serverName);
  return await server.callTool(toolName, args);
}

// 3. Initialize code mode
const codeMode = await createCodeMode({
  servers,
  rpcHandler,
  timeout: 5000
});

// 4. Execute user code
const result = await codeMode.executeCode(`
  const file = await mcpTools.filesystem.readFile({ path: '/test.txt' });
  console.log('File contents:', file.content);
`);
```

### Run the Example

```bash
bun run packages/mcp-gateway/src/code-goat/example.ts
```

## Gateway Integration Steps

### Step 1: Add Code Mode to Gateway State

```typescript
import { createCodeMode, type CodeMode } from './code-goat';

interface GatewayState {
  mcpServers: Map<string, MCPServerConnection>;
  codeMode?: CodeMode;
  codeModeEnabled: boolean;
}
```

### Step 2: Initialize on Startup

```typescript
async function initializeGateway(config: GatewayConfig) {
  const servers = await connectToMCPServers(config);
  
  if (config.codeModeEnabled) {
    const mcpServers = await Promise.all(
      servers.map(async (server) => ({
        name: server.name,
        tools: await server.listTools()
      }))
    );
    
    state.codeMode = await createCodeMode({
      servers: mcpServers,
      rpcHandler: async (serverName, toolName, args) => {
        const server = state.mcpServers.get(serverName);
        return await server.callTool(toolName, args);
      },
      timeout: 5000
    });
  }
}
```

### Step 3: Modify list_tools Handler

```typescript
function handleListTools(request: MCPRequest) {
  if (state.codeModeEnabled && state.codeMode) {
    return { tools: [state.codeMode.getExecuteCodeToolSchema()] };
  } else {
    return { tools: getAllToolsFromServers() };
  }
}
```

### Step 4: Handle execute_code Calls

```typescript
async function handleCallTool(request: MCPRequest) {
  const { name, arguments: args } = request.params;
  
  if (name === 'execute_code' && state.codeMode) {
    const result = await state.codeMode.executeCode(args.code);
    return {
      content: [{
        type: 'text',
        text: result.success ? result.output : `Error: ${result.error}`
      }]
    };
  }
  // ... existing tool routing
}
```

### Step 5: Add Configuration

```typescript
interface GatewayConfig {
  servers: MCPServerConfig[];
  codeModeEnabled?: boolean;  // Opt-in flag
}

// Per-server opt-in (advanced)
interface MCPServerConfig {
  name: string;
  command: string;
  codeModeEnabled?: boolean;
}
```

## Integration Checklist

- [ ] Add code mode to gateway state
- [ ] Initialize code mode on startup  
- [ ] Modify list_tools to return execute_code
- [ ] Handle execute_code tool calls
- [ ] Add configuration option
- [ ] Test with real MCP servers
- [ ] Compare LLM behavior with/without code mode

## Security Warnings ⚠️

This prototype uses `eval()` with **NO security isolation**:

- ❌ User code runs in gateway process
- ❌ Full access to Node.js APIs
- ❌ Can access gateway memory
- ❌ No resource limits

**DO NOT** use with untrusted code or in production.

## Module Structure

```
code-goat/
├── index.ts                # Main exports
├── executor.ts             # Execution engine
├── api-generation/
│   ├── generate-types.ts   # TypeScript generation
│   ├── generate-client.ts  # Runtime API generation
│   └── utils.ts            # Helpers
└── example.ts              # Standalone demo
```

## Observability

Add logging in the gateway's rpcHandler:

```typescript
rpcHandler: async (serverName, toolName, args) => {
  logger.info('Tool call', { serverName, toolName, args });
  const result = await actualServer.callTool(toolName, args);
  logger.info('Tool response', { serverName, toolName });
  return result;
}
```

## Future Enhancements (Out of Scope)

- Sandboxing (child process, Deno, containers)
- Resource limits (CPU, memory, time)
- IPC-based isolation
- Code validation
- Caching

## License

Same as parent mcp-gateway package.

