# @fiberplane/mcp-gateway-server

HTTP server for MCP Gateway with proxy functionality.

## Overview

This package provides the main HTTP server for the MCP Gateway. Its primary focus is **proxying MCP traffic** between clients and MCP servers, with additional support for OAuth flows and the gateway's own MCP server implementation.

The server captures all proxied traffic and stores it for later analysis via the API package.

## Features

- **MCP Proxy** - Forward requests to registered MCP servers with traffic capture
- **OAuth Support** - Handle OAuth 2.0 authorization flows for MCP servers
- **Gateway MCP Server** - Expose the gateway's own MCP tools and resources
- **API Integration** - Mount the query API for log access
- **Session Management** - Track client sessions and store client info
- **Health Endpoints** - Monitor gateway status and registered servers

## Architecture

The server orchestrates multiple route handlers:

1. **Proxy Routes** (`/servers/:name`) - Forward MCP requests to upstream servers
2. **OAuth Routes** (`/.well-known/*`, `/oauth/*`) - Handle OAuth discovery and flows
3. **API Routes** (`/api/*`) - Expose log query endpoints (from `@fiberplane/mcp-gateway-api`)
4. **Gateway Routes** (`/gateway`, `/g`) - Serve the gateway's own MCP server

All proxied traffic is captured and stored via the core package's capture system.

## Usage

### Creating the Server

```typescript
import { createApp } from "@fiberplane/mcp-gateway-server";
import type { Registry } from "@fiberplane/mcp-gateway-types";

const registry: Registry = {
  servers: [
    {
      name: "demo",
      url: "http://localhost:3000/mcp",
      type: "http",
    },
  ],
};

const { app, registry: updatedRegistry } = await createApp(
  registry,
  "~/.mcp-gateway", // optional storage directory
  {
    onLog: (entry) => console.log(entry), // optional log handler
    onRegistryUpdate: () => console.log("Registry updated"), // optional
  }
);

// Start server
Bun.serve({
  fetch: app.fetch,
  port: 3333,
});
```

### Proxy Endpoints

#### HTTP Proxy (Stateless)

```bash
# POST requests to /servers/:name
curl -X POST http://localhost:3333/servers/demo \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}'
```

#### SSE Proxy (Stateful)

```bash
# GET requests to /servers/:name for SSE connections
curl -N http://localhost:3333/servers/demo
```

### Health & Status

```bash
# Health check
curl http://localhost:3333/

# Detailed status
curl http://localhost:3333/status
```

## Dependencies

- `@fiberplane/mcp-gateway-core` - Core business logic
- `@fiberplane/mcp-gateway-api` - Query API
- `hono` - Web framework
- `@hono/node-server` - Node.js adapter for Hono

## Development

```bash
# Build
bun run build

# Type check
bun run typecheck
```

## See Also

- [@fiberplane/mcp-gateway-api](../api) - Query API for accessing logs
- [@fiberplane/mcp-gateway-core](../core) - Core business logic
- [@fiberplane/mcp-gateway-cli](../mcp-gateway) - CLI with TUI

## License

MIT
