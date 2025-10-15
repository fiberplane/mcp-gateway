# MCP Gateway Web UI - MVP Plan

## Goal

View and export captured MCP logs in a web browser with basic filtering.

**Timeline: 4-5 days**

---

## MVP Features

### ✅ Core Features

1. **View logs in table**
   - Columns: Timestamp, Server, Session, Method, Duration
   - Default sort: newest first
   - Limit: 100 logs per page

2. **Basic filtering**
   - Filter by server (dropdown)
   - Filter by session (dropdown)
   - Filters update URL params

3. **Pagination**
   - Previous/Next buttons
   - Page number display
   - "Go to page" input

4. **Inline log details**
   - Click row to expand
   - Show request JSON
   - Show response JSON
   - Copy button for JSON

5. **Export logs**
   - Export current filtered view
   - JSONL format only
   - Download as file
   - Filename: `mcp-logs-{timestamp}.jsonl`

### ❌ Not in MVP (Future)

- ❌ Import logs (v1.1)
- ❌ Search/full-text search
- ❌ Advanced filters (duration, time range, method)
- ❌ Sorting (other than default)
- ❌ Stats dashboard
- ❌ Multiple export formats (JSON, CSV)
- ❌ Virtual scrolling
- ❌ Real-time updates (using 1s polling)
- ❌ Separate detail page/modal
- ❌ Dark mode
- ❌ Mobile responsive
- ❌ WebSocket support

---

## Tech Stack (Simplified)

### API Package
- **Hono** - HTTP server
- **Zod** - Request validation
- **Bun** - Runtime

### Web UI Package
- **React 18** + **TypeScript**
- **Vite** - Build tool
- **TanStack Query** - Data fetching (with 1s polling)
- **React useState** - Filter state (no Zustand)
- **Basic CSS** - Styling (no Tailwind/component library)
- **date-fns** - Date formatting

---

## Implementation Plan

### Phase 1: Core Package (1 day)

#### Step 1.1: Create Log Reader

**File:** `packages/core/src/logs/reader.ts`

```typescript
export async function readCaptureFile(
  filePath: string
): Promise<CaptureRecord[]>

export async function listCaptureFiles(
  storageDir: string,
  serverName?: string
): Promise<string[]>
```

**Validation:**
```bash
bun test packages/core/src/logs/reader.test.ts
```

---

#### Step 1.2: Create Log Query

**File:** `packages/core/src/logs/query.ts`

```typescript
export interface LogQueryOptions {
  serverName?: string
  sessionId?: string
  page?: number
  limit?: number
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export async function queryLogs(
  storageDir: string,
  options: LogQueryOptions
): Promise<PaginatedResult<CaptureRecord>>
```

**Validation:**
```bash
bun test packages/core/src/logs/query.test.ts

# Test cases:
# ✓ Filter by server
# ✓ Filter by session
# ✓ Pagination works
# ✓ Calculate hasNext/hasPrev correctly
```

---

#### Step 1.3: Create Log Aggregator (for dropdowns)

**File:** `packages/core/src/logs/aggregator.ts`

```typescript
export interface ServerInfo {
  name: string
  logCount: number
  sessionCount: number
}

export interface SessionInfo {
  sessionId: string
  serverName: string
  logCount: number
  startTime: string
  endTime: string
}

export async function getServers(
  storageDir: string
): Promise<ServerInfo[]>

export async function getSessions(
  storageDir: string,
  serverName?: string
): Promise<SessionInfo[]>
```

**Validation:**
```bash
bun test packages/core/src/logs/aggregator.test.ts
```

---

#### Step 1.4: Export Core Functions

**File:** `packages/core/src/index.ts`

```typescript
export * from './logs/reader'
export * from './logs/query'
export * from './logs/aggregator'
```

**Validation:**
```bash
bun run --filter @fiberplane/mcp-gateway-core build
bun run check-circular
```

---

### Phase 2: API Package (1 day)

#### Step 2.1: Create Package Structure

**Commands:**
```bash
mkdir -p packages/api/src/{routes,lib}
```

**Files:**
- `packages/api/package.json`
- `packages/api/tsconfig.json`
- `packages/api/src/index.ts`

**package.json:**
```json
{
  "name": "@fiberplane/mcp-gateway-api",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "dependencies": {
    "@fiberplane/mcp-gateway-core": "workspace:*",
    "@fiberplane/mcp-gateway-types": "workspace:*",
    "hono": "^4.6.0",
    "zod": "^3.22.0"
  },
  "scripts": {
    "build": "bun run ../../scripts/build.ts",
    "dev": "bun run src/dev.ts"
  }
}
```

