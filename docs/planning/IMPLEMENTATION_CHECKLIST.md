# MCP Gateway Web UI - Implementation Checklist

## Overview

This checklist provides step-by-step implementation tasks for the Web UI MVP with dual storage (SQLite + JSONL).

**Timeline:** 5 days
**Storage:** SQLite (queries) + JSONL (backup)
**Key Features:** View logs, filter by server/session/method, export, auto-refresh
**ORM:** Drizzle ORM with automatic migrations during API startup

---

## Architecture Decisions

### Why Drizzle ORM?

We're using **Drizzle ORM** for SQLite storage because:

1. **Migrations on Startup** - Drizzle allows running migrations automatically when the API starts, ensuring the database schema is always up-to-date without manual intervention
2. **Type Safety** - Full TypeScript type inference from schema to queries
3. **Performance** - Minimal overhead (~1-2ms per query vs raw SQL)
4. **Developer Experience** - Clean query builder API, better than string concatenation

### Migration Flow

```typescript
// API startup (packages/api/src/app.ts)
export function createApp(storageDir: string) {
  const db = getDb(storageDir)
  runMigrations(db)  // ← Runs migrations automatically

  // Rest of app setup
}
```

Migrations run:
- **When the API server starts** (`--ui` flag)
- **Before any queries are executed**
- **Idempotently** - safe to run multiple times

### Dual Storage Architecture

```
MCP Traffic Capture
        ↓
┌───────────────────┐
│ appendCapture()   │
└───────┬───────────┘
        ├─────────────────────────┐
        ↓                         ↓
┌──────────────┐          ┌─────────────┐
│ JSONL Files  │          │  SQLite DB  │
│ (backup)     │          │  (queries)  │
└──────────────┘          └─────────────┘
```

- **JSONL**: Human-readable, debugging, recovery
- **SQLite**: Fast indexed queries, aggregations, filtering

---

## Phase 1: Core Package (1.5 days)

### Day 1 - Morning: SQLite Storage Setup with Drizzle

- [ ] Add Drizzle dependencies to core package
  ```bash
  cd packages/core
  bun add drizzle-orm
  bun add -D drizzle-kit
  ```

- [ ] Create `packages/core/src/logs/schema.ts`
  - [ ] Import from `drizzle-orm/bun-sqlite`
  - [ ] Define `logs` table with drizzle schema:
    - [ ] id (integer, primary key, autoincrement)
    - [ ] timestamp (text, not null)
    - [ ] method (text, not null)
    - [ ] jsonrpc_id (text)
    - [ ] server_name (text, not null)
    - [ ] session_id (text, not null)
    - [ ] duration_ms (integer, default 0)
    - [ ] http_status (integer, default 0)
    - [ ] request_json (text)
    - [ ] response_json (text)
    - [ ] error_json (text)
  - [ ] Add indexes:
    - [ ] index on timestamp DESC
    - [ ] index on server_name
    - [ ] index on session_id
    - [ ] composite index on (server_name, session_id)

- [ ] Create `packages/core/drizzle.config.ts`
  - [ ] Configure schema path, out directory, driver

- [ ] Create `packages/core/src/logs/db.ts`
  - [ ] Import `drizzle` from `drizzle-orm/bun-sqlite`
  - [ ] Import `Database` from `bun:sqlite`
  - [ ] Implement `getDb(storageDir)` function
    - [ ] Create SQLite connection
    - [ ] Wrap with drizzle()
    - [ ] Return typed db instance
  - [ ] Export singleton pattern

- [ ] Create `packages/core/src/logs/migrations.ts`
  - [ ] Implement `ensureMigrations(db)` function
  - [ ] Use promise-based singleton pattern for thread safety
  - [ ] Use drizzle-orm's migrate() function
  - [ ] Log migration status
  - [ ] Allow retry on failure

  ```typescript
  let migrationPromise: Promise<void> | null = null

  export async function ensureMigrations(db: BunSQLiteDatabase): Promise<void> {
    if (migrationPromise) {
      return migrationPromise // Wait for ongoing migration
    }

    migrationPromise = (async () => {
      try {
        await migrate(db, { migrationsFolder: './drizzle' })
        logger.info('Database migrations completed')
      } catch (err) {
        logger.error('Migration failed', err)
        migrationPromise = null // Allow retry
        throw err
      }
    })()

    return migrationPromise
  }
  ```

