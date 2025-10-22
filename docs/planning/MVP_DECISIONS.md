# MCP Gateway Web UI - MVP Decisions

## Summary

This document captures all key decisions made for the MVP implementation.

---

## Core Decisions

### 1. Time-Based Queries ✅

**Decision:** Use time-based cursors instead of page-based pagination.

**API Design:**
```
GET /api/logs?after=<timestamp>&before=<timestamp>&limit=100&order=desc
```

**Rationale:**
- No race conditions with polling
- Stable cursors (timestamps don't change)
- Perfect for real-time updates
- Natural for log data

**Rejected Alternative:** Page-based pagination (`?page=2`) causes issues with polling when new logs arrive.

---

### 2. Polling (Not WebSockets) ✅

**Decision:** Use 1-second HTTP polling for real-time updates.

**Implementation:**
```typescript
useQuery({
  queryKey: ['logs', filters],
  queryFn: fetchLogs,
  refetchInterval: 1000, // Poll every second
  refetchIntervalInBackground: false,
})
```

**Rationale:**
- Simple implementation
- No edge cases (race conditions, lost messages, reconnection)
- 1s latency acceptable for log viewer
- Zero complexity

**Future Enhancement:** Add ETag-based caching to reduce bandwidth (304 responses).

**Rejected Alternative:** WebSockets with thin events - too complex for MVP, has edge cases.

---

### 3. Single Query with Manual Merging ✅

**Decision:** Use one TanStack Query that holds all logs, manually merge new/old data.

**Implementation:**
```typescript
// Main query holds all logs
const { data } = useQuery(['logs', filters], fetchInitialLogs)

// Poll for new logs, prepend to cache
useQuery(['logs-poll', newestTimestamp], fetchNewLogs, {
  onSuccess: (newLogs) => {
    queryClient.setQueryData(['logs', filters], (old) => ({
      data: [...newLogs.data, ...old.data], // Prepend
    }))
  }
})

// Load more button, append to cache
const loadMore = () => {
  fetchOlderLogs(oldestTimestamp).then((olderLogs) => {
    queryClient.setQueryData(['logs', filters], (old) => ({
      data: [...old.data, ...olderLogs.data], // Append
    }))
  })
}
```

**Rationale:**
- Simple mental model
- Single source of truth
- Easy to debug
- Good for <1000 logs

**Future Enhancement:** Upgrade to TanStack Query's `useInfiniteQuery` if users regularly view >1000 logs.

**Rejected Alternatives:**
- TanStack Infinite Query - more complex, overkill for MVP
- Separate queries for each page - cache fragmentation

---

### 4. Export Included in MVP ✅

**Decision:** Include export functionality (JSONL format only).

**Implementation:**
```typescript
// API endpoint
GET /api/logs/export?serverName=x&sessionId=y

// Response
Content-Type: application/x-ndjson
Content-Disposition: attachment; filename="mcp-logs-2025-01-15T12-30-00.jsonl"

// Body: one JSON object per line
{"timestamp":"...","method":"..."}
{"timestamp":"...","method":"..."}
```

**Rationale:**
- High value for sharing/archiving logs
- Low implementation effort (~4 hours)
- Respects current filters (export what you see)
- JSONL is standard, can be processed with `jq`, `grep`, etc.

**Deferred to v1.1:**
- Import functionality
- Multiple export formats (CSV, JSON array)

---

### 5. Manual Refresh for Cleared Logs ✅

**Decision:** Add manual refresh button, don't auto-detect file deletions.

**Implementation:**
```typescript
function RefreshButton() {
  const queryClient = useQueryClient()

  return (
    <button onClick={() => queryClient.resetQueries()}>
      ↻ Refresh All
    </button>
  )
}
```

**Rationale:**
- Simple to implement
- User knows when they clear logs
- Good enough for local dev tool
- No complexity

**Future Enhancement:** Add ETag-based detection, return 410 Gone when logs cleared.

**Rejected Alternatives:**
- File system watchers - too complex
- Continuous ETag checking - overhead

---

### 6. No UI Framework/Tailwind in MVP ✅

**Decision:** Use vanilla React with basic CSS.

**Rationale:**
- Faster to implement
- Fewer dependencies
- Can add Tailwind/Shadcn later
- Focus on functionality, not polish

**Post-MVP:** Add Tailwind CSS and Shadcn/ui components.

---

### 7. No Separate Detail Page ✅

**Decision:** Expand log details inline (accordion-style).

**Implementation:**
```typescript
<tr onClick={() => setExpanded(log.id)}>
  <td>Log row...</td>
</tr>
{expanded === log.id && (
  <tr>
    <td colspan="5">
      <pre>{JSON.stringify(log.request)}</pre>
      <pre>{JSON.stringify(log.response)}</pre>
    </td>
  </tr>
)}
```

**Rationale:**
- Simpler than modal/separate page
- Faster to implement
- Less navigation complexity

**Post-MVP:** Consider dedicated detail modal with tabs.

---

### 8. Desktop-Only (No Mobile) ✅

**Decision:** No responsive design for MVP.

**Rationale:**
- Log viewers are desktop tools
- Saves implementation time
- Can add responsive later

**Post-MVP:** Add mobile-responsive layout.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│  Browser (http://localhost:5173)                    │
│  ┌───────────────────────────────────────────────┐  │
│  │  React App                                    │  │
│  │  - TanStack Query (polling every 1s)          │  │
│  │  - React.useState (filter state)              │  │
│  │  - Basic CSS                                  │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP REST
                       ▼
┌─────────────────────────────────────────────────────┐
│  API Server (http://localhost:3000)                 │
│  ┌───────────────────────────────────────────────┐  │
│  │  Hono App                                     │  │
│  │  - GET /api/logs (time-based queries)        │  │
│  │  - GET /api/servers                          │  │
│  │  - GET /api/sessions                         │  │
│  │  - GET /api/logs/export                      │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Core Package                                        │
│  - Read JSONL files from disk                       │
│  - Filter by server/session/time                    │
│  - Return results with timestamps                   │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  File System                                         │
│  ~/.mcp-gateway/capture/                            │
│    └── server-name/                                 │
│        └── session-id.jsonl                         │
└─────────────────────────────────────────────────────┘
```

---

## API Endpoints (Final)

### GET /api/logs

**Query Parameters:**
- `after` (optional) - ISO timestamp, logs after this time
- `before` (optional) - ISO timestamp, logs before this time
- `limit` (optional) - Max logs to return (default: 100, max: 1000)
- `order` (optional) - Sort order: `asc` | `desc` (default: `desc`)
- `serverName` (optional) - Filter by server
- `sessionId` (optional) - Filter by session

**Response:**
```json
{
  "data": [
    {
      "timestamp": "2025-01-15T12:30:05.123Z",
      "method": "tools/call",
      "id": "req-123",
      "metadata": {
        "serverName": "figma-server",
        "sessionId": "abc123",
        "durationMs": 329,
        "httpStatus": 200
      },
      "request": { ... },
      "response": { ... }
    }
  ],
  "pagination": {
    "count": 45,
    "limit": 100,
    "hasMore": true,
    "oldestTimestamp": "2025-01-15T12:00:00.000Z",
    "newestTimestamp": "2025-01-15T12:30:05.123Z"
  }
}
```

### GET /api/servers

**Response:**
```json
{
  "servers": [
    {
      "name": "figma-server",
      "logCount": 150,
      "sessionCount": 3
    }
  ]
}
```

### GET /api/sessions

**Query Parameters:**
- `serverName` (optional) - Filter sessions by server

**Response:**
```json
{
  "sessions": [
    {
      "sessionId": "abc123",
      "serverName": "figma-server",
      "logCount": 45,
      "startTime": "2025-01-15T10:00:00.000Z",
      "endTime": "2025-01-15T10:45:00.000Z"
    }
  ]
}
```

### GET /api/logs/export

**Query Parameters:** Same as `/api/logs`

**Response:**
```
Content-Type: application/x-ndjson
Content-Disposition: attachment; filename="mcp-logs-2025-01-15T12-30-00.jsonl"

{"timestamp":"...","method":"..."}
{"timestamp":"...","method":"..."}
```

### GET /api/health

**Response:**
```json
{
  "status": "ok"
}
```

---

## MVP Feature List

### ✅ Included in MVP

1. **View logs in table**
   - Columns: Timestamp, Server, Session, Method, Duration
   - Newest first (default)
   - 100 logs per page

2. **Basic filtering**
   - Filter by server (dropdown)
   - Filter by session (dropdown)

3. **Inline log details**
   - Click row to expand
   - Show request/response JSON
   - Copy button for JSON

4. **Load more logs**
   - "Load More" button
   - Fetches 100 older logs at a time

5. **Export logs**
   - Export current filtered view
   - JSONL format
   - Download as file

6. **Auto-refresh**
   - Poll every 1 second for new logs
   - Automatically prepend to table
   - Only when tab visible

7. **Manual refresh**
   - Button to clear cache and reload

### ❌ Deferred to Post-MVP

- Import logs (v1.1)
- Search/full-text search
- Advanced filters (duration, time range, method)
- Sorting (other than timestamp desc)
- Stats dashboard
- Multiple export formats (CSV, JSON)
- Virtual scrolling
- Separate detail page/modal
- Dark mode
- Mobile responsive design
- WebSocket support
- Auto-detect file deletions
- Tailwind CSS / component library
- Session status indicators

---

## Tech Stack (Final)

### Core Package
- TypeScript
- Node.js fs/promises for file I/O
- Zod for validation

### API Package
- Hono (HTTP framework)
- Bun runtime
- Zod for request validation

### Web UI Package
- React 18
- TypeScript
- Vite (build tool)
- TanStack Query (data fetching + polling)
- React.useState (filter state)
- date-fns (date formatting)
- Basic CSS (no framework)

### CLI Integration
- Add `--ui` flag
- Start API server when flag provided
- Log URL to console

---

## Timeline (Final)

| Phase | Duration | Key Tasks |
|-------|----------|-----------|
| **Phase 1: Core Package** | 1 day | Log reader, time-based query, aggregators |
| **Phase 2: API Package** | 1 day | Hono app, 4 endpoints, dev server |
| **Phase 3: Web UI** | 2 days | React app, filters, table, export, polling |
| **Phase 4: CLI Integration** | 0.5 day | Add --ui flag, start API |
| **Phase 5: Testing & Docs** | 0.5 day | Manual testing, documentation |
| **Total** | **5 days** | |

---

## Success Criteria

### Must Have ✅
- ✓ View logs in web browser
- ✓ Filter by server and session
- ✓ See request/response details
- ✓ Export logs to JSONL
- ✓ Auto-updates every 1 second
- ✓ Works with CLI `--ui` flag

### Performance ✅
- ✓ Initial load < 2 seconds
- ✓ Filters respond instantly
- ✓ Table renders smoothly with 100+ rows
- ✓ Export works with 1000+ logs

### Developer Experience ✅
- ✓ Hot reload works
- ✓ Type safety across packages
- ✓ No circular dependencies
- ✓ Easy to add features later

---

## Open Questions (Resolved)

1. **WebSockets vs Polling?** → Polling (simpler, good enough)
2. **Page-based vs Time-based?** → Time-based (better for real-time)
3. **Single query vs Multiple queries?** → Single query (simpler)
4. **Include Export?** → Yes (high value, low effort)
5. **Include Import?** → No (defer to v1.1)
6. **Detect cleared logs?** → Manual refresh button
7. **UI framework?** → None for MVP (vanilla CSS)
8. **Mobile support?** → Not in MVP

---

## Next Steps

1. Create MVP_PLAN.md with detailed implementation steps
2. Start Phase 1: Core Package implementation
3. Build incrementally, test each phase
4. Ship MVP in 5 days
5. Gather user feedback
6. Plan v1.1 features

---

## Notes

- This is a **local development tool**, not a production service
- Priority is **shipping quickly** over perfection
- Focus on **core value** (view and export logs)
- **Iterate** based on real usage
- Keep it **simple** - complexity can be added later