---

#### Step 2.2: Create Hono App

**File:** `packages/api/src/app.ts`

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

export function createApp(storageDir: string) {
  const app = new Hono()

  // Middleware
  app.use('*', logger())
  app.use('*', cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }))

  // Error handler
  app.onError((err, c) => {
    console.error('API Error:', err)
    return c.json({
      error: err.message || 'Internal server error',
    }, 500)
  })

  // Health check
  app.get('/api/health', (c) => {
    return c.json({ status: 'ok' })
  })

  // Routes
  app.route('/api/logs', createLogsRoutes(storageDir))
  app.route('/api/servers', createServersRoutes(storageDir))
  app.route('/api/sessions', createSessionsRoutes(storageDir))

  return app
}

export { createApp }
```

---

#### Step 2.3: Create Logs Routes

**File:** `packages/api/src/routes/logs.ts`

```typescript
import { Hono } from 'hono'
import { z } from 'zod'
import { queryLogs } from '@fiberplane/mcp-gateway-core'

const logQuerySchema = z.object({
  serverName: z.string().optional(),
  sessionId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(100),
})

export function createLogsRoutes(storageDir: string) {
  const app = new Hono()

  // GET /api/logs
  app.get('/', async (c) => {
    try {
      const params = logQuerySchema.parse(c.req.query())
      const result = await queryLogs(storageDir, params)
      return c.json(result)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: 'Invalid query parameters', details: error.errors }, 400)
      }
      throw error
    }
  })

  // GET /api/logs/export
  app.get('/export', async (c) => {
    try {
      const params = logQuerySchema.parse(c.req.query())

      // Get all logs (no pagination for export)
      const result = await queryLogs(storageDir, {
        ...params,
        page: 1,
        limit: 10000, // Max export size
      })

      // Convert to JSONL
      const jsonl = result.data
        .map(log => JSON.stringify(log))
        .join('\n')

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `mcp-logs-${timestamp}.jsonl`

      c.header('Content-Type', 'application/x-ndjson')
      c.header('Content-Disposition', `attachment; filename="${filename}"`)

      return c.body(jsonl)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: 'Invalid query parameters', details: error.errors }, 400)
      }
      throw error
    }
  })

  return app
}
```

---

#### Step 2.4: Create Servers Routes

**File:** `packages/api/src/routes/servers.ts`

```typescript
import { Hono } from 'hono'
import { getServers } from '@fiberplane/mcp-gateway-core'

export function createServersRoutes(storageDir: string) {
  const app = new Hono()

  app.get('/', async (c) => {
    const servers = await getServers(storageDir)
    return c.json({ servers })
  })

  return app
}
```

---

#### Step 2.5: Create Sessions Routes

**File:** `packages/api/src/routes/sessions.ts`

```typescript
import { Hono } from 'hono'
import { z } from 'zod'
import { getSessions } from '@fiberplane/mcp-gateway-core'

const sessionQuerySchema = z.object({
  serverName: z.string().optional(),
})

export function createSessionsRoutes(storageDir: string) {
  const app = new Hono()

  app.get('/', async (c) => {
    const params = sessionQuerySchema.parse(c.req.query())
    const sessions = await getSessions(storageDir, params.serverName)
    return c.json({ sessions })
  })

  return app
}
```

---

#### Step 2.6: Create Dev Server

**File:** `packages/api/src/dev.ts`

```typescript
import { createApp } from './app'

const storageDir = process.env.STORAGE_DIR || '~/.mcp-gateway/capture'
const port = Number(process.env.PORT) || 3000

const app = createApp(storageDir)

const server = Bun.serve({
  port,
  fetch: app.fetch,
})

console.log(`🚀 API server running at http://localhost:${server.port}`)
console.log(`📁 Storage directory: ${storageDir}`)
```

**Validation:**
```bash
bun run --filter @fiberplane/mcp-gateway-api dev

