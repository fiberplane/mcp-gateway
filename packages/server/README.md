# @fiberplane/mcp-gateway-server

MCP protocol HTTP server for proxying, OAuth, and gateway MCP server.

## Key Features

- **MCP Proxy** - Forward MCP requests to registered servers with traffic capture
- **OAuth Support** - Handle OAuth 2.0 authorization flows for MCP servers
- **Gateway MCP Server** - Expose gateway management via MCP protocol
- **Session Management** - Track client sessions across requests
- **Health Endpoints** - Monitor gateway and server status
- **Dependency Injection** - Pass in custom dependencies for testing

## Quick Example

```typescript
import { createApp } from "@fiberplane/mcp-gateway-server";
import { createMcpApp, logger } from "@fiberplane/mcp-gateway-core";

const { app } = await createApp({
  servers: [
    {
      name: "demo",
      url: "http://localhost:3000/mcp",
      type: "http",
      headers: {},
      lastActivity: null,
      exchangeCount: 0,
    },
  ],
  storageDir: "~/.mcp-gateway",
  createMcpApp,
  appLogger: logger,
  onProxyEvent: (entry) => console.log(`${entry.method} - ${entry.httpStatus}`),
  onRegistryUpdate: () => console.log("Registry updated"),
});

// Start server
Bun.serve({
  fetch: app.fetch,
  port: 3333,
});
```

## Key Endpoints

**Proxy:**
- `POST /s/:name/mcp` - Forward JSON-RPC requests to upstream MCP server
- `GET /s/:name/mcp` - Server-Sent Events for streaming

**Gateway MCP Server:**
- `POST /gateway/mcp` (or `/g/mcp`) - Gateway's own MCP server with management tools

**OAuth:**
- `GET /.well-known/mcp-servers` - OAuth discovery
- OAuth authorization flows at `/oauth/*`

**Health & Status:**
- `GET /` - Health check
- `GET /status` - Detailed gateway status

## Architecture

Focused solely on MCP protocol handling:
- Proxy routes for forwarding MCP traffic
- OAuth routes for authentication flows
- Gateway MCP server for programmatic control
- Health endpoints for monitoring

The CLI package mounts this server alongside the API and Web UI.

## Full Documentation

- [Main README](../../README.md) - User guide and CLI reference
- [Architecture Overview](../../docs/architecture/overview.md) - System design

## See Also

- [@fiberplane/mcp-gateway-api](../api) - Query API for log analysis
- [@fiberplane/mcp-gateway-core](../core) - Core business logic
- [@fiberplane/mcp-gateway](../mcp-gateway) - CLI orchestrator
- [@fiberplane/mcp-gateway-web](../web) - Web UI

## Development

```bash
# Build
bun run build

# Type check
bun run typecheck
```

## License

MIT
