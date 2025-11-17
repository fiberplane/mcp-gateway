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

### Isolation Test Server
```bash
bun run start:isolation
# or
bun run isolation-test.ts
```
A stateful MCP server designed specifically to test session isolation. Maintains an in-memory counter that:
- Increments with each `increment` tool call
- Returns current value with `get_count` tool
- Resets to zero with `reset` tool

**Purpose**: Demonstrates that isolated mode gives each session separate state:
- In **isolated mode**: Each session has its own counter (session 1 increments → 1, session 2 increments → 1)
- In **shared mode**: All sessions share the same counter (session 1 increments → 1, session 2 increments → 2)

Perfect for validating that the gateway correctly isolates session state when configured with `sessionMode: "isolated"`.

## Using with MCP Gateway

These test servers are designed to work seamlessly with the MCP Gateway for development and testing.

### Testing HTTP Servers

1. Start a test server:
   ```bash
   bun run --filter test-mcp-server dev  # or start:comprehensive
   ```

2. In another terminal, start the MCP Gateway:
   ```bash
   bun run --filter @fiberplane/mcp-gateway dev
   ```

3. Configure the gateway to connect to the test server (typically on `http://localhost:3002`)

4. Use the gateway's API or UI to interact with the test server through the proxy

### Testing Stdio Servers (Session Isolation)

The isolation test server is specifically designed for stdio mode testing:

1. Start the MCP Gateway:
   ```bash
   bun run --filter @fiberplane/mcp-gateway dev
   ```

2. Add the isolation test server via the gateway API:
   ```bash
   curl -X POST http://localhost:3333/api/servers \
     -H "Content-Type: application/json" \
     -d '{
       "name": "test-isolated",
       "type": "stdio",
       "command": "bun",
       "args": ["run", "start:isolation"],
       "cwd": "'$(pwd)'/test-mcp-server",
       "sessionMode": "isolated"
     }'
   ```

3. Test session isolation - each session maintains separate state:
   ```bash
   # Session 1: Increment counter
   curl -X POST http://localhost:3333/s/test-isolated/mcp \
     -H "Content-Type: application/json" \
     -H "x-session-id: alice" \
     -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"increment"},"id":1}'
   # Returns: count: 1

   # Session 2: Increment counter (separate process, separate state)
   curl -X POST http://localhost:3333/s/test-isolated/mcp \
     -H "Content-Type: application/json" \
     -H "x-session-id: bob" \
     -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"increment"},"id":1}'
   # Returns: count: 1 (not 2!)
   ```

4. Try shared mode to see the difference:
   ```bash
   # Change sessionMode to "shared" when adding server
   # Now both sessions would share the same counter
   ```

## Development

This package uses the main `@fiberplane/mcp-gateway` package as a workspace dependency, ensuring you're always testing against the latest local version.

### Adding New Test Servers

To add a new test configuration:

1. Create a new TypeScript file in this directory (e.g., `my-test-server.ts`)
2. Use the MCP protocol implementation library (`mcp-lite` or similar)
3. Implement the required MCP methods (initialize, tools/list, tools/call, etc.)
4. Add a script to `package.json` for easy running

See `isolation-test.ts` for a complete stdio server example, or `everything.ts` for an HTTP server example.

## Requirements

- Bun runtime
- Part of the MCP Gateway monorepo workspace

## License

MIT (same as parent project)
