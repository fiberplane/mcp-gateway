# MCP Gateway API Specification

## Overview

REST API for querying and analyzing captured MCP traffic logs. Built with Hono, served on localhost for local development.

**Base URL:** `http://localhost:3000/api`

## Data Models

### CaptureRecord

Represents a single MCP interaction (already defined in `@fiberplane/mcp-gateway-types`):

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
    sseEventId?: string;       // SSE event ID (if applicable)
    sseEventType?: string;     // SSE event type (if applicable)
  };
  request?: JsonRpcRequest;    // Request payload
  response?: JsonRpcResponse;  // Response payload
  sseEvent?: SSEEvent;         // SSE event data
}
```

### LogEntry (API Response)

Extended version with computed fields for UI:

```typescript
interface LogEntry extends CaptureRecord {
  // Computed fields
  direction: 'request' | 'response' | 'notification' | 'sse';
  sender: string;              // Client name or server name
  receiver: string;            // Server name or client name
  hasError: boolean;           // Whether response contains error
  tokens?: {                   // Token usage (if available)
    input?: number;
    output?: number;
    total?: number;
  };
}
```

### Query Parameters

```typescript
interface LogQueryParams {
  // Pagination
  page?: number;              // Page number (1-indexed), default: 1
  limit?: number;             // Items per page, default: 50, max: 1000

  // Filtering
  serverName?: string;        // Filter by server name
  sessionId?: string;         // Filter by session ID
  method?: string;            // Filter by method name
  search?: string;            // Full-text search in request/response
  hasError?: boolean;         // Filter by error presence
  minDuration?: number;       // Minimum duration in ms
  maxDuration?: number;       // Maximum duration in ms
  startTime?: string;         // ISO timestamp - logs after this time
  endTime?: string;           // ISO timestamp - logs before this time

