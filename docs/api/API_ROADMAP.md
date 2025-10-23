# API Roadmap - Future Enhancements

This document outlines features and endpoints planned for future versions of the MCP Gateway API. These are NOT currently implemented but represent the vision for expanding API capabilities.

## Planned Endpoints

### 1. Get Single Log Entry

Retrieve detailed information for a specific log entry.

**Endpoint:** `GET /api/logs/:id`

**Path Parameters:**
- `id` - Composite ID: `{sessionId}:{timestamp}:{jsonrpcId}`

**Response:** `200 OK` with full LogEntry details

**Rationale:** Allow drilling into specific interactions without pagination

---

### 2. Aggregated Statistics

Get system-wide statistics and performance metrics.

**Endpoint:** `GET /api/stats`

**Query Parameters:** Same filters as `/api/logs`

**Response:** `200 OK`

```json
{
  "overview": {
    "totalLogs": 243,
    "totalSessions": 5,
    "totalServers": 3,
    "timeRange": { "start": "...", "end": "..." }
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
  }
}
```

**Rationale:** Provide aggregated metrics for dashboards and monitoring

---

### 3. Export Logs

Export filtered logs in multiple formats.

**Endpoint:** `GET /api/logs/export`

**Query Parameters:**
- All filter parameters from `/api/logs`
- `format` - Export format: `json` | `jsonl` | `csv`

**Response:** `200 OK`
- Content-Type: `application/json`, `application/x-ndjson`, or `text/csv`
- Content-Disposition: `attachment; filename="mcp-logs-{timestamp}.{ext}"`

**Rationale:** Enable users to export logs for external analysis or archival

---

### 4. Health Check Endpoint

Simple health check for monitoring.

**Endpoint:** `GET /api/health`

**Response:** `200 OK`

```json
{
  "status": "ok",
  "version": "0.2.0",
  "storageDir": "~/.mcp-gateway",
  "availableServers": 3,
  "totalLogs": 243
}
```

**Rationale:** Support monitoring and load balancer health checks

---

## Enhanced Query Features

### Full-Text Search

Search across request and response payloads.

```bash
GET /api/logs?search=screenshot
```

**Implementation notes:**
- Index JSON payloads for efficient searching
- Search both method names and parameter values
- Support fuzzy matching for user names

---

### Error Filtering

Filter by error presence in responses.

```bash
GET /api/logs?hasError=true
```

**Implementation notes:**
- Detect error responses (response.error field present)
- Track error codes and messages
- Aggregate error statistics

---

### Duration Filtering

Filter by request duration thresholds.

```bash
GET /api/logs?minDuration=1000&maxDuration=5000
```

**Implementation notes:**
- Support finding slow requests
- Support finding unusually fast requests
- Performance optimization: index duration field

---

### Advanced Sorting

Sort by multiple fields.

```bash
GET /api/logs?sortBy=duration&sortOrder=desc
```

**Supported sort fields:**
- `timestamp` (current default)
- `duration`
- `method`
- `server`

---

### Pagination Variants

Support different pagination strategies based on use case.

**Offset-based pagination:**
```bash
GET /api/logs?page=2&pageSize=50
```

**Keyset pagination (efficient for large datasets):**
```bash
GET /api/logs?after=2025-01-15T10:30:00Z&limit=100
```

---

## Token Tracking

Track and analyze token usage across interactions.

**Extended LogEntry with token data:**
```typescript
interface LogEntry {
  // ... existing fields
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
}
```

**Token statistics endpoint:**
```bash
GET /api/stats?metrics=tokens
```

**Response:**
```json
{
  "tokens": {
    "totalInput": 45000,
    "totalOutput": 12000,
    "total": 57000,
    "byServer": [
      {
        "serverName": "figma-server",
        "input": 20000,
        "output": 5000,
        "total": 25000
      }
    ]
  }
}
```

**Rationale:** Support cost analysis and usage tracking

---

## Real-Time Updates

### WebSocket Streaming

Stream new logs as they arrive.

**Endpoint:** `ws://localhost:3333/api/logs/stream`

**Protocol:**

```json
// Client subscribes to filters
{
  "type": "subscribe",
  "filters": {
    "serverName": "figma-server"
  }
}

// Server sends new logs
{
  "type": "log",
  "data": { /* LogEntry */ }
}

// Client unsubscribes
{
  "type": "unsubscribe"
}
```

**Rationale:** Enable real-time dashboards and live monitoring

---

## Performance Optimizations

### Server-Side Caching

Implement caching strategies for frequently accessed data.

**Proposed:**
- Cache server list (TTL: 5 minutes)
- Cache session list (TTL: 1 minute)
- Cache statistics (TTL: 30 seconds)
- Invalidate on new log arrival

---

### Database Indexing

Build indexes for efficient querying.

**Proposed indexes:**
- `serverName` - Fast server filtering
- `sessionId` - Fast session filtering
- `method` - Fast method filtering
- `timestamp` - Fast time-range queries
- `(serverName, sessionId)` - Fast session lookups
- `(timestamp, serverName)` - Fast time-based server queries

---

### Query Result Streaming

Stream large result sets to avoid memory overhead.

**Implementation:**
- Use HTTP chunked transfer encoding
- Stream JSON array elements one at a time
- Support both CSV and JSONL streaming

---

## Rate Limiting

Implement rate limiting for API protection.

**Proposed strategy:**
- 100 requests per minute per IP
- 1000 requests per hour per IP
- Requests exceeding limit return `429 Too Many Requests`
- Include `X-RateLimit-*` headers in responses

---

## Client Library

Create typed client library for common languages.

**Proposed:**
- TypeScript/JavaScript (`@fiberplane/mcp-gateway-client`)
- Python (`mcp-gateway-client`)
- Go (`github.com/fiberplane/mcp-gateway-client-go`)

---

## Security Enhancements

### Authentication

Add API key or token-based authentication.

**Proposed:**
- Support API keys for remote deployments
- Optional authentication (disabled for local development)
- Token validation middleware

---

### CORS Configuration

Support more flexible CORS policies.

**Proposed:**
- Allow configuration of allowed origins
- Support credentials in cross-origin requests
- Configurable allowed methods and headers

---

## Implementation Priority

1. **Phase 1 (High Priority):**
   - Database indexing for performance
   - Export functionality (JSON/JSONL)
   - Error filtering and statistics

2. **Phase 2 (Medium Priority):**
   - Full-text search
   - Token tracking
   - Advanced sorting options
   - Health check endpoint

3. **Phase 3 (Lower Priority):**
   - WebSocket streaming
   - Real-time updates
   - Advanced caching
   - Client libraries
   - Authentication

---

## Notes

- These features are planned based on current MVP needs and future vision
- Priority may change based on user feedback
- Implementation may reveal simpler or more complex approaches
- All features must maintain backward compatibility with current API
