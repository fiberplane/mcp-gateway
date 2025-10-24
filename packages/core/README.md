# Core Package - MCP Gateway Business Logic

The `@fiberplane/mcp-gateway-core` package contains all business logic for MCP Gateway, including server registry management, MCP traffic capture, log storage, and health monitoring.

## Package Structure

```
src/
├── registry/           # Server registry and configuration
│   ├── registry.ts     # Registry interface and types
│   ├── storage.ts      # File-based persistence (mcp.json)
│   └── health.ts       # Health check operations
├── capture/            # MCP traffic capture and storage
│   ├── capture.ts      # Capture operations interface
│   ├── storage-manager.ts # Storage backend management
│   └── backends/       # Storage implementations
│       └── sqlite-backend.ts # SQLite storage
├── logs/               # Log querying and filtering
│   ├── logs.ts         # Query interface and types
│   └── queries.ts      # Log query implementations
├── mcp/                # MCP server implementation
│   ├── server.ts       # MCP server factory
│   └── tools.ts        # Built-in MCP tools
├── gateway.ts          # Main Gateway facade
├── health.ts           # Health check orchestration
├── logger.ts           # Structured logging
└── index.ts            # Public exports
```

## Core Modules

### Registry (`src/registry/`)

Manages server configuration and registration.

**Key Concepts:**
- **Server Registry**: List of registered MCP servers with name, URL, and headers
- **Health Checks**: Periodic health monitoring of registered servers
- **Persistence**: Registry stored in `~/.mcp-gateway/mcp.json`

**Main Exports:**
- `loadRegistry()` - Load servers from storage
- `saveRegistry()` - Persist servers to storage
- `checkServerHealth()` - Perform health check on server

**Example:**
```typescript
import { loadRegistry, saveRegistry, checkServerHealth } from "@fiberplane/mcp-gateway-core";

const servers = await loadRegistry(storageDir);
const health = await checkServerHealth("http://localhost:5000");
```

### Capture (`src/capture/`)

Captures and stores MCP protocol traffic.

**Key Concepts:**
- **Capture Records**: Request/response pairs with metadata
- **Storage Backends**: Pluggable storage implementations
- **Session Tracking**: Groups related requests by session
- **Metrics Calculation**: Request counts, error rates, response times

**Main Exports:**
- `CaptureRecord` - Type for captured request/response
- `Capture` - Interface for capture operations
- `StorageManager` - Manages storage backends
- `createCapture()` - Factory for capture instance

**Example:**
```typescript
import { createCapture } from "@fiberplane/mcp-gateway-core";

const capture = createCapture(storageDir);
await capture.write({
  id: "req-123",
  timestamp: new Date().toISOString(),
  request: { jsonrpc: "2.0", method: "initialize" },
  response: { jsonrpc: "2.0", result: {} },
  // ... additional metadata
});
```

### Logs (`src/logs/`)

Queries captured logs with filtering and pagination.

**Key Concepts:**
- **Log Queries**: Filter by server, time range, method, session
- **Pagination**: Efficient retrieval of large log sets
- **Aggregation**: Compute statistics across logs
- **Formatting**: Rich text output with colors and formatting

**Main Exports:**
- `LogQueryOptions` - Query parameters
- `LogQueryResult` - Query result type
- `Logs` - Interface for log operations
- `createLogs()` - Factory for logs instance

**Example:**
```typescript
import { createLogs } from "@fiberplane/mcp-gateway-core";

const logs = createLogs(storageDir);
const results = await logs.query({
  server: "my-server",
  since: new Date(Date.now() - 24 * 60 * 60 * 1000),
  limit: 100,
});
```

### MCP Server (`src/mcp/`)

Creates an MCP server that provides built-in tools for log querying.

**Key Concepts:**
- **Tools**: MCP tools exposed by the gateway
- **Prompts**: MCP prompts (templates)
- **Resources**: MCP resources (logs and metrics)

**Main Exports:**
- `McpServer` - MCP server interface
- `createMcpServer()` - Factory for gateway's MCP server

**Example:**
```typescript
import { createMcpServer } from "@fiberplane/mcp-gateway-core";

const server = createMcpServer(storageDir, gateway);
// Server exposes tools like "list_servers", "get_logs", etc.
```

### Gateway (`src/gateway.ts`)

Main facade combining all operations.

**Key Concepts:**
- **Unified Interface**: Single point of access to all operations
- **Initialization**: Sets up all components on startup
- **Cleanup**: Graceful shutdown and resource cleanup
- **Error Handling**: Centralized error handling across operations

**Main Exports:**
- `Gateway` - Main interface (type defined in types package)
- `createGateway()` - Factory to create gateway instance

**Example:**
```typescript
import { createGateway } from "@fiberplane/mcp-gateway-core";

const gateway = await createGateway({
  storageDir: "~/.mcp-gateway",
});

// Use gateway
const servers = await gateway.storage.getServers();
await gateway.capture.write(captureRecord);
const logs = await gateway.storage.query(options);

// Cleanup
await gateway.close();
```

### Health (`src/health.ts`)

Performs health checks on MCP servers.

