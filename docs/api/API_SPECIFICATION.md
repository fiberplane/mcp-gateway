# MCP Gateway API Specification

## Overview

REST API for querying MCP traffic logs captured by the gateway. Built with Hono, mounted at `/api` in the main gateway server.

**Base URL:** `http://localhost:3333/api` (when running locally)

## Authentication

All API endpoints require authentication via Bearer token.

**Header Format:**
```
Authorization: Bearer <token>
```

**Token Source:**
1. Set via `MCP_GATEWAY_TOKEN` environment variable (recommended)
2. Auto-generated on first startup (shown in console output)

**Example:**
```bash
curl http://localhost:3333/api/logs \
  -H "Authorization: Bearer your-token-here"
```

## Data Models

### CaptureRecord

Represents a single MCP interaction:

```typescript
interface CaptureRecord {
  timestamp: string;           // ISO 8601 timestamp
  method: string;              // JSON-RPC method name
  id: string | number | null;  // JSON-RPC request ID
  metadata: {
    serverName: string;        // MCP server name
    sessionId: string;         // Session identifier
    durationMs: number;        // Request duration in milliseconds
    httpStatus: number;        // HTTP status code
    client?: ClientInfo;       // Client information
  };
  request?: JsonRpcRequest;    // Request payload
  response?: JsonRpcResponse;  // Response payload
}
```

### LogEntry (API Response)

Combined request/response representation:

```typescript
interface LogEntry {
  timestamp: string;
  method: string;
  id: string | number | null;
  direction: 'request' | 'response' | 'sse-event';
  metadata: {
    serverName: string;
    sessionId: string;
    durationMs: number;
    httpStatus: number;
    client?: ClientInfo;
  };
  request?: JsonRpcRequest;    // For request direction
  response?: JsonRpcResponse;  // For response direction
  sseEvent?: {                 // For sse-event direction
    id?: string;
    event?: string;
    data: string;
    retry?: number;
  };
}
```

**Note:** For SSE responses, each server-sent event is returned as a separate log entry with `direction: "sse-event"` and the `sseEvent` field populated.

### Server Info

```typescript
interface ServerInfo {
  name: string;                // Server identifier
  status: ServerStatus;        // "online" | "offline" | "not-found"
}
```

### Session Info

```typescript
interface SessionInfo {
  sessionId: string;
  serverName: string;
  startTime: string;           // ISO timestamp
  endTime: string;             // ISO timestamp
}
```

### Query Options

Supported filters for `/logs` endpoint:

```typescript
interface LogQueryOptions {
  // Basic filters
  serverName?: string;         // Filter by server name
  sessionId?: string;          // Filter by session ID
  method?: string;             // Filter by JSON-RPC method
  client?: string;             // Filter by client name
  after?: string;              // ISO timestamp - logs after this time
  before?: string;             // ISO timestamp - logs before this time
  limit?: number;              // Max results to return (default: 100, max: 1000)
  order?: 'asc' | 'desc';      // Sort order by timestamp (default: 'desc')
  
  // Full-text search
  q?: string | string[];       // Search term(s) - multiple values use AND logic
  
  // Duration filters (milliseconds)
  durationEq?: number | number[];   // Exact duration (array = OR logic)
  durationGt?: number;              // Duration greater than
  durationGte?: number;             // Duration greater than or equal
  durationLt?: number;              // Duration less than
  durationLte?: number;             // Duration less than or equal
  
  // Token filters (total count)
  tokensEq?: number | number[];     // Exact token count (array = OR logic)
  tokensGt?: number;                // Tokens greater than
  tokensGte?: number;               // Tokens greater than or equal
  tokensLt?: number;                // Tokens less than
  tokensLte?: number;               // Tokens less than or equal
}
```

### Advanced Query Parameters

**String Filters with Operators:**

String filters (`server`, `session`, `method`, `client`) support operator prefixes for precise matching:
- `is:value` - Exact match
- `contains:value` - Partial match (substring)
- Plain value defaults to field-specific behavior

Multiple values create OR logic:
```bash
# Either figma-server OR notion-server
?server=is:figma-server&server=is:notion-server
```

**Full-Text Search:**

The `q` parameter searches across request/response JSON content:
```bash
# Find logs containing "error"
?q=error

# Find logs with both "error" AND "timeout" (AND logic)
?q=error&q=timeout
```

**Numeric Filters:**

Duration and token filters support exact match, ranges, and arrays:
```bash
# Requests taking exactly 500ms
?durationEq=500

# Requests between 1-5 seconds
?durationGte=1000&durationLte=5000

# Requests with either 100 or 200 tokens
?tokensEq=100&tokensEq=200
```

### Paginated Response

