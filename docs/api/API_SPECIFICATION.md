# MCP Gateway API Specification

## Overview

REST API for querying MCP traffic logs captured by the gateway. Built with Hono, mounted at `/api` in the main gateway server.

**Base URL:** `http://localhost:3333/api` (when running locally)

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
  direction: 'request' | 'response';
  metadata: {
    serverName: string;
    sessionId: string;
    durationMs: number;
    httpStatus: number;
    client?: ClientInfo;
  };
  request?: JsonRpcRequest;    // For request direction
  response?: JsonRpcResponse;  // For response direction
}
```

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
  serverName?: string;         // Filter by server name (exact match)
  sessionId?: string;          // Filter by session ID (exact match)
  method?: string;             // Filter by JSON-RPC method (partial match)
  after?: string;              // ISO timestamp - logs after this time
  before?: string;             // ISO timestamp - logs before this time
  limit?: number;              // Max results to return (default: 100, max: 1000)
  order?: 'asc' | 'desc';     // Sort order by timestamp (default: 'desc')
}
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
- `server` - Filter by server name (optional)
- `session` - Filter by session ID (optional)
- `method` - Filter by method name (optional)
- `after` - ISO timestamp filter (optional)
- `before` - ISO timestamp filter (optional)
- `limit` - Results limit, max 1000 (optional, default: 100)
- `order` - 'asc' or 'desc' (optional, default: 'desc')

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

## Implementation Notes

### Storage Backend
- Logs are stored in SQLite database
- Queries use Drizzle ORM for type-safe data access
- All queries are read-only through this API

### Pagination
- Uses cursor-based pagination with `hasMore` flag
- Includes `oldestTimestamp` and `newestTimestamp` for range queries
- Results are sorted by timestamp

### Performance
- Queries run directly against SQLite for efficiency
- No in-memory caching at API layer
- Limit enforced at database level