# Test endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/logs
curl http://localhost:3000/api/servers
curl http://localhost:3000/api/sessions
curl http://localhost:3000/api/logs/export
```

---

### Phase 3: Web UI Package (2 days)

#### Step 3.1: Create Vite Project

**Commands:**
```bash
cd packages
npm create vite@latest web -- --template react-ts
cd web
bun install
```

---

#### Step 3.2: Configure Package

**File:** `packages/web/package.json`

```json
{
  "name": "@fiberplane/mcp-gateway-web",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@tanstack/react-query": "^5.59.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
```

**File:** `packages/web/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

---

#### Step 3.3: Create API Client

**File:** `packages/web/src/lib/api.ts`

```typescript
export interface LogEntry {
  timestamp: string
  method: string
  id: string | number | null
  metadata: {
    serverName: string
    sessionId: string
    durationMs: number
    httpStatus: number
  }
  request?: any
  response?: any
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface ServerInfo {
  name: string
  logCount: number
  sessionCount: number
}

export interface SessionInfo {
  sessionId: string
  serverName: string
  logCount: number
  startTime: string
  endTime: string
}

class APIClient {
  private baseURL = '/api'

  async getLogs(params: {
    serverName?: string
    sessionId?: string
    page?: number
    limit?: number
  }): Promise<PaginatedResponse<LogEntry>> {
    const url = new URL(`${this.baseURL}/logs`, window.location.origin)

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value))
      }
    })

    const response = await fetch(url.toString())
    if (!response.ok) throw new Error('Failed to fetch logs')
    return response.json()
  }

  async getServers(): Promise<{ servers: ServerInfo[] }> {
    const response = await fetch(`${this.baseURL}/servers`)
    if (!response.ok) throw new Error('Failed to fetch servers')
    return response.json()
  }

  async getSessions(serverName?: string): Promise<{ sessions: SessionInfo[] }> {
    const url = new URL(`${this.baseURL}/sessions`, window.location.origin)
    if (serverName) url.searchParams.append('serverName', serverName)

    const response = await fetch(url.toString())
    if (!response.ok) throw new Error('Failed to fetch sessions')
    return response.json()
  }

  exportLogs(params: {
    serverName?: string
    sessionId?: string
  }): string {
    const url = new URL(`${this.baseURL}/logs/export`, window.location.origin)

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value))
      }
    })

    return url.toString()
  }
}

export const api = new APIClient()
```

---

#### Step 3.4: Setup TanStack Query

**File:** `packages/web/src/lib/queryClient.ts`

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 1000, // Poll every 1 second
      refetchIntervalInBackground: false,
      staleTime: 0,
      retry: 2,
    },
  },
})
```

**File:** `packages/web/src/main.tsx`

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
```

---

#### Step 3.5: Create App Component

**File:** `packages/web/src/App.tsx`

```typescript
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from './lib/api'
import { ServerFilter } from './components/ServerFilter'
import { SessionFilter } from './components/SessionFilter'
import { LogTable } from './components/LogTable'
import { Pagination } from './components/Pagination'
import { ExportButton } from './components/ExportButton'

function App() {
  const [serverName, setServerName] = useState<string | undefined>()
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['logs', serverName, sessionId, page],
    queryFn: () => api.getLogs({ serverName, sessionId, page, limit: 100 }),
  })

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '20px' }}>
        <h1>MCP Gateway Logs</h1>
      </header>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <ServerFilter value={serverName} onChange={setServerName} />
        <SessionFilter serverName={serverName} value={sessionId} onChange={setSessionId} />
        <ExportButton serverName={serverName} sessionId={sessionId} />
      </div>

      {error && <div style={{ color: 'red' }}>Error: {String(error)}</div>}

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <>
          <LogTable logs={data?.data || []} />
          {data && <Pagination {...data.pagination} onPageChange={setPage} />}
        </>
      )}
    </div>
  )
}

export default App
```

---

#### Step 3.6: Create Filter Components

**File:** `packages/web/src/components/ServerFilter.tsx`

```typescript
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

interface Props {
  value?: string
  onChange: (value: string | undefined) => void
}

export function ServerFilter({ value, onChange }: Props) {
  const { data } = useQuery({
    queryKey: ['servers'],
    queryFn: () => api.getServers(),
    refetchInterval: 5000, // Refresh less often
  })

  return (
    <div>
      <label>
        Server:{' '}
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">All servers</option>
          {data?.servers.map((server) => (
            <option key={server.name} value={server.name}>
              {server.name} ({server.logCount} logs)
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
```

**File:** `packages/web/src/components/SessionFilter.tsx`

```typescript
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

interface Props {
  serverName?: string
  value?: string
  onChange: (value: string | undefined) => void
}

export function SessionFilter({ serverName, value, onChange }: Props) {
  const { data } = useQuery({
    queryKey: ['sessions', serverName],
    queryFn: () => api.getSessions(serverName),
    refetchInterval: 5000,
  })

  return (
    <div>
      <label>
        Session:{' '}
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">All sessions</option>
          {data?.sessions.map((session) => (
            <option key={session.sessionId} value={session.sessionId}>
              {session.sessionId} ({session.logCount} logs)
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
```

