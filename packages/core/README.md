# @fiberplane/mcp-gateway-core

Core business logic for MCP Gateway: server registry, traffic capture, log storage, and health monitoring.

## Key Features

- **Server Registry** - Manage MCP server configurations with file-based persistence
- **Traffic Capture** - Record all MCP requests/responses to SQLite database
- **Log Queries** - Filter and search captured traffic with rich query options
- **Health Monitoring** - Periodic health checks for registered servers
- **Gateway MCP Server** - Built-in MCP server for querying the gateway itself

## Package Structure

```
src/
├── registry/           # Server configuration and health checks
├── capture/            # MCP traffic capture and storage
├── logs/               # Log querying with SQLite (libsql)
├── mcp/                # Gateway's own MCP server
├── health.ts           # Health check orchestration
└── logger.ts           # Structured logging
```

## Quick Example

```typescript
import { LocalStorageBackend } from "@fiberplane/mcp-gateway-core";

// Create storage backend
const storage = await LocalStorageBackend.create("~/.mcp-gateway");

// Write captured traffic
await storage.write({
  timestamp: new Date().toISOString(),
  method: "tools/list",
  id: "1",
  metadata: {
    serverName: "my-server",
    sessionId: "session-123",
    durationMs: 45,
    httpStatus: 200,
  },
  request: { jsonrpc: "2.0", method: "tools/list", id: "1" },
  response: { jsonrpc: "2.0", result: { tools: [] }, id: "1" },
});

// Query logs
const result = await storage.queryLogs({
  serverName: { operator: "is", value: "my-server" },
  limit: 100,
  order: "desc",
});

// Get registered servers
const servers = await storage.getRegisteredServers();
```

## Storage

**Database:** SQLite (via libsql) at `~/.mcp-gateway/logs.db`
- WAL mode for concurrent access
- Captures all MCP traffic with full request/response
- Supports complex queries with filtering and pagination

**Registry:** JSON file at `~/.mcp-gateway/mcp.json`
- Server configurations (name, URL, headers)
- Health status and activity metrics

## Full Documentation

- [Main README](../../README.md) - User guide and CLI reference
- [Architecture Overview](../../docs/architecture/overview.md) - System design
- [API Specification](../../docs/api/API_SPECIFICATION.md) - REST endpoints

## Development

```bash
# Build
bun run build

# Test
bun run test

# Type check
bun run typecheck
```

## License

MIT
