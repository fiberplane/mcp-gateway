# @fiberplane/mcp-gateway-server

MCP protocol HTTP server for MCP Gateway.

## Overview

This package provides the HTTP server focused on **MCP protocol handling**:
- Proxying MCP traffic between clients and upstream servers
- OAuth 2.0 authentication/authorization for MCP servers
- Gateway's own MCP server for querying the gateway via MCP protocol
- Health and status endpoints

**Note**: This package does NOT include the query API or Web UI. Those are mounted separately by the CLI package for observability and management.

## Features

- **MCP Proxy** - Forward MCP requests to registered servers with traffic capture
- **OAuth Support** - Handle OAuth 2.0 authorization flows
- **Gateway MCP Server** - Query the gateway itself via MCP protocol
- **Session Management** - Track client sessions across requests
- **Health Endpoints** - Monitor gateway and server status
- **Traffic Capture** - Record all proxied traffic for analysis

## Architecture

The server package focuses solely on MCP protocol handling:

```
Server Package (MCP Protocol Layer)
├── Proxy Routes (/servers/:name/mcp)
│   └── Forward requests to upstream MCP servers
├── OAuth Routes (/.well-known/*, /oauth/*)
│   └── Handle OAuth discovery and authorization
├── Gateway MCP Server (/gateway, /g)
│   └── Expose gateway tools via MCP protocol
└── Health Endpoints (/, /status)
    └── Operational monitoring
```

The CLI package orchestrates this server with the API package and Web UI.

## Usage

### Creating the Server

```typescript
import { createApp } from "@fiberplane/mcp-gateway-server";
import { createMcpApp, logger } from "@fiberplane/mcp-gateway-core";
import type { McpServer } from "@fiberplane/mcp-gateway-types";

const servers: McpServer[] = [
  {
    name: "demo",
    url: "http://localhost:3000/mcp",
    type: "http",
    headers: {},
    lastActivity: null,
    exchangeCount: 0,
  },
];

const { app } = await createApp({
  servers,
  storageDir: "~/.mcp-gateway",
  createMcpApp,
  logger,
  onLog: (entry) => console.log(entry),
  onRegistryUpdate: () => console.log("Registry updated"),
});

// Start server
Bun.serve({
  fetch: app.fetch,
  port: 3333,
});
```

### Mounting in a Larger Application

The server can be mounted as a sub-app:

```typescript
import { createApp as createServerApp } from "@fiberplane/mcp-gateway-server";
import { createApp as createApiApp } from "@fiberplane/mcp-gateway-api";
import { createMcpApp, logger, queryLogs, getServers, getSessions } from "@fiberplane/mcp-gateway-core";
import { Hono } from "hono";

// Create MCP protocol server with dependency injection
const { app: serverApp } = await createServerApp({
  servers,
  storageDir,
  createMcpApp,
  logger,
  onLog: (entry) => console.log(entry),
  onRegistryUpdate: () => console.log("Registry updated"),
});

// Create complete application
const app = new Hono();

// Mount MCP protocol server
app.route("/", serverApp);

// Mount query API (separate package)
const apiApp = createApiApp(storageDir, { queryLogs, getServers, getSessions });
app.route("/api", apiApp);

// Serve
Bun.serve({ fetch: app.fetch, port: 3333 });
```

## Endpoints

### Proxy Endpoints

#### POST /servers/:name/mcp

Forward JSON-RPC MCP requests to upstream servers.

```bash
curl -X POST http://localhost:3333/servers/demo/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}'
```

#### GET /servers/:name/mcp (SSE)

Establish Server-Sent Events connection for streaming.

```bash
curl -N -H "Accept: text/event-stream" \
  http://localhost:3333/servers/demo/mcp
```

### Gateway MCP Server

#### POST /gateway (or /g)

Query the gateway itself via MCP protocol.

```bash
curl -X POST http://localhost:3333/gateway \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### OAuth Endpoints

- `GET /.well-known/mcp-servers` - OAuth discovery
- OAuth authorization flows at `/oauth/*`

### Health & Status

```bash
# Health check
curl http://localhost:3333/

# Detailed status (servers, storage)
curl http://localhost:3333/status
```

## Dependency Injection

The server uses dependency injection for flexibility and testability:

```typescript
const { app } = await createApp({
  servers,                     // McpServer[] - Server configurations
  storageDir,                  // Storage directory (absolute path)
  createMcpApp,                // Factory for creating gateway MCP server
  logger,                      // Logger instance for request logging
  onLog: (entry) => {          // Optional: Called for each request/response
    console.log(`${entry.method} - ${entry.httpStatus}`);
  },
  onRegistryUpdate: () => {    // Optional: Called when servers are modified
    console.log("Registry changed");
  },
});
```

This pattern allows:
- **Reusability**: Server can be embedded in other applications
- **Testability**: Dependencies can be mocked in tests
- **Flexibility**: Different implementations for different environments

These handlers are used by the CLI to update the TUI in real-time.

## Dependencies

- `@fiberplane/mcp-gateway-core` - Core business logic (registry, capture, queries)
- `@fiberplane/mcp-gateway-types` - TypeScript types
- `hono` - Web framework
- `@hono/node-server` - Node.js adapter
- `@hono/standard-validator` - Request validation
- `zod` - Schema validation

**Note**: Does NOT depend on `@fiberplane/mcp-gateway-api` - that's mounted by the CLI.

## Development

```bash
# Build
bun run build

# Type check
bun run typecheck
```

## Package Structure

This package is part of the MCP Gateway monorepo:

```
types → core → api → server → cli
```

- **types** - Type definitions
- **core** - Business logic (registry, capture, storage)
- **api** - Query API (mounted separately by CLI)
- **server** - MCP protocol server (this package)
- **cli** - CLI orchestrator (mounts server + API + Web UI)

## See Also

- [@fiberplane/mcp-gateway-api](../api) - Query API for log analysis
- [@fiberplane/mcp-gateway-core](../core) - Core business logic
- [@fiberplane/mcp-gateway-cli](../cli) - CLI with TUI
- [@fiberplane/mcp-gateway-web](../web) - Web UI

## License

MIT