```typescript
interface QueryResult {
  data: LogEntry[];
  pagination: {
    count: number;             // Number of items in this result
    limit: number;             // Query limit
    hasMore: boolean;          // Whether more results exist
    oldestTimestamp: string | null;  // Oldest timestamp in results
    newestTimestamp: string | null;  // Newest timestamp in results
  };
}
```

## Endpoints

### 1. Query Logs

Retrieve logs with optional filtering and sorting.

**Endpoint:** `GET /api/logs`

**Query Parameters:**
- `server` - Filter by server name (supports `is:` and `contains:` operators)
- `session` - Filter by session ID (supports operators)
- `method` - Filter by method name (supports operators)
- `client` - Filter by client name (supports operators)
- `q` - Full-text search term (multiple values use AND logic)
- `after` - ISO timestamp filter (optional)
- `before` - ISO timestamp filter (optional)
- `durationEq`, `durationGt`, `durationGte`, `durationLt`, `durationLte` - Duration filters in milliseconds
- `tokensEq`, `tokensGt`, `tokensGte`, `tokensLt`, `tokensLte` - Token count filters
- `limit` - Results limit, max 1000 (optional, default: 100)
- `order` - 'asc' or 'desc' (optional, default: 'desc')

See "Advanced Query Parameters" section for detailed operator syntax and examples.

**Response:** `200 OK`

```json
{
  "data": [
    {
      "timestamp": "2025-01-15T10:30:00.000Z",
      "method": "tools/call",
      "id": "req-123",
      "direction": "request",
      "metadata": {
        "serverName": "figma-server",
        "sessionId": "6b33fe88",
        "durationMs": 329,
        "httpStatus": 200,
        "client": {
          "name": "claude-code",
          "version": "2.0.10"
        }
      },
      "request": {
        "jsonrpc": "2.0",
        "id": "req-123",
        "method": "tools/call",
        "params": { }
      }
    },
    {
      "timestamp": "2025-01-15T10:30:00.250Z",
      "method": "tools/call",
      "id": "req-123",
      "direction": "response",
      "metadata": {
        "serverName": "figma-server",
        "sessionId": "6b33fe88",
        "durationMs": 329,
        "httpStatus": 200
      },
      "response": {
        "jsonrpc": "2.0",
        "id": "req-123",
        "result": { }
      }
    }
  ],
  "pagination": {
    "count": 2,
    "limit": 100,
    "hasMore": false,
    "oldestTimestamp": "2025-01-15T10:30:00.000Z",
    "newestTimestamp": "2025-01-15T10:30:00.250Z"
  }
}
```

**Example Requests:**

```bash
# Get all logs
GET /api/logs

# Filter by server
GET /api/logs?server=figma-server

# Filter by session and method
GET /api/logs?session=6b33fe88&method=tools/call

# Filter by time range (older logs first)
GET /api/logs?after=2025-01-15T00:00:00Z&before=2025-01-15T23:59:59Z&order=asc

# With custom limit
GET /api/logs?limit=50

# Operator-based filtering
GET /api/logs?method=contains:tools&server=is:figma-server

# Full-text search
GET /api/logs?q=error&q=timeout

# Duration range (1-5 seconds)
GET /api/logs?durationGte=1000&durationLte=5000

# High token usage
GET /api/logs?tokensGt=1000
```

### 2. List Servers

Get list of all servers with captured logs.

**Endpoint:** `GET /api/servers`

**Response:** `200 OK`

```json
{
  "servers": [
    {
      "name": "figma-server",
      "status": "online"
    },
    {
      "name": "notion-server",
      "status": "online"
    }
  ]
}
```

### 3. List Sessions

Get list of sessions, optionally filtered by server.

**Endpoint:** `GET /api/sessions`

**Query Parameters:**
- `server` - Filter sessions by server name (optional)

**Response:** `200 OK`

```json
{
  "sessions": [
    {
      "sessionId": "6b33fe88",
      "serverName": "figma-server",
      "startTime": "2025-01-15T10:00:00.000Z",
      "endTime": "2025-01-15T10:45:00.000Z"
    }
  ]
}
```

### 4. List Clients

Get all clients that have connected through the gateway.

**Endpoint:** `GET /api/clients`

**Response:** `200 OK`

```json
{
  "clients": [
    {
      "name": "claude-desktop",
      "version": "1.0.0",
      "logCount": 145,
      "sessionCount": 3
    }
  ]
}
```

### 5. Get Server Configurations

Retrieve full server configurations including commands, URLs, headers, and environment variables.

**Endpoint:** `GET /api/servers/config`

**Response:** `200 OK`