---

#### Step 3.7: Create Log Table Component

**File:** `packages/web/src/components/LogTable.tsx`

```typescript
import { useState } from 'react'
import type { LogEntry } from '../lib/api'
import { format } from 'date-fns'

interface Props {
  logs: LogEntry[]
}

export function LogTable({ logs }: Props) {
  const [expandedId, setExpandedId] = useState<string | number | null>(null)

  const handleRowClick = (log: LogEntry) => {
    setExpandedId(expandedId === log.id ? null : log.id)
  }

  if (logs.length === 0) {
    return <div>No logs found</div>
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
          <th style={{ padding: '10px' }}>Timestamp</th>
          <th style={{ padding: '10px' }}>Server</th>
          <th style={{ padding: '10px' }}>Session</th>
          <th style={{ padding: '10px' }}>Method</th>
          <th style={{ padding: '10px' }}>Duration</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <>
            <tr
              key={String(log.id)}
              onClick={() => handleRowClick(log)}
              style={{
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                backgroundColor: expandedId === log.id ? '#f5f5f5' : 'white',
              }}
            >
              <td style={{ padding: '10px' }}>
                {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
              </td>
              <td style={{ padding: '10px' }}>{log.metadata.serverName}</td>
              <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
                {log.metadata.sessionId}
              </td>
              <td style={{ padding: '10px' }}>
                <code style={{
                  backgroundColor: '#f0f0f0',
                  padding: '2px 6px',
                  borderRadius: '3px'
                }}>
                  {log.method}
                </code>
              </td>
              <td style={{ padding: '10px' }}>{log.metadata.durationMs}ms</td>
            </tr>
            {expandedId === log.id && (
              <tr>
                <td colSpan={5} style={{ padding: '20px', backgroundColor: '#fafafa' }}>
                  <LogDetails log={log} />
                </td>
              </tr>
            )}
          </>
        ))}
      </tbody>
    </table>
  )
}

function LogDetails({ log }: { log: LogEntry }) {
  const [copied, setCopied] = useState<'request' | 'response' | null>(null)

  const copyToClipboard = (data: any, type: 'request' | 'response') => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      {log.request && (
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h4>Request</h4>
            <button onClick={() => copyToClipboard(log.request, 'request')}>
              {copied === 'request' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre style={{
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '400px',
            fontSize: '12px',
          }}>
            {JSON.stringify(log.request, null, 2)}
          </pre>
        </div>
      )}
      {log.response && (
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h4>Response</h4>
            <button onClick={() => copyToClipboard(log.response, 'response')}>
              {copied === 'response' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre style={{
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '400px',
            fontSize: '12px',
          }}>
            {JSON.stringify(log.response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
```

---

#### Step 3.8: Create Pagination Component

**File:** `packages/web/src/components/Pagination.tsx`

```typescript
interface Props {
  page: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, hasNext, hasPrev, onPageChange }: Props) {
  return (
    <div style={{
      marginTop: '20px',
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrev}
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext}
      >
        Next
      </button>
    </div>
  )
}
```

---

#### Step 3.9: Create Export Button

**File:** `packages/web/src/components/ExportButton.tsx`

```typescript
import { api } from '../lib/api'

interface Props {
  serverName?: string
  sessionId?: string
}

export function ExportButton({ serverName, sessionId }: Props) {
  const handleExport = () => {
    const url = api.exportLogs({ serverName, sessionId })

    // Trigger download
    const a = document.createElement('a')
    a.href = url
    a.download = '' // Filename comes from Content-Disposition header
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <button
      onClick={handleExport}
      style={{
        backgroundColor: '#0066cc',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      Export Logs
    </button>
  )
}
```

---

#### Step 3.10: Add Basic Styles

**File:** `packages/web/src/index.css`

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.5;
  color: #333;
}