  // Sorting
  sortBy?: 'timestamp' | 'duration' | 'method' | 'server';
  sortOrder?: 'asc' | 'desc'; // Default: 'desc' for timestamp
}
```

### Paginated Response

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;          // Total number of items
    totalPages: number;     // Total number of pages
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

## Endpoints

### 1. List Logs

Retrieve paginated, filtered list of log entries.

**Endpoint:** `GET /api/logs`

**Query Parameters:** See `LogQueryParams` above

**Response:** `200 OK`

```json
{
  "data": [
    {
      "timestamp": "2025-01-15T10:30:00.000Z",
      "method": "tools/call",
      "id": "req-123",
      "direction": "request",
      "sender": "claude-code",
      "receiver": "figma-server",
      "hasError": false,
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
        "params": { ... }
      },
      "tokens": {
        "input": 1500,
        "output": 300,
        "total": 1800
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 243,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Example Requests:**

```bash
# Get first page
GET /api/logs

# Filter by server
GET /api/logs?serverName=figma-server

# Filter by session and method
GET /api/logs?sessionId=6b33fe88&method=tools/call

# Search in request/response
GET /api/logs?search=screenshot

# Filter by time range
GET /api/logs?startTime=2025-01-15T00:00:00Z&endTime=2025-01-15T23:59:59Z

# Filter by duration (slow requests)
GET /api/logs?minDuration=1000

# Sort by duration
GET /api/logs?sortBy=duration&sortOrder=desc

# Pagination
GET /api/logs?page=2&limit=100
```

### 2. Get Single Log Entry

Retrieve detailed information for a specific log entry.

**Endpoint:** `GET /api/logs/:id`

**Path Parameters:**
- `id` - Composite ID: `{sessionId}:{timestamp}:{jsonrpcId}`

**Response:** `200 OK`

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "method": "tools/call",
  "id": "req-123",
  "direction": "request",
  "sender": "claude-code",
  "receiver": "figma-server",
  "hasError": false,
  "metadata": { ... },
  "request": { ... },
  "response": { ... },
  "tokens": { ... }
}
```

**Error Response:** `404 Not Found`

```json
{
  "error": "Log entry not found",
  "id": "session123:2025-01-15T10:30:00.000Z:req-123"
}
```

### 3. List Servers

Get list of all MCP servers with captured logs.

**Endpoint:** `GET /api/servers`

**Response:** `200 OK`

```json
{
  "servers": [
    {
      "name": "figma-server",
      "displayName": "Figma Server",
      "logCount": 150,
      "sessionCount": 3,
      "firstSeen": "2025-01-15T08:00:00.000Z",
      "lastSeen": "2025-01-15T12:00:00.000Z"
    },
    {
      "name": "notion-server",
      "displayName": "Notion Server",
      "logCount": 89,
      "sessionCount": 2,
      "firstSeen": "2025-01-15T09:00:00.000Z",
      "lastSeen": "2025-01-15T11:30:00.000Z"
    }
  ]
}
```

### 4. List Sessions

Get list of all sessions, optionally filtered by server.

**Endpoint:** `GET /api/sessions`

**Query Parameters:**
- `serverName` (optional) - Filter sessions by server

**Response:** `200 OK`

```json
{
  "sessions": [
    {
      "sessionId": "6b33fe88",
      "serverName": "figma-server",
      "logCount": 45,
      "client": {
        "name": "claude-code",
        "version": "2.0.10"
      },
      "startTime": "2025-01-15T10:00:00.000Z",
      "endTime": "2025-01-15T10:45:00.000Z",
      "methods": ["initialize", "tools/list", "tools/call"],
      "hasErrors": false
    }
  ]
}
```

### 5. Get Statistics

Get aggregated statistics across logs.

**Endpoint:** `GET /api/stats`

**Query Parameters:** Same filters as `/api/logs` (serverName, sessionId, etc.)

**Response:** `200 OK`

```json
{
  "overview": {
    "totalLogs": 243,
    "totalSessions": 5,
    "totalServers": 3,
    "timeRange": {
      "start": "2025-01-15T08:00:00.000Z",
      "end": "2025-01-15T12:00:00.000Z"
    }
  },
  "byServer": [
    {
      "serverName": "figma-server",
      "count": 150,
      "avgDuration": 329,
      "errorRate": 0.02
    }
  ],
  "byMethod": [
    {
      "method": "tools/call",
      "count": 89,
      "avgDuration": 450,
      "errorRate": 0.01
    }
  ],
  "performance": {
    "avgDuration": 380,
    "p50Duration": 320,
    "p95Duration": 850,
    "p99Duration": 1200
  },
  "tokens": {
    "totalInput": 45000,
    "totalOutput": 12000,
    "total": 57000
  }
}
```

### 6. Export Logs

Export filtered logs in various formats.

**Endpoint:** `GET /api/logs/export`

**Query Parameters:**
- All filter parameters from `/api/logs`
- `format` - Export format: `json` | `jsonl` | `csv`

**Response:** `200 OK`
- Content-Type: `application/json`, `application/x-ndjson`, or `text/csv`
- Content-Disposition: `attachment; filename="mcp-logs-{timestamp}.{ext}"`

**Example:**

```bash
GET /api/logs/export?serverName=figma-server&format=json
```

### 7. Health Check

Simple health check endpoint.

**Endpoint:** `GET /api/health`

**Response:** `200 OK`

```json
{
  "status": "ok",
  "version": "1.0.0",
  "storageDir": "~/.mcp-gateway/capture",
  "availableServers": 3,
  "totalLogs": 243
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* optional additional details */ }
}
```

**Common HTTP Status Codes:**
- `400 Bad Request` - Invalid query parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Storage directory not accessible

## CORS Configuration

**Development:**
- Allow origin: `http://localhost:5173` (Vite dev server)
- Allow credentials: true
- Allow methods: GET, POST, OPTIONS
- Allow headers: Content-Type, Authorization

**Production:**
- No CORS (API and UI served from same origin)

## Rate Limiting

**Development:** No rate limiting

**Future Production:**
- 100 requests per minute per IP
- 1000 requests per hour per IP

## Validation

All query parameters are validated using Zod schemas:

```typescript
// Example: Log query validation
const logQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(50),
  serverName: z.string().optional(),
  sessionId: z.string().optional(),
  method: z.string().optional(),
  search: z.string().optional(),
  hasError: z.coerce.boolean().optional(),
  minDuration: z.coerce.number().nonnegative().optional(),
  maxDuration: z.coerce.number().nonnegative().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  sortBy: z.enum(['timestamp', 'duration', 'method', 'server']).default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
```

Invalid parameters return `400 Bad Request` with validation errors.

## Caching Strategy

**Server-side:**
- No caching (always read from disk for latest data)
- Future: Add in-memory cache with TTL

**Client-side (via TanStack Query):**
- Cache logs for 30 seconds
- Stale-while-revalidate strategy
- Infinite scroll uses cursor-based pagination
- Invalidate cache on filter change

## WebSocket Support (Future)

**Endpoint:** `ws://localhost:3000/api/logs/stream`

**Protocol:**
```json
// Client subscribes to filters
{
  "type": "subscribe",
  "filters": {
    "serverName": "figma-server"
  }
}

// Server sends new logs as they arrive
{
  "type": "log",
  "data": { /* LogEntry */ }
}

// Client unsubscribes
{
  "type": "unsubscribe"
}
```

## Performance Considerations

1. **File Reading:**
   - Read JSONL files line-by-line
   - Parse only required fields initially
   - Full parse on-demand for detail view

2. **Filtering:**
   - Apply filters during file reading (don't load all into memory)
   - Use streaming for large result sets

3. **Pagination:**
   - Implement true pagination (don't load all results)
   - Consider cursor-based pagination for large datasets

4. **Indexing (Future):**
   - Build in-memory index on server start
   - Index by: timestamp, server, session, method
   - Rebuild index when new files detected
