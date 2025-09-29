# Test MCP Server

A server designed to validate the proxy functionality of the MCP Gateway.

## Purpose

This package provides various MCP server configurations that can be used to test different aspects of the MCP Gateway's proxy capabilities:

- **Basic connectivity** - Minimal server with echo functionality
- **Tool execution** - Servers that expose different tools
- **Resource handling** - Test resource serving and management
- **Error scenarios** - Servers that simulate various error conditions
- **Comprehensive testing** - Full-featured server with all MCP capabilities

## Available Servers

### Minimal Server (Default)
```bash
bun run dev
# or
bun run minimal-server.ts
```
A minimal MCP server that provides basic echo functionality for testing connectivity and basic operations.

### Comprehensive Server
```bash
bun run start:comprehensive
# or
bun run everything.ts
```
A full-featured MCP server that implements all MCP protocol features including:
- Multiple tools with various parameter types
- Resources with different content types
- Prompts with complex configurations
- Error handling scenarios

### Individual Test Servers

You can run specific test servers directly:

```bash
# Basic echo server
bun run echo-server.ts

# Server with multiple tools
bun run tools-server.ts

# Resource serving test
bun run resources-server.ts

# Error simulation
bun run error-server.ts
```

## Using with MCP Gateway

These test servers are designed to work seamlessly with the MCP Gateway for development and testing:

1. Start a test server:
   ```bash
   bun run --filter test-mcp-server dev
   ```

2. In another terminal, start the MCP Gateway:
   ```bash
   bun run --filter @fiberplane/mcp-gateway dev
   ```

3. Configure the gateway to connect to the test server (typically on `http://localhost:3000`)

4. Use the gateway's API or UI to interact with the test server through the proxy

## Development

This package uses the main `@fiberplane/mcp-gateway` package as a workspace dependency, ensuring you're always testing against the latest local version.

### Adding New Test Servers

To add a new test configuration:

1. Create a new TypeScript file in this directory (e.g., `my-test-server.ts`)
2. Import the necessary utilities from `@fiberplane/mcp-gateway`
3. Define your test server configuration
4. Add a script to `package.json` if needed

Example:
```typescript
import { createMCPServer } from "@fiberplane/mcp-gateway";

const server = createMCPServer({
  name: "test-server",
  tools: {
    myTool: {
      description: "A test tool",
      handler: async (params) => {
        return { result: "test response" };
      }
    }
  }
});

server.start();
```

## Requirements

- Bun runtime
- Part of the MCP Gateway monorepo workspace

## License

MIT (same as parent project)