```json
{
  "servers": [
    {
      "name": "figma-server",
      "type": "http",
      "url": "http://localhost:3001",
      "headers": {},
      "lastCheckTime": "2025-01-15T10:00:00.000Z",
      "isHealthy": true,
      "responseTimeMs": 45
    },
    {
      "name": "memory-server",
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {},
      "sessionMode": "shared",
      "processState": {
        "status": "running",
        "pid": 12345,
        "lastError": null,
        "stderrLogs": []
      }
    }
  ]
}
```

### 6. Add Server

Add a new MCP server (HTTP or stdio).

**Endpoint:** `POST /api/servers/config`

**Request Body (HTTP Server):**
```json
{
  "name": "my-http-server",
  "type": "http",
  "url": "http://localhost:3001",
  "headers": {
    "Authorization": "Bearer token123"
  }
}
```

**Request Body (Stdio Server):**
```json
{
  "name": "my-stdio-server",
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-memory"],
  "env": {
    "API_KEY": "secret"
  },
  "sessionMode": "shared"
}
```

**Response:** `201 Created`

### 7. Update Server

Update existing server configuration.

**Endpoint:** `PUT /api/servers/config/:name`

**Request Body:** Same format as Add Server

**Response:** `200 OK`

### 8. Delete Server

Remove a server configuration.

**Endpoint:** `DELETE /api/servers/config/:name`

**Response:** `204 No Content`

### 9. Manual Health Check

Trigger manual health check for HTTP servers.

**Endpoint:** `POST /api/servers/:name/health-check`

**Response:** `200 OK`

```json
{
  "isHealthy": true,
  "responseTimeMs": 45,
  "checkedAt": "2025-01-15T10:00:00.000Z"
}
```

### 10. Restart Stdio Server

Restart a stdio server (shared mode only).

**Endpoint:** `POST /api/servers/:name/restart`

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Server restarted successfully"
}
```

**Note:** Only works for stdio servers in shared mode. Isolated mode servers restart automatically per session.

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Error description"
  }
}
```

**HTTP Status Codes:**
- `400 Bad Request` - Invalid query parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Storage not accessible

## Validation

Query parameters are validated using Zod schemas:

```typescript
const logsQuerySchema = z.object({
  server: z.string().optional(),
  session: z.string().optional(),
  method: z.string().optional(),
  after: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});
```

Invalid parameters return `400 Bad Request` with validation errors.

## Management via MCP Protocol

The gateway exposes its own MCP server for programmatic management.

**Endpoints:**
- `/gateway` - Full path
- `/g` - Shortened alias

**Authentication:** Same Bearer token as REST API (configure in MCP client)

**Available Tools:**
1. `add_server` - Add HTTP or stdio server
2. `remove_server` - Delete server by name
3. `list_servers` - List all configured servers with health status
4. `search_records` - Query captured logs (supports all filter options)

**Usage Example (Claude Desktop):**
```json
{
  "mcpServers": {
    "mcp-gateway-manager": {
      "url": "http://localhost:3333/g",
      "headers": {
        "Authorization": "Bearer your-token-here"
      }
    }
  }
}
```

Once configured, use natural language:
- "Add a Figma MCP server at http://localhost:3001"
- "Show me all servers and their health status"
- "Search for errors in the last hour"

**Package:** `@fiberplane/mcp-gateway-management-mcp`

## OAuth/OIDC Proxy

The gateway proxies OAuth 2.0/OIDC discovery endpoints for HTTP servers.

**Proxied Endpoints:**
- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-authorization-server`
- `/.well-known/openid-configuration`
- `/register` (Dynamic Client Registration)

**URL Rewriting:**

The gateway rewrites URLs in discovery metadata to point through the gateway proxy:
- `https://upstream-server.com/token` → `http://localhost:3333/s/server-name/token`

**Behavior:**
- Lightweight proxy (no logging or capture)
- Only works for HTTP servers
- Automatically available for all configured HTTP servers

**Use Case:**
Allows MCP clients to authenticate with OAuth-enabled MCP servers through the gateway while maintaining traffic capture for authenticated requests.

## Implementation Notes

### Storage Backend
- Logs are stored in SQLite database
- Queries use Drizzle ORM for type-safe data access
- All queries are read-only through this API

### Dependency Injection

The API package (`@fiberplane/mcp-gateway-api`) uses dependency injection for data access:
- Zero direct imports from `@fiberplane/mcp-gateway-core`
- All queries passed via `QueryFunctions` interface
- Decouples API layer from storage implementation
- Enables testing with mock implementations

**Benefit:** API can be embedded in other applications with custom storage backends

### Pagination
- Uses cursor-based pagination with `hasMore` flag
- Includes `oldestTimestamp` and `newestTimestamp` for range queries
- Results are sorted by timestamp

### Performance
- Queries run directly against SQLite for efficiency
- No in-memory caching at API layer
- Limit enforced at database level