- [ ] Create `packages/core/src/logs/storage.ts`
  - [ ] Import db and schema
  - [ ] Implement `insertLog(db, record)` using drizzle insert
  - [ ] Implement `queryLogs(db, options)` using drizzle select with where/orderBy
  - [ ] Implement `getServers(db)` using group by aggregation
  - [ ] Implement `getSessions(db, serverName?)` using group by
  - [ ] Implement `rowToRecord()` helper for type conversion

**Validation:**
```bash
cd packages/core

# Generate initial migration
bunx drizzle-kit generate:sqlite

# Test migration runs
bun test src/logs/migrations.test.ts

# Test storage functions
bun test src/logs/storage.test.ts

# Test cases to write:
# ✓ Database initializes with correct schema
# ✓ Migrations run successfully
# ✓ Can insert a log record
# ✓ Can query logs with no filters
# ✓ Can query logs by server name
# ✓ Can query logs by session ID
# ✓ Can query logs by method
# ✓ Can query logs with time range (after/before)
# ✓ Can query logs with duration filter
# ✓ getServers returns correct aggregations
# ✓ getSessions returns correct aggregations
```

---

### Day 1 - Afternoon: Dual Storage Integration

- [ ] Update `packages/core/src/capture/index.ts`
  - [ ] Import `getDb`, `ensureMigrations`, and `insertLog`
  - [ ] Keep existing JSONL write in `appendCapture()`
  - [ ] Call `await ensureMigrations(db)` before every insert
  - [ ] Add SQLite write after JSONL write using drizzle
  - [ ] Add error handling for SQLite write (don't fail if SQLite fails)
  - [ ] Test that both writes work

  ```typescript
  export async function appendCapture(
    storageDir: string,
    record: CaptureRecord,
  ): Promise<string> {
    // 1. Write to JSONL (backup)
    const filename = await appendToJSONL(storageDir, record)

    // 2. Write to SQLite (queries)
    try {
      const db = getDb(storageDir)
      await ensureMigrations(db) // Thread-safe, runs once
      await insertLog(db, record)
    } catch (err) {
      logger.error('Failed to write to SQLite', err)
      // Don't fail - JSONL is still written
    }

    return filename
  }
  ```

**Validation:**
```bash
# Start gateway
bun run --filter @fiberplane/mcp-gateway-cli dev

# Generate some traffic (connect to test MCP server)
# Check both storage systems:

# 1. JSONL files exist
ls ~/.mcp-gateway/capture/test-server/

# 2. SQLite database exists
ls ~/.mcp-gateway/capture/logs.db

# 3. SQLite has data
bun run packages/core/src/logs/check-db.ts
# Script to print: SELECT COUNT(*) FROM logs
```

---

### Day 1 - Evening: Query Functions

- [ ] Create `packages/core/src/logs/query.ts`
  - [ ] Import storage functions and db
  - [ ] Implement `queryLogs(storageDir, options)` wrapper
    - Gets db instance
    - Runs migrations if needed
    - Delegates to storage.queryLogs()
  - [ ] Implement `getServers(storageDir)` wrapper
  - [ ] Implement `getSessions(storageDir, serverName?)` wrapper
  - [ ] Add TypeScript types for options and results

- [ ] Update `packages/core/src/index.ts`
  - [ ] Export `queryLogs`
  - [ ] Export `getServers`
  - [ ] Export `getSessions`
  - [ ] Export types: `LogQueryOptions`, `LogQueryResult`, `ServerInfo`, `SessionInfo`

**Example Drizzle Query Code:**
```typescript
// packages/core/src/logs/storage.ts
import { eq, and, desc, like, gte, lte } from 'drizzle-orm'
import { logs } from './schema'

export function queryLogs(db: BunSQLiteDatabase, options: LogQueryOptions) {
  let query = db.select().from(logs)

  const conditions = []
  if (options.serverName) {
    conditions.push(eq(logs.serverName, options.serverName))
  }
  if (options.sessionId) {
    conditions.push(eq(logs.sessionId, options.sessionId))
  }
  if (options.after) {
    conditions.push(gte(logs.timestamp, options.after))
  }
  if (options.before) {
    conditions.push(lte(logs.timestamp, options.before))
  }
  if (options.method) {
    conditions.push(like(logs.method, `%${options.method}%`))
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions))
  }

  query = query.orderBy(
    options.order === 'asc' ? logs.timestamp : desc(logs.timestamp)
  )

  if (options.limit) {
    query = query.limit(options.limit)
  }

  return query.all()
}
```

**Validation:**
```bash
bun run --filter @fiberplane/mcp-gateway-core build
bun run --filter @fiberplane/mcp-gateway-core typecheck
bun run check-circular

# Manual test script
bun run packages/core/src/logs/query.manual-test.ts
# Should print logs, servers, sessions
```

---

### Day 2 - Morning: Recovery & Export

- [ ] Create `packages/core/src/logs/recovery.ts`
  - [ ] Implement `rebuildDatabase(storageDir)` function
  - [ ] Read all JSONL files
  - [ ] Parse and insert into fresh SQLite database
  - [ ] Add progress logging

- [ ] Create `packages/core/src/logs/export.ts`
  - [ ] Implement `exportLogsToJSONL(storageDir, options)` function
  - [ ] Query logs from SQLite
  - [ ] Format as JSONL string
  - [ ] Return Buffer or string

**Validation:**
```bash
# Test recovery
rm ~/.mcp-gateway/capture/logs.db
bun run packages/core/src/logs/recovery.ts
ls ~/.mcp-gateway/capture/logs.db  # Should exist

# Check data restored
bun run packages/core/src/logs/check-db.ts
# Should show same log count
```

---

## Phase 2: API Package (1 day)

### Day 2 - Afternoon: Package Setup

- [ ] Create `packages/api/` directory structure
  ```
  packages/api/
  ├── src/
  │   ├── routes/
  │   ├── lib/
  │   ├── app.ts
  │   └── index.ts
  ├── package.json
  ├── tsconfig.json
  └── README.md
  ```

- [ ] Create `packages/api/package.json`
  - [ ] Set name: `@fiberplane/mcp-gateway-api`
  - [ ] Add dependencies: `hono`, `zod`, `@fiberplane/mcp-gateway-core`, `@fiberplane/mcp-gateway-types`
  - [ ] Add scripts: `dev`, `build`
  - [ ] Set type: `module`
  - [ ] Configure exports

- [ ] Create `packages/api/tsconfig.json`
  - [ ] Extend root tsconfig
  - [ ] Set proper paths

**Validation:**
```bash
cd packages/api
bun install
bun run build  # Should compile without errors
```

---

### Day 2 - Evening: Hono App & Routes

- [ ] Create `packages/api/src/app.ts`
  - [ ] Import Hono
  - [ ] Create `createApp(storageDir)` factory (async!)
  - [ ] **Run migrations during app creation:**
    ```typescript
    import { getDb, ensureMigrations } from '@fiberplane/mcp-gateway-core'

    export async function createApp(storageDir: string) {
      // Proactively run migrations before API accepts requests
      const db = getDb(storageDir)
      await ensureMigrations(db)

      const app = new Hono()
      // ... rest of setup
      return app
    }
    ```
  - [ ] Add CORS middleware
  - [ ] Add logger middleware
  - [ ] Add error handler
  - [ ] Mount routes

- [ ] Create `packages/api/src/lib/validation.ts`
  - [ ] Define `logQuerySchema` with Zod
  - [ ] Define `exportQuerySchema` with Zod
  - [ ] Define `sessionQuerySchema` with Zod

- [ ] Create `packages/api/src/routes/logs.ts`
  - [ ] Import queryLogs from core
  - [ ] Implement `GET /` endpoint
  - [ ] Validate query params
  - [ ] Call queryLogs and return JSON
  - [ ] Implement `GET /export` endpoint
  - [ ] Return JSONL with proper headers

- [ ] Create `packages/api/src/routes/servers.ts`
  - [ ] Import getServers from core
  - [ ] Implement `GET /` endpoint
  - [ ] Return JSON

- [ ] Create `packages/api/src/routes/sessions.ts`
  - [ ] Import getSessions from core
  - [ ] Implement `GET /` endpoint
  - [ ] Support optional `serverName` query param
  - [ ] Return JSON

- [ ] Create `packages/api/src/routes/health.ts`
  - [ ] Implement `GET /` endpoint
  - [ ] Return `{ status: 'ok' }`

- [ ] Create `packages/api/src/index.ts`
  - [ ] Export `createApp`

**Validation:**
```bash
# Create dev server: packages/api/src/dev.ts
bun run --filter @fiberplane/mcp-gateway-api dev

# Test endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/logs
curl http://localhost:3000/api/logs?serverName=test-server
curl http://localhost:3000/api/logs?limit=5
curl http://localhost:3000/api/servers
curl http://localhost:3000/api/sessions
curl http://localhost:3000/api/logs/export

# Check responses are valid JSON
curl http://localhost:3000/api/logs | jq .
```

---

## Phase 3: Web UI Package (2 days)

### Day 3 - Morning: Vite + React + Shadcn Setup

- [ ] Create Vite project
  ```bash
  cd packages
  npm create vite@latest web -- --template react-ts
  cd web
  bun install
  ```

- [ ] Initialize Shadcn/ui
  ```bash
  cd packages/web
  bunx shadcn-ui@latest init
  # Choose: default style, slate color, CSS variables: yes
  ```

- [ ] Add Shadcn components for MVP
  ```bash
  bunx shadcn-ui@latest add table
  bunx shadcn-ui@latest add select
  bunx shadcn-ui@latest add input
  bunx shadcn-ui@latest add button
  bunx shadcn-ui@latest add badge
  bunx shadcn-ui@latest add dialog
  ```

- [ ] Update `packages/web/package.json`
  - [ ] Change name to `@fiberplane/mcp-gateway-web`
  - [ ] Add dependencies: `@tanstack/react-query`, `date-fns`
  - [ ] Keep scripts: `dev`, `build`, `preview`
  - [ ] Add postbuild script to copy to API public folder

- [ ] Configure design tokens (see `docs/DESIGN_TOKENS.md`)
  - [ ] Replace Shadcn's default colors in `globals.css` with Figma tokens
  - [ ] Add custom badge colors (`--bg-badge-info`, `--bg-badge-success`, etc.)
  - [ ] Add Inter and Roboto Mono fonts to `index.html`
  - [ ] Update `tailwind.config.ts` with extended colors

- [ ] Configure `packages/web/vite.config.ts`
  - [ ] Add proxy for `/api` to `http://localhost:3000`
  - [ ] Configure port 5173

- [ ] Create `packages/web/src/lib/api.ts`
  - [ ] Define `LogEntry` interface
  - [ ] Define `PaginatedResponse` interface
  - [ ] Define `ServerInfo` interface
  - [ ] Define `SessionInfo` interface
  - [ ] Create `APIClient` class with methods:
    - [ ] `getLogs(params)`
    - [ ] `getServers()`
    - [ ] `getSessions(serverName?)`
    - [ ] `exportLogs(params)` - returns download URL
  - [ ] Export singleton `api` instance

- [ ] Create `packages/web/src/lib/queryClient.ts`
  - [ ] Import QueryClient
  - [ ] Configure with 1s refetch interval
  - [ ] Export singleton

- [ ] Update `packages/web/src/main.tsx`
  - [ ] Import QueryClientProvider
  - [ ] Wrap App with QueryClientProvider

**Validation:**
```bash
bun run --filter @fiberplane/mcp-gateway-web dev

# Visit http://localhost:5173
# Should see Vite + React default page
# Check Network tab - no errors
```

---

### Day 3 - Afternoon: Core Components

- [ ] Create `packages/web/src/hooks/useLogs.ts`
  - [ ] Implement main query hook
  - [ ] Implement polling query that merges new logs
  - [ ] Return `{ logs, loadMore, hasMore, isLoading }`

- [ ] Create `packages/web/src/components/ServerFilter.tsx`
  - [ ] useQuery for servers list
  - [ ] Render `<select>` dropdown
  - [ ] "All servers" option + server options
  - [ ] Show log count in dropdown

- [ ] Create `packages/web/src/components/SessionFilter.tsx`
  - [ ] useQuery for sessions list (depends on serverName)
  - [ ] Render `<select>` dropdown
  - [ ] "All sessions" option + session options
  - [ ] Show log count in dropdown

- [ ] Create `packages/web/src/components/MethodSearch.tsx`
  - [ ] Simple `<input type="text">`
  - [ ] Placeholder: "Search method..."
  - [ ] onChange handler

**Validation:**
```bash
bun run --filter @fiberplane/mcp-gateway-web dev

# Check each component renders
# Check dropdowns populate with data
# Check search input works
```

---

### Day 3 - Evening: Log Table

- [ ] Create `packages/web/src/components/LogTable.tsx`
  - [ ] Accept `logs: LogEntry[]` prop
  - [ ] Render `<table>` with headers
  - [ ] Headers: Timestamp, Server, Session, Method, Duration
  - [ ] Map logs to rows
  - [ ] Format timestamp with `date-fns`
  - [ ] Show duration in ms
  - [ ] Click row to expand
  - [ ] Track expanded row with useState

- [ ] Create `packages/web/src/components/LogDetails.tsx`
  - [ ] Accept `log: LogEntry` prop
  - [ ] Show request JSON in `<pre>`
  - [ ] Show response JSON in `<pre>`
  - [ ] Add copy buttons for each
  - [ ] Handle copy to clipboard
  - [ ] Show "Copied!" feedback

**Validation:**
```bash
# Generate test logs
bun run --filter @fiberplane/mcp-gateway-cli dev

# In another terminal, start web UI
bun run --filter @fiberplane/mcp-gateway-web dev

# Check table displays logs
# Click row - should expand
# Click again - should collapse
# Copy button - should copy JSON
```

---

### Day 4 - Morning: Remaining Components

- [ ] Create `packages/web/src/components/Pagination.tsx`
  - [ ] Accept `hasMore` prop
  - [ ] Render "Load More" button
  - [ ] Disable when no more results
  - [ ] Call `loadMore` on click

- [ ] Create `packages/web/src/components/ExportButton.tsx`
  - [ ] Accept current filters as props
  - [ ] Build export URL with api.exportLogs()
  - [ ] Create `<a>` tag and trigger download
  - [ ] Show button styled nicely

- [ ] Create `packages/web/src/components/RefreshButton.tsx`
  - [ ] Import useQueryClient
  - [ ] Call `queryClient.resetQueries()` on click
  - [ ] Show refresh icon (↻)

- [ ] Create `packages/web/src/components/ClearFiltersButton.tsx`
  - [ ] Accept callback to clear all filters
  - [ ] Show only when filters are active
  - [ ] Clear all filter state on click

**Validation:**
```bash
# Test each component:
# ✓ Load More button appears when hasMore = true
# ✓ Export button downloads file
# ✓ Refresh button clears cache
# ✓ Clear filters resets all dropdowns
```

---

### Day 4 - Afternoon: Main App Component

- [ ] Update `packages/web/src/App.tsx`
  - [ ] Create filter state (serverName, sessionId, methodSearch)
  - [ ] Create page state for pagination
  - [ ] Use `useLogs()` hook with filters
  - [ ] Client-side filter by method (simple string match)
  - [ ] Render layout:
    - [ ] Header with title
    - [ ] Filter bar with: ServerFilter, SessionFilter, MethodSearch
    - [ ] Export and Refresh buttons
    - [ ] Active filters display
    - [ ] Clear filters button (if any active)
    - [ ] LogTable
    - [ ] Pagination/Load More
  - [ ] Handle loading state
  - [ ] Handle error state
  - [ ] Handle empty state

- [ ] Create `packages/web/src/lib/badge-color.ts`
  - [ ] Implement `getMethodBadgeColor()` utility
  - [ ] Map method prefixes to badge colors:
    - `tools/*` → `bg-badge-info` (purple)
    - `resources/*` → `bg-badge-warning` (yellow)
    - `notifications/*` → `bg-badge-warning` (yellow)
    - `initialize` → `bg-badge-success` (green)

  ```typescript
  export function getMethodBadgeColor(method: string): string {
    if (method.startsWith('tools/')) return 'bg-badge-info'
    if (method.startsWith('resources/')) return 'bg-badge-warning'
    if (method.startsWith('notifications/')) return 'bg-badge-warning'
    if (method === 'initialize') return 'bg-badge-success'
    return 'bg-badge-info'
  }
  ```

**Validation:**
```bash
# Full integration test
bun run --filter @fiberplane/mcp-gateway-api dev     # Terminal 1
bun run --filter @fiberplane/mcp-gateway-web dev     # Terminal 2
bun run --filter @fiberplane/mcp-gateway-cli dev     # Terminal 3

# Open http://localhost:5173
# Test complete user flow:
# ✓ Logs appear in table
# ✓ Updates every 1 second
# ✓ Filter by server - table updates
# ✓ Filter by session - table updates
# ✓ Search method - filters client-side
# ✓ Clear filters - resets everything
# ✓ Click row - expands details
# ✓ Copy JSON - works
# ✓ Load more - fetches older logs
# ✓ Export - downloads JSONL file
# ✓ Refresh - clears cache and reloads
```

---

## Phase 4: CLI Integration (0.5 day)

### Day 4 - Evening: CLI Flag & Server Start

- [ ] Update `packages/mcp-gateway/package.json`
  - [ ] Add dependency: `@fiberplane/mcp-gateway-api": "workspace:*"`
  - [ ] Run `bun install`

- [ ] Update `packages/mcp-gateway/src/cli.ts`
  - [ ] Add `ui` flag to args definition
    ```typescript
    ui: {
      type: 'boolean',
      default: false,
      description: 'Start web UI server on http://localhost:3000',
    }
    ```
  - [ ] After TUI initialization, check if `parsedArgs.ui`
  - [ ] If true, import and start API server (note: await createApp):
    ```typescript
    if (parsedArgs.ui) {
      const { createApp } = await import('@fiberplane/mcp-gateway-api')
      const app = await createApp(storageDir) // ← await here!

      const server = Bun.serve({
        port: 3000,
        fetch: app.fetch,
      })

      logger.info(`🌐 Web UI available at http://localhost:${server.port}`)
    }
    ```

**Validation:**
```bash
# Test CLI with UI flag
bun run --filter @fiberplane/mcp-gateway-cli dev -- --ui

