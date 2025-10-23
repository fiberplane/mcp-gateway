# Architecture Overview

## System Design

MCP Gateway is designed as a **multi-layered system** that provides centralized management and logging for MCP (Model Context Protocol) servers.

```
┌─────────────────────────────────────────────────────────────────────┐
│                           MCP Gateway                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Presentation Layer                       │  │
│  │  ┌──────────────┐  ┌────────────────┐  ┌──────────────┐   │  │
│  │  │  Web UI      │  │  Terminal UI   │  │  REST API    │   │  │
│  │  │  (React)     │  │  (OpenTUI)     │  │  (Hono)      │   │  │
│  │  └──────────────┘  └────────────────┘  └──────────────┘   │  │
│  │         │                  │                   │           │  │
│  └─────────┼──────────────────┼───────────────────┼───────────┘  │
│            │                  │                   │              │
│  ┌─────────┼──────────────────┼───────────────────┼───────────┐  │
│  │  Application Layer (Gateway Business Logic)    │           │  │
│  │                                                 │           │  │
│  │  ┌────────────────────────────────────────┐   │           │  │
│  │  │  MCP Server Router & Proxy              │   │           │  │
│  │  │  - Routes requests to servers           │   │           │  │
│  │  │  - Handles OAuth flows                  │   │           │  │
│  │  │  - Captures traffic                     │   │           │  │
│  │  └────────────────────────────────────────┘   │           │  │
│  │                      │                         │           │  │
│  │  ┌────────────────────────────────────────┐   │           │  │
│  │  │  Registry Management                    │   │           │  │
│  │  │  - Server registration                  │   │           │  │
│  │  │  - Health checks                        │   │           │  │
│  │  │  - Configuration management             │   │           │  │
│  │  └────────────────────────────────────────┘   │           │  │
│  │                      │                         │           │  │
│  └──────────────────────┼─────────────────────────┼───────────┘  │
│                         │                         │              │
│  ┌──────────────────────┴─────────────────────────┴───────────┐  │
│  │          Data Layer (Storage & Logging)        │           │  │
│  │                                                 │           │  │
│  │  ┌────────────────────────────────────────┐   │           │  │
│  │  │  Capture & Logging                      │   │           │  │
│  │  │  - Write MCP traffic to storage         │   │           │  │
│  │  │  - Index logs for querying              │   │           │  │
│  │  │  - Session metadata tracking            │   │           │  │
│  │  └────────────────────────────────────────┘   │           │  │
│  │                      │                         │           │  │
│  │  ┌────────────────────────────────────────┐   │           │  │
│  │  │  Storage Backend                        │   │           │  │
│  │  │  - SQLite database (logs & metadata)    │   │           │  │
│  │  │  - mcp.json (registry)                  │   │           │  │
│  │  └────────────────────────────────────────┘   │           │  │
│  └──────────────────────────────────────────────┼───────────┘  │
│                                                 │              │
└─────────────────────────────────────────────────┼──────────────┘
                                                  │
                               ┌──────────────────┴──────────────────┐
                               │                                     │
                      ┌────────▼───────┐              ┌─────────────▼────┐
                      │  MCP Server 1  │              │  MCP Server N    │
                      │  (e.g., ours)  │   . . .      │  (e.g., Claude)  │
                      └────────────────┘              └──────────────────┘
```

## Core Components

### 1. Presentation Layer

#### Web UI (React)
- **Location**: `packages/web/`
- **Purpose**: User-friendly dashboard for browsing logs and managing servers
- **Technology**: React 19, TanStack Router, TanStack Query, Tailwind CSS
- **Features**:
  - Server registration and management
  - Log browsing with filtering
  - Real-time metrics display
  - Health status monitoring

#### Terminal UI (TUI)
- **Location**: `packages/mcp-gateway/src/tui/`
- **Purpose**: Full-featured CLI for power users
- **Technology**: OpenTUI, React for terminal components
- **Features**:
  - Server management
  - Activity log viewing
  - Keyboard shortcuts
  - Real-time updates

#### REST API
- **Location**: `packages/api/`
- **Purpose**: Programmatic access to logs and server data
- **Technology**: Hono web framework, Drizzle ORM
- **Features**:
  - Query logs with filters
  - Server status endpoints
  - Health check results
  - Metrics aggregation