button {
  font-family: inherit;
  font-size: 14px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: #f5f5f5;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

select {
  font-family: inherit;
  font-size: 14px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}

code {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}
```

---

**Validation:**
```bash
# Start API
bun run --filter @fiberplane/mcp-gateway-api dev

# Start Web UI
bun run --filter @fiberplane/mcp-gateway-web dev

# Open http://localhost:5173
# Test:
# ✓ Logs appear in table
# ✓ Server filter works
# ✓ Session filter works
# ✓ Click row to expand
# ✓ Copy buttons work
# ✓ Pagination works
# ✓ Export button downloads file
# ✓ Polling updates every 1s
```

---

### Phase 4: CLI Integration (0.5 days)

#### Step 4.1: Add API Dependency

**File:** `packages/mcp-gateway/package.json`

Add dependency:
```json
{
  "dependencies": {
    "@fiberplane/mcp-gateway-api": "workspace:*"
  }
}
```

**Validation:**
```bash
cd packages/mcp-gateway
bun install
```

---

#### Step 4.2: Add CLI Flag

**File:** `packages/mcp-gateway/src/cli.ts`

Add to args definition:
```typescript
const args = {
  // ... existing flags
  ui: {
    type: 'boolean',
    default: false,
    description: 'Start web UI server on http://localhost:3000',
  },
}
```

Add UI server startup:
```typescript
// After setting up TUI
if (parsedArgs.ui) {
  const { createApp } = await import('@fiberplane/mcp-gateway-api')
  const app = createApp(storageDir)

  const server = Bun.serve({
    port: 3000,
    fetch: app.fetch,
  })

  logger.info(`🌐 Web UI available at http://localhost:${server.port}`)
}
```

**Validation:**
```bash
bun run --filter @fiberplane/mcp-gateway-cli dev -- --ui

# Should see:
# ✓ TUI starts
# ✓ Log: "🌐 Web UI available at http://localhost:3000"
# ✓ Open browser → UI loads
# ✓ Generate logs → appear in UI
```

---

### Phase 5: Testing & Documentation (0.5 days)

#### Step 5.1: Manual Testing

**Test Checklist:**
```
☐ Start CLI with --ui flag
☐ Web UI loads at localhost:3000
☐ No logs initially (empty state)
☐ Run test MCP server
☐ Logs appear in table
☐ Polling updates every 1s
☐ Server filter dropdown populates
☐ Selecting server filters logs
☐ Session filter dropdown populates
☐ Selecting session filters logs
☐ Click row → expands inline
☐ Request JSON visible
☐ Response JSON visible
☐ Copy buttons work
☐ Pagination appears when >100 logs
☐ Next/Previous buttons work
☐ Export button downloads JSONL file
☐ Exported file contains filtered logs
☐ Can import exported file into jq/text editor
```

---

#### Step 5.2: Update Documentation

**File:** Update root `README.md`

Add section:
```markdown
## Web UI

View captured logs in your browser:

\`\`\`bash
mcp-gateway --ui
\`\`\`

Then open http://localhost:3000

Features:
- View all captured MCP traffic
- Filter by server and session
- Inspect request/response details
- Export logs to JSONL format
- Auto-refreshes every second
```

**File:** Create `packages/web/README.md`

**File:** Create `packages/api/README.md`

---

## Timeline Summary

| Phase | Duration | Tasks |
|-------|----------|-------|
| Phase 1: Core Package | 1 day | Reader, query, aggregator |
| Phase 2: API Package | 1 day | Hono app, routes, endpoints |
| Phase 3: Web UI | 2 days | React app, components, styling |
| Phase 4: CLI Integration | 0.5 day | Add --ui flag, start API |
| Phase 5: Testing & Docs | 0.5 day | Manual testing, documentation |
| **Total** | **5 days** | |

---

## Success Criteria

### Functional ✅
- ✓ View logs in web browser
- ✓ Filter by server
- ✓ Filter by session
- ✓ Expand log details inline
- ✓ Export logs to JSONL
- ✓ Auto-refresh every 1 second

### Technical ✅
- ✓ No circular dependencies
- ✓ All packages build successfully
- ✓ Types are correct
- ✓ API validates inputs

### User Experience ✅
- ✓ UI loads within 1 second
- ✓ Filters respond immediately
- ✓ Table scrolls smoothly
- ✓ Export downloads file

---

## What's NOT in MVP

Defer to future versions:
- Import logs (v1.1)
- Search functionality
- Advanced filters (time range, duration, method)
- Stats/dashboard
- Multiple export formats (CSV, JSON)
- Sort by different columns
- Virtual scrolling
- Separate detail modal
- Dark mode
- Mobile responsive design
- WebSocket support
- Custom port for API

---

## Ready to Build?

This MVP gives you the core value (view and export logs) with minimal complexity. You can ship in 5 days and iterate based on real usage.

Next steps:
1. Start with Phase 1: Core Package
2. Build incrementally
3. Test each phase before moving forward
4. Ship MVP and gather feedback
