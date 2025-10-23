# Real-Time Updates: Polling vs WebSockets Analysis

## Problem Statement

How should the Web UI receive updates when new MCP logs are captured?

---

## Option 1: Polling (Recommended for MVP)

### How It Works

```typescript
// In Web UI
useQuery({
  queryKey: ['logs', filters],
  queryFn: fetchLogs,
  refetchInterval: 1000, // Poll every 1 second
})
```

### Pros ✅
- **Simple to implement** - TanStack Query has built-in support
- **No connection management** - HTTP is stateless
- **Works with existing REST API** - No new endpoints needed
- **No edge cases** - Every poll gets fresh data
- **Easy debugging** - Just look at network tab
- **Handles reconnection automatically** - No manual retry logic
- **Works through proxies/firewalls** - Plain HTTP

### Cons ❌
- **Slightly higher latency** - Up to 1s delay for new logs
- **More HTTP requests** - 60 requests/minute per user
- **Bandwidth usage** - Sends full response even if unchanged (can optimize with `If-Modified-Since`)
- **Server load** - More requests to handle

### Optimization: Smart Polling

```typescript
// Poll more frequently when active, less when idle
const { data } = useQuery({
  queryKey: ['logs', filters],
  queryFn: fetchLogs,
  refetchInterval: (data) => {
    // If new data in last poll, check more often
    if (data?.hasNewLogs) return 500  // 500ms
    // Otherwise back off
    return 2000  // 2s
  },
  // Stop polling when tab not visible
  refetchIntervalInBackground: false,
})
```

### Optimization: Incremental Updates

```typescript
// API endpoint returns only new logs since last poll
GET /api/logs?after=2025-01-15T12:30:00.000Z

// Response includes marker for next poll
{
  "data": [...new logs...],
  "lastTimestamp": "2025-01-15T12:30:05.123Z",
  "hasMore": true
}
```

---

## Option 2: WebSockets with Thin Events

### How It Works

```typescript
// WebSocket sends notification
ws.send({ type: 'new_log', serverId: 'figma' })

// Client receives event → triggers API fetch
useEffect(() => {
  ws.onmessage = (event) => {
    if (event.data.type === 'new_log') {
      queryClient.invalidateQueries(['logs'])
      // This triggers refetch from /api/logs
    }
  }
}, [])
```

### Pros ✅
- **Lower latency** - Instant notifications
- **Less bandwidth** - Only send notification, not full data
- **Scales better** - One WebSocket vs many polls
- **Server can batch notifications** - Send one event for 10 new logs

### Cons ❌
- **Connection management complexity** - Handle disconnects, reconnects
- **Edge cases:**
  - **Race condition:** Notification arrives before API updated
  - **Lost messages:** WS drops, miss notification
  - **Duplicate fetches:** Multiple notifications → multiple fetches
  - **Filter mismatch:** Notification for log that doesn't match current filters
- **More code to maintain** - WebSocket client + server logic
- **Debugging harder** - Events not visible in network tab
- **Proxy/firewall issues** - Some networks block WebSockets

### Edge Cases Explained

#### Race Condition
```
1. New log written to disk
2. WebSocket: "new_log" sent → Client receives
3. Client: fetch /api/logs
4. API: reads disk (log not fully flushed yet!)
5. Client: doesn't see new log
```

**Solution:** Delay notification by 100ms, or include log ID in event

#### Lost Messages
```
1. Network blip → WebSocket disconnects
2. 3 new logs written
3. WebSocket reconnects
4. Client never knows about those 3 logs
```

**Solution:** On reconnect, fetch all logs since last known timestamp

#### Duplicate Fetches
```
1. 5 logs arrive quickly
2. WebSocket sends 5 "new_log" events
3. Client triggers 5 API fetches
4. Race condition: multiple parallel requests
```

**Solution:** Debounce/batch invalidations:
```typescript
const debouncedInvalidate = debounce(() => {
  queryClient.invalidateQueries(['logs'])
}, 300)

ws.onmessage = () => debouncedInvalidate()
```

---

## Option 3: WebSockets with Full Data

### How It Works

```typescript
// WebSocket sends complete log entry
ws.send({
  type: 'log',
  data: { /* full CaptureRecord */ }
})

// Client adds directly to cache
ws.onmessage = (event) => {
  const log = event.data
  queryClient.setQueryData(['logs'], (old) => ({
    ...old,
    data: [log, ...old.data]
  }))
}
```

### Pros ✅
- **No additional API requests** - Data arrives via WebSocket
- **Zero latency** - Immediate update
- **No race conditions** - Data is self-contained

### Cons ❌
- **Duplicate state** - Need to manage filtering/sorting client-side
- **More complex cache management** - Merging, deduplication, pagination
- **Higher WebSocket bandwidth** - Sending full log objects
- **Filter issues:** Client has filter for "figma-server", but WS sends all logs
- **Pagination breaks:** Infinite scroll gets confused with live updates

---

## Recommendation: Polling for MVP, Smart WebSockets for Later

### Phase 1 (MVP): Simple Polling

```typescript
// Dead simple, works perfectly
useQuery({
  queryKey: ['logs', filters],
  queryFn: () => fetchLogs(filters),
  refetchInterval: 1000,
  refetchIntervalInBackground: false,
})
```