### 2. Application Layer

#### MCP Server Router & Proxy
- **Location**: `packages/server/`
- **Purpose**: Routes incoming MCP requests to appropriate servers
- **Responsibilities**:
  - Request routing by server name
  - OAuth flow handling
  - SSE event forwarding
  - Traffic capture integration

#### Registry Management
- **Location**: `packages/core/src/registry/`
- **Purpose**: Centralized server configuration management
- **Features**:
  - Server configuration (name, URL, headers)
  - Health checks (periodic and on-demand)
  - Server discovery and listing
  - Configuration persistence

#### Gateway Interface
- **Location**: `packages/types/src/gateway.ts`
- **Purpose**: Unified API for all operations
- **Exposes**:
  - Capture operations (logging)
  - Registry operations (server management)
  - Storage operations (querying logs)
  - Health check operations

### 3. Data Layer

#### Capture & Logging
- **Location**: `packages/core/src/capture/`
- **Purpose**: Captures and indexes MCP traffic
- **Operations**:
  - Write capture records to storage
  - Track request/response pairs
  - Record session metadata
  - Update server metrics

#### Storage Backends
- **SQLite Backend**
  - Location: `packages/core/src/capture/backends/sqlite-backend.ts`
  - Stores: All captured logs and metrics
  - Queries: Log search, aggregations, metrics

- **File Storage**
  - Location: `~/.mcp-gateway/`
  - mcp.json: Server registry configuration
  - logs.db: SQLite database
  - {server}/: Per-server capture data (if enabled)

## Data Flow

### Request Capture Flow

```
MCP Client Request
       │
       ▼
┌──────────────────────────┐
│  MCP Server Proxy        │
│  (HTTP endpoint)         │
│  /mcp                    │
└──────────────────────────┘
       │
       ├─▶ Extract metadata (server, session, etc.)
       │
       ├─▶ Create request capture record
       │
       ▼
┌──────────────────────────┐
│  Forward to MCP Server   │
│  (URL from registry)     │
└──────────────────────────┘
       │
       ├─▶ Receive response
       │
       ├─▶ Create response capture record
       │
       ├─▶ Record metrics (duration, status)
       │
       ▼
┌──────────────────────────┐
│  Write to Storage        │
│  (SQLite)                │
│  - Log entry             │
│  - Metrics               │
│  - Session metadata      │
└──────────────────────────┘
       │
       ▼
Return response to MCP Client
```

### Log Query Flow

```
User queries logs (Web UI/API)
       │
       ▼
┌──────────────────────────┐
│  Query Parameters        │
│  - Filter (server, time) │
│  - Pagination           │
│  - Sort                 │
└──────────────────────────┘
       │
       ▼
┌──────────────────────────┐
│  Query Layer             │
│  (packages/api/)         │
│  Construct SQL           │
└──────────────────────────┘
       │
       ▼
┌──────────────────────────┐
│  SQLite Backend          │
│  Execute query           │
│  Return results          │
└──────────────────────────┘
       │
       ▼
┌──────────────────────────┐
│  Format Results          │
│  - Rich text formatting  │
│  - Pagination info       │
└──────────────────────────┘
       │
       ▼
Display to User
```

## Package Dependencies

```
@fiberplane/mcp-gateway-types
  ↑
  ├─ @fiberplane/mcp-gateway-core
  │   ├─ @fiberplane/mcp-gateway-api
  │   ├─ @fiberplane/mcp-gateway-server
  │   └─ @fiberplane/mcp-gateway-cli
  │
  ├─ @fiberplane/mcp-gateway-web
  │
  └─ @fiberplane/mcp-gateway (public wrapper)
```

### Dependency Rules

- **No circular dependencies** - Enforced by madge in CI
- **Types-first design** - Shared types in types package
- **API uses dependency injection** - Decouples from implementations
- **Clear boundaries** - Each package has specific responsibility

## State Management

### Server Registry State

**Stored in**: `~/.mcp-gateway/mcp.json`

```json
{
  "servers": [
    {
      "name": "server-name",
      "url": "http://server.example.com",
      "type": "http",
      "headers": {},
      "health": "up|down|unknown",
      "lastHealthCheck": "2024-10-22T00:00:00Z",
      "lastActivity": "2024-10-22T00:00:00Z",
      "exchangeCount": 42
    }
  ]
}
```