**Key Concepts:**
- **Server Connectivity**: Test if server is reachable
- **Protocol Validation**: Verify MCP protocol support
- **Response Time**: Measure health check latency

**Main Exports:**
- `ServerHealth` - Health status type
- `checkServerHealth()` - Perform health check

**Example:**
```typescript
import { checkServerHealth } from "@fiberplane/mcp-gateway-core";

const health = await checkServerHealth("http://localhost:5000");
// Returns: "up", "down", or "unknown"
```

### Logger (`src/logger.ts`)

Structured logging throughout the core.

**Key Concepts:**
- **Levels**: Debug, info, warn, error
- **Structured Data**: JSON output for parsing
- **Namespacing**: Per-module log contexts

**Main Exports:**
- `logger` - Singleton logger instance
- `createLogger()` - Create scoped logger

**Example:**
```typescript
import { logger, createLogger } from "@fiberplane/mcp-gateway-core";

const registryLogger = createLogger("registry");
registryLogger.info("Server registered", { name: "my-server" });
```

## Data Models

### CaptureRecord

Represents a single captured MCP request/response exchange:

```typescript
interface CaptureRecord {
  id: string;
  timestamp: string; // ISO 8601
  request: JsonRpcRequest;
  response: JsonRpcResponse | null;
  error?: string;
  duration?: number; // milliseconds
  sessionId?: string;
  clientInfo?: ClientInfo;
  serverInfo?: McpServerInfo;
  status?: number; // HTTP status
  headers?: Record<string, string>;
}
```

### McpServer

Server configuration:

```typescript
interface McpServer {
  name: string;
  url: string;
  type: "http";
  headers?: Record<string, string>;
  health: ServerHealth;
  lastHealthCheck?: string; // ISO 8601
  lastActivity?: string; // ISO 8601
  exchangeCount?: number;
}
```

## Storage

### SQLite Database

Located at `~/.mcp-gateway/logs.db`, the SQLite database stores:

**Tables:**
- `logs` - Captured MCP traffic
- `session_metadata` - Session information
- `metrics` - Computed statistics (if stored)

**Features:**
- WAL (Write-Ahead Logging) mode for concurrent access
- Indexed queries for fast filtering
- Automatic cleanup of old records

### File Storage

Located at `~/.mcp-gateway/mcp.json`:

```json
{
  "servers": [
    {
      "name": "server-name",
      "url": "http://server.example.com",
      "type": "http",
      "headers": {},
      "health": "up",
      "lastHealthCheck": "2024-10-22T00:00:00Z",
      "lastActivity": "2024-10-22T00:00:00Z",
      "exchangeCount": 42
    }
  ]
}
```

## Caching Strategy

### Registry Cache

**What:** Server list with computed metrics (request count, health status)
**Where:** In-memory in StorageManager
**Why:** Metrics require database queries, cache improves performance
**Invalidation:** Cleared when:
- Server registry changes (add/remove/update)
- New logs are written (metrics depend on logs)
- Logs are cleared

## Error Handling

All operations include error handling:

- **Capture Failures**: Logged but don't break proxy
- **Storage Failures**: Graceful degradation with fallback
- **Health Check Failures**: Return "down" or "unknown" status
- **Query Failures**: Return empty results with error logs

## Performance Characteristics

### Throughput
- Typical: 1000s of MCP requests/second per gateway
- Bottleneck: SQLite write performance
- Optimization: WAL mode, batch writes

### Memory Usage
- Baseline: ~50MB
- Per-session: ~100KB - 1MB depending on data
- Cache: Registry cache ~10KB, grows with servers

### Latency
- Proxy overhead: <5ms typical
- Capture overhead: <1ms
- Log query: 10-100ms depending on date range

## Usage in MCP Gateway

The CLI package (`@fiberplane/mcp-gateway-cli`) uses core to:

1. **Initialize**: Create gateway instance on startup
2. **Proxy Requests**: Capture and forward MCP traffic
3. **Manage Servers**: Add, remove, and monitor servers
4. **Query Logs**: Search captured traffic
5. **Export Data**: Stream logs to various formats

The API package (`@fiberplane/mcp-gateway-api`) uses core via dependency injection:

```typescript
import { createApiApp } from "@fiberplane/mcp-gateway-api";

const app = createApiApp({
  gateway,
  logs: createLogs(storageDir),
  capture: createCapture(storageDir),
  // ... other dependencies
});
```

## Testing

Core package includes unit tests for:
- Registry operations
- Capture logic
- Log queries
- Health checks
- Error handling

Run tests with:
```bash
bun test packages/core
```

## Related Documentation

- **[Architecture Overview](../architecture/overview.md)** - System design
- **[API Reference](../api/API_SPECIFICATION.md)** - REST API endpoints
- **[Development Guide](../development/development-workflow.md)** - Development workflow

## Contributing

When contributing to core:

1. **Code Style**: Follow TypeScript and naming guidelines
2. **Type Safety**: Ensure strict mode passes
3. **Testing**: Add tests for new functionality
4. **Documentation**: Update JSDoc comments
5. **Performance**: Monitor latency and memory usage

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for detailed guidelines.