# Should see:
# ✓ TUI starts normally
# ✓ Log message: "🌐 Web UI available at http://localhost:3000"
# ✓ Open http://localhost:3000 - web UI loads
# ✓ Generate traffic - appears in TUI and Web UI
```

---

## Phase 5: Build & Production (0.5 day)

### Day 5 - Morning: Build Process

- [ ] Update `packages/web/package.json`
  - [ ] Add postbuild script:
    ```json
    "postbuild": "mkdir -p ../api/public && cp -r dist/* ../api/public/"
    ```

- [ ] Update `packages/api/src/app.ts`
  - [ ] Add static file serving after API routes:
    ```typescript
    import { serveStatic } from 'hono/bun'

    // Serve static files (if public/ exists)
    try {
      app.use('/*', serveStatic({ root: './public' }))
      app.get('/*', serveStatic({ path: './public/index.html' }))
    } catch (err) {
      // public/ doesn't exist - dev mode without built UI
    }
    ```

- [ ] Update root `package.json`
  - [ ] Add build script that builds in order:
    ```json
    "build": "bun run build:types && bun run build:core && bun run build:server && bun run build:web && bun run build:api && bun run build:cli"
    ```

- [ ] Add `packages/api/public/` to `.gitignore`

**Validation:**
```bash
# Build everything
bun run build