### Log Storage

**Stored in**: `~/.mcp-gateway/logs.db` (SQLite)

```sql
-- Main logs table
CREATE TABLE logs (
  id INTEGER PRIMARY KEY,
  timestamp TEXT,
  method TEXT,
  request JSON,
  response JSON,
  metadata JSON,
  ...
);

-- Session metadata
CREATE TABLE session_metadata (
  sessionId TEXT PRIMARY KEY,
  client JSON,
  server JSON
);
```

### In-Memory State

**Gateway Instance**:
- Client info cache (per-session)
- Server info cache (per-session)
- Request tracker (for duration calculation)
- Health check state
- Registry cache (for performance)

## Caching Strategy

### Registry Cache
- **What**: Server list with computed metrics
- **Where**: In-memory in StorageManager
- **Why**: Metrics require database queries
- **Invalidation**:
  - Server registry changes (add/remove/update)
  - New log writes (metrics depend on logs)
  - Log clear operations

### Client/Server Info Cache
- **What**: Session metadata
- **Where**: In-memory in Gateway.clientInfo / Gateway.serverInfo
- **Why**: Performance + SQLite fallback for persistence
- **Lifecycle**: Per-session, cleared on session end

## Error Handling

### Request Capture Failures
- Logged but don't break the proxy
- Errors persisted in capture record
- User can see failed captures in logs

### Storage Failures
- Write failures logged
- Don't break the proxy
- User can still view previously captured data

### Server Connection Failures
- Gateway proxies the error response
- Captures the error in logs
- Marks server health as down

## Performance Characteristics

### Throughput
- **Typical**: 1000s of MCP requests/second per gateway
- **Bottleneck**: SQLite write performance
- **Optimization**: WAL mode, batch writes

### Memory Usage
- **Baseline**: ~50MB
- **Per-session**: ~100KB - 1MB depending on data
- **Cache**: Registry cache ~10KB, grows with servers

### Latency
- **Proxy overhead**: <5ms typical
- **Capture overhead**: <1ms
- **Log query**: 10-100ms depending on date range

## Scalability Considerations

### Single Gateway Limits
- **Servers**: 100-1000 (filesystem limited)
- **Sessions**: 1000+ concurrent
- **Throughput**: Limited by SQLite write performance
- **Storage**: ~1MB per 10,000 MCP exchanges

### Scaling Options
1. **Multiple gateways**: Run separate instances per environment
2. **Log rotation**: Implement external log archival
3. **Database**: Replace SQLite with PostgreSQL for production
4. **Distribution**: Deploy in containers with shared storage

## Security Architecture

See [SECURITY.md](../../SECURITY.md) for complete security model.

**Key Design Decisions**:
- Localhost-only by default
- No authentication required (assumes local network trust)
- All traffic logged to local disk
- Tokens stored unencrypted (design choice for dev tool)

## Design Decisions

### Why Monorepo?
- Clear separation of concerns
- Shared type definitions
- Independent versioning/release
- Flexibility in deployment

### Why SQLite?
- No external dependencies
- Embedded (no server needed)
- Good performance for typical workloads
- Easy backup and portability

### Why Bun?
- Fast JavaScript runtime
- Native TypeScript support
- Better binary distribution
- Excellent package manager

### Why Dual UI (Web + TUI)?
- Web UI for most users
- TUI for power users and CI/CD
- Share same API backend
- Independent development

## Testing Architecture

See [Testing](../development/testing.md) for detailed testing strategy.

- **Unit tests**: Per-package, isolated concerns
- **Integration tests**: API + storage interaction
- **E2E tests**: Full system workflows
- **Test MCP server**: For validation

## Monitoring & Observability

### Built-in Logging
- Structured logging throughout
- Configurable log levels
- Time-series data in database

### Metrics Available
- Server health status
- Request count per server
- Error rates and types
- Response times
- Cache hit rates

### Future Enhancements
- [ ] OpenTelemetry integration
- [ ] Prometheus metrics export
- [ ] Log aggregation support
- [ ] Real-time alerting

---

**Related Documentation**:
- [Monorepo Structure](../development/monorepo-structure.md)
- [Development Setup](../development/setup.md)
- [API Specification](../api/specification.md)
- [Security Model](../../SECURITY.md)
