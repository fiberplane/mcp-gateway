# @fiberplane/mcp-gateway-api

REST API for querying MCP Gateway logs and managing servers.

## Key Features

- **Query Logs** - Search and filter captured MCP traffic
- **Server Aggregations** - View statistics per MCP server
- **Session Tracking** - Analyze individual client sessions
- **Server Management** - Add, update, delete MCP server configurations (optional)
- **Dependency Injection** - Pass in custom query implementations for testing

## Authentication

⚠️ **This package does NOT include authentication.**

The API package is auth-agnostic by design. Authentication is handled by the orchestration layer (CLI package) using Bearer token middleware. This allows flexible deployment patterns.

When deployed via CLI, all endpoints require `Authorization: Bearer <token>` header.

## Quick Example

```typescript
import { createApp } from "@fiberplane/mcp-gateway-api";
import { createAuthMiddleware } from "@fiberplane/mcp-gateway";
import { logger } from "@fiberplane/mcp-gateway-core";

// Create API app with dependency injection
const apiApp = createApp({
  queries: {
    queryLogs: (options) => storage.queryLogs(options),
    getServers: () => storage.getServers(),
    getSessions: (serverName) => storage.getSessions(serverName),
    getClients: () => storage.getClients(),
    getMethods: (serverName) => storage.getMethods(serverName),
    clearAll: () => storage.clearAll(),
  },
  logger,
  // Optional: Enable server management endpoints
  serverManagement: {
    getRegisteredServers: () => storage.getRegisteredServers(),
    addServer: (config) => storage.addServer(config),
    updateServer: (name, changes) => storage.updateServer(name, changes),
    removeServer: (name) => storage.removeServer(name),
  },
});

// Wrap with auth middleware (in orchestration layer)
const authToken = process.env.MCP_GATEWAY_TOKEN || generateToken();
const authMiddleware = createAuthMiddleware(authToken);

const protectedApi = new Hono();
protectedApi.use("/*", authMiddleware);  // Add auth
protectedApi.route("/", apiApp);         // Mount API

app.route("/api", protectedApi);
```

## Key Endpoints

- `GET /logs` - Query logs with filters (server, session, method, time range)
- `GET /servers` - List servers with captured traffic
- `GET /sessions` - List sessions with time ranges
- `GET /clients` - List unique clients
- `GET /methods` - List unique MCP methods
- `POST /logs/clear` - Clear all captured logs

### Server Management (optional)
- `GET /servers/config` - List registered servers
- `POST /servers/config` - Add new server
- `PUT /servers/config/:name` - Update server
- `DELETE /servers/config/:name` - Remove server

## Architecture

Uses dependency injection for flexibility:
- **Testable** - Inject mock functions for unit tests
- **Flexible** - Use custom storage implementations
- **Decoupled** - No direct dependency on storage internals

## Full Documentation

- [Main README](../../README.md) - User guide and CLI reference
- [API Specification](../../docs/api/API_SPECIFICATION.md) - Complete endpoint reference
- [Architecture Overview](../../docs/architecture/overview.md) - System design

## Development

```bash
# Build
bun run build

# Type check
bun run typecheck
```

## License

MIT