# Check outputs:
ls packages/types/dist/
ls packages/core/dist/
ls packages/server/dist/
ls packages/web/dist/
ls packages/api/dist/
ls packages/api/public/    # Should contain web UI
ls packages/mcp-gateway/dist/

# Test production build
cd packages/mcp-gateway
bun run dist/cli.js --ui

# Visit http://localhost:3000
# Should serve web UI from API
```

---

## Phase 5: Testing & Documentation (0.5 day)

### Day 5 - Afternoon: Manual Testing

- [ ] **Complete Testing Checklist:**

#### Web UI Functionality
- [ ] Table displays logs correctly
- [ ] Timestamp formatted properly
- [ ] Server filter works
- [ ] Session filter works
- [ ] Method search works (client-side)
- [ ] Multiple filters combine correctly
- [ ] Clear filters button works
- [ ] Active filters display correctly
- [ ] Click row to expand inline
- [ ] Request JSON shows correctly
- [ ] Response JSON shows correctly
- [ ] Copy buttons work
- [ ] "Copied!" feedback shows
- [ ] Load more button appears when hasMore
- [ ] Load more fetches older logs
- [ ] Export button downloads file
- [ ] Exported file is valid JSONL
- [ ] Exported file respects filters
- [ ] Refresh button clears cache
- [ ] Auto-refresh every 1s works
- [ ] Polling stops when tab hidden
- [ ] Empty state shows when no logs
- [ ] Loading state shows appropriately
- [ ] Error state handled gracefully

#### API Functionality
- [ ] GET /api/health returns 200
- [ ] GET /api/logs returns paginated results
- [ ] GET /api/logs?serverName filters correctly
- [ ] GET /api/logs?sessionId filters correctly
- [ ] GET /api/logs?method filters correctly
- [ ] GET /api/logs?after returns newer logs
- [ ] GET /api/logs?before returns older logs
- [ ] GET /api/logs?limit respects limit
- [ ] GET /api/servers returns list
- [ ] GET /api/sessions returns list
- [ ] GET /api/sessions?serverName filters correctly
- [ ] GET /api/logs/export downloads JSONL
- [ ] CORS allows localhost:5173
- [ ] Invalid params return 400
- [ ] Server errors return 500

#### Storage Functionality
- [ ] Logs written to JSONL files
- [ ] Logs written to SQLite database
- [ ] JSONL files human-readable
- [ ] SQLite queries are fast (<50ms)
- [ ] getServers aggregates correctly
- [ ] getSessions aggregates correctly
- [ ] Can rebuild DB from JSONL
- [ ] Database survives restarts

#### CLI Integration
- [ ] `--ui` flag starts API server
- [ ] Log message shows URL
- [ ] TUI works alongside API
- [ ] Can switch between TUI and web UI

---

### Day 5 - Late Afternoon: Documentation

- [ ] Update `packages/api/README.md`
  - [ ] Describe API endpoints
  - [ ] Show example requests
  - [ ] Document query parameters
  - [ ] Show response formats

- [ ] Update `packages/web/README.md`
  - [ ] Describe web UI features
  - [ ] Show development setup
  - [ ] Document component structure

- [ ] Update root `README.md`
  - [ ] Add Web UI section
  - [ ] Document `--ui` flag
  - [ ] Show screenshot (optional)
  - [ ] Link to API and Web docs

- [ ] Update `CLAUDE.md`
  - [ ] Add API package to structure
  - [ ] Add Web package to structure
  - [ ] Document dual storage system
  - [ ] Add new commands

**Example README additions:**

```markdown
## Web UI