**Why:**
- 1 second latency is totally acceptable for log viewer
- Zero complexity
- No edge cases to handle
- Can ship in 1 day

**Bandwidth calculation:**
- 100 logs × 2KB/log = 200KB per response
- 60 requests/minute = 12MB/minute = **720MB/hour**
- For local development, this is fine

### Phase 2 (Post-MVP): Optimized Polling

Add `If-Modified-Since` / `ETag` support:

```typescript
// API endpoint
app.get('/api/logs', async (c) => {
  const lastModified = getLastLogTimestamp(storageDir)

  if (c.req.header('If-Modified-Since') === lastModified) {
    return c.body(null, 304) // Not Modified
  }

  c.header('Last-Modified', lastModified)
  return c.json(logs)
})
```

**Result:** Most polls return 304 (empty response), bandwidth drops 90%

### Phase 3 (Future): Smart WebSockets

Use **thin events with built-in recovery:**

```typescript
// Server-side
wss.on('connection', (ws, req) => {
  // Send initial sync
  ws.send({
    type: 'sync',
    lastTimestamp: getLastLogTimestamp(),
    count: getTotalLogs()
  })

  // Watch for new logs
  watchLogs((newLog) => {
    ws.send({
      type: 'new_logs',
      count: 1,
      lastTimestamp: newLog.timestamp
    })
  })
})

// Client-side
useWebSocket({
  url: 'ws://localhost:3000/api/logs/stream',
  onMessage: (msg) => {
    if (msg.type === 'new_logs') {
      // Debounced invalidation (handles burst of logs)
      debouncedInvalidate()
    }
  },
  onReconnect: () => {
    // On reconnect, force full refresh
    queryClient.invalidateQueries(['logs'])
  }
})
```

**Advantages of this approach:**
- **Thin events** - Just count + timestamp (< 100 bytes)
- **API still source of truth** - No cache inconsistencies
- **Auto-recovery** - Reconnect → full refresh
- **Debouncing** - Handles bursts gracefully
- **Filters work** - API fetch respects current filters

---

## Polling vs WebSocket Comparison

| Feature | Polling (1s) | WebSocket (Thin) | WebSocket (Full) |
|---------|-------------|------------------|------------------|
| **Latency** | ~500ms avg | ~10ms | ~10ms |
| **Bandwidth** | High (can optimize) | Low | Medium |
| **Complexity** | Very low | Medium | High |
| **Edge cases** | None | Some | Many |
| **Debugging** | Easy | Medium | Hard |
| **Scalability** | Good (local) | Better | Best |
| **Filter support** | Perfect | Perfect | Complex |
| **Implementation time** | 1 hour | 1 day | 2-3 days |

---

## My Recommendation: 3-Stage Approach

### Stage 1: MVP (Week 1)
**Use polling with 1-second interval**
- Simplest possible implementation
- Zero edge cases
- Good enough for local development
- Can iterate on features without worrying about real-time

### Stage 2: Optimize (Week 2-3)
**Add conditional GET (304 responses)**
- Reduces bandwidth by 90%
- No behavior change for user
- Still using polling, just smarter

### Stage 3: Real-time (Month 2+)
**Add WebSocket with thin events + debouncing**
- Lower latency for better UX
- Keep API as source of truth
- Add reconnection logic
- Only when you have time to test edge cases

---

## Code Example: All Three Stages

### Stage 1: Simple Polling
```typescript
// Web UI - works out of the box
const { data } = useQuery({
  queryKey: ['logs', filters],
  queryFn: () => api.getLogs(filters),
  refetchInterval: 1000,
})
```

### Stage 2: Conditional Polling
```typescript
// API
const logsCache = new Map<string, { etag: string, data: any }>()

app.get('/api/logs', async (c) => {
  const cacheKey = JSON.stringify(c.req.query())
  const cached = logsCache.get(cacheKey)

  const currentEtag = await getLogsEtag(storageDir, filters)

  if (c.req.header('If-None-Match') === currentEtag) {
    return c.body(null, 304)
  }

  const data = await queryLogs(storageDir, filters)
  c.header('ETag', currentEtag)
  logsCache.set(cacheKey, { etag: currentEtag, data })
  return c.json(data)
})
```

### Stage 3: WebSocket + Polling Hybrid
```typescript
// Use WebSocket for notifications, polling for data
const ws = useWebSocket('ws://localhost:3000/logs/stream')

useEffect(() => {
  if (ws.lastMessage?.type === 'new_logs') {
    // Debounce: wait for burst of logs to finish
    const timeout = setTimeout(() => {
      queryClient.invalidateQueries(['logs'])
    }, 300)
    return () => clearTimeout(timeout)
  }
}, [ws.lastMessage])

// Polling as fallback (slower interval)
useQuery({
  queryKey: ['logs', filters],
  queryFn: () => api.getLogs(filters),
  refetchInterval: ws.isConnected ? 10_000 : 1_000, // 10s if WS connected, 1s if not
})
```

---

## Final Answer

**For MVP: Use polling every 1 second.**

It's simple, reliable, and perfect for the use case (local development tool). You can always optimize later with conditional GETs or WebSockets, but don't let perfect be the enemy of done.

The 1-second latency is imperceptible for a log viewer, and you avoid ALL the edge cases that come with WebSockets.

**Start simple, optimize when needed.**