View captured MCP logs in your browser:

\`\`\`bash
mcp-gateway --ui
\`\`\`

Then open http://localhost:3000

### Features
- 📊 View all captured MCP traffic in a table
- 🔍 Filter by server, session, or method
- 📝 Inspect full request/response JSON
- 💾 Export logs to JSONL format
- 🔄 Auto-refreshes every second
- ⚡ Fast queries with SQLite
- 📄 Human-readable JSONL backup files

### Storage
Logs are stored in two formats:
- **SQLite** (`~/.mcp-gateway/capture/logs.db`) - Fast indexed queries
- **JSONL** (`~/.mcp-gateway/capture/server-name/session-id.jsonl`) - Human-readable backup
```

---

## Post-MVP Cleanup

- [ ] Run type checking: `bun run typecheck`
- [ ] Run linting: `bun run lint`
- [ ] Check circular deps: `bun run check-circular`
- [ ] Verify all packages build: `bun run build`
- [ ] Test from clean install:
  ```bash
  rm -rf node_modules packages/*/node_modules
  bun install
  bun run build
  ```

---

## Optional Enhancements (If Time Permits)

- [ ] Add simple CSS animations
- [ ] Add keyboard shortcuts (r = refresh, e = export)
- [ ] Add row highlighting on hover
- [ ] Add status badge for errors (red dot)
- [ ] Add duration color coding (slow = red, fast = green)
- [ ] Add session status indicator (active/ended)
- [ ] Add total log count display
- [ ] Add "Back to top" button
- [ ] Add favicon for web UI
- [ ] Add meta tags for better browser tab title

---

## Success Criteria Checklist

### Functional Requirements ✅
- [ ] Can view logs in web browser
- [ ] Can filter by server
- [ ] Can filter by session
- [ ] Can search by method name
- [ ] Can see full request/response details
- [ ] Can export filtered logs to JSONL
- [ ] Logs auto-refresh every 1 second
- [ ] Can manually refresh with button
- [ ] Can load more logs (pagination)

### Performance Requirements ✅
- [ ] Initial page load < 2 seconds
- [ ] Log queries < 100ms
- [ ] Filters respond instantly
- [ ] Table scrolls smoothly with 100+ rows
- [ ] Export works with 1000+ logs
- [ ] Polling doesn't freeze UI

### Developer Experience ✅
- [ ] Hot reload works in dev mode
- [ ] TypeScript types are correct
- [ ] No circular dependencies
- [ ] All packages build without errors
- [ ] Easy to add new features

### User Experience ✅
- [ ] UI is intuitive
- [ ] No confusing error messages
- [ ] Loading states are clear
- [ ] Empty states are informative
- [ ] Buttons have clear labels

---

## Known Issues / Future Work

Document any issues discovered during implementation:

- [ ] Issue 1: [Description]
- [ ] Issue 2: [Description]

Features deferred to v1.1:
- [ ] Import logs functionality
- [ ] Full-text search in JSON
- [ ] Advanced filters (time range, duration slider)
- [ ] Column sorting
- [ ] Multiple server selection (checkboxes)
- [ ] Stats dashboard
- [ ] Dark mode
- [ ] Mobile responsive design

---

## Ready to Ship? 🚀

When all checkboxes are complete:

1. [ ] Create changeset:
   ```bash
   bun changeset
   # Select: core, api, web, cli
   # Type: minor (new feature)
   # Description: "Add web UI for viewing MCP logs"
   ```

2. [ ] Commit everything:
   ```bash
   git add .
   git commit -m "feat: add web UI with dual storage (SQLite + JSONL)"
   ```

3. [ ] Open PR or merge to main

4. [ ] Celebrate! 🎉

---

## Questions / Blockers

Use this section to track blockers during implementation:

- [ ] Question 1: [Description]
- [ ] Blocker 1: [Description]

---

**Happy Building!** 💪
