# MCP Gateway Web UI - Implementation Plan

## Overview

This document provides a step-by-step implementation plan for adding Web UI capabilities to the MCP Gateway project. Each phase includes specific tasks and validation steps to ensure correctness.

## ✅ COMPLETED PHASES (January 2025)

### Phase 1: SQLite Storage Backend - COMPLETED ✅

**Status:** Implemented with SQLite instead of JSONL file reading

**What was actually built:**
- SQLite database with Drizzle ORM
- Schema migrations system
- Query functions: `queryLogs()`, `getServers()`, `getSessions()`
- Cursor-based pagination using `after`/`before` timestamps
- Composable backend architecture (SQLite + JSONL backends)
- Fixed pagination bug (changed from `gte`/`lte` to `gt`/`lt`)

**Key files created:**
- `packages/core/src/logs/storage.ts` - Query implementation
- `packages/core/src/logs/db.ts` - Database connection
- `packages/core/src/logs/schema.ts` - Drizzle schema
- `packages/core/src/logs/migrations.ts` - Migration system
- `packages/core/src/logs/query.ts` - Public API

---

### Phase 2: API Package - COMPLETED ✅

**Status:** Created with dependency injection pattern

**What was built:**
- `@fiberplane/mcp-gateway-api` package
- Hono HTTP server with routes
- Dependency injection for query functions
- Endpoints: `/api/logs`, `/api/servers`, `/api/sessions`, `/api/logs/export`
- Zod validation
- Dev server script
- Added biome-ignore comments for console.log statements

**Key files created:**
- `packages/api/src/app.ts` - App factory
- `packages/api/src/routes/index.ts` - Route handlers
- `packages/api/src/dev.ts` - Dev server
- `packages/api/package.json` - Package config

---

### Phase 3: Web UI Package - COMPLETED ✅

**Status:** MVP built with all core features

**What was built:**
- `@fiberplane/mcp-gateway-web` package
- Vite + React + TypeScript
- TanStack Query with 1s polling
- Basic CSS (no Tailwind)
- Server and session filter dropdowns
- Log table with inline expand/collapse
- Export button (JSONL)
- "Load More" cursor-based pagination
- Quality scripts (lint, format, typecheck)

**Bug fixes applied:**
- Fixed infinite re-render loop (moved state updates to useEffect)
- Fixed duplicate React keys in LogTable (composite key: timestamp-sessionId-id)
- Fixed duplicate React keys in SessionFilter (grouped by sessionId)
- Fixed pagination duplicates (changed gte/lte to gt/lt in core)
- Added useId() for accessibility

**Key files created:**
- `packages/web/src/App.tsx` - Main app
- `packages/web/src/components/log-table.tsx` - Table component
- `packages/web/src/components/server-filter.tsx` - Server dropdown
- `packages/web/src/components/session-filter.tsx` - Session dropdown
- `packages/web/src/components/export-button.tsx` - Export functionality
- `packages/web/src/components/pagination.tsx` - Load more button
- `packages/web/package.json` - Package config with quality scripts

---

## ❌ REMAINING PHASES (Not Started)

### Phase 4: CLI Integration - TODO

Add `--ui` flag to start web server from CLI.

### Phase 5: Testing & Polish - TODO

Integration tests, E2E tests, accessibility audit.

### Phase 6: Documentation - TODO

Update all documentation.

### Phase 7: Release - TODO

Publish packages to npm.

---

## Phase 1: Core Package Extensions [SUPERSEDED - See Completed Phases Above]

Add log reading and querying capabilities to the core package.

### Step 1.1: Create Log Reader Module

**Task:** Implement JSONL file reader for capture logs.

**Files to Create:**
- `packages/core/src/logs/reader.ts`

**Implementation:**

```typescript
// Read JSONL capture files and parse into CaptureRecords
export async function readCaptureFile(filePath: string): Promise<CaptureRecord[]>
export async function* streamCaptureFile(filePath: string): AsyncGenerator<CaptureRecord>
export async function listCaptureFiles(storageDir: string, serverName?: string): Promise<string[]>
```

**Validation:**
```bash
# Create test file in packages/core/src/logs/reader.test.ts
bun test packages/core/src/logs/reader.test.ts

# Test cases:
# ✓ Read empty JSONL file
# ✓ Read JSONL with multiple records
# ✓ Handle invalid JSON lines gracefully
# ✓ Stream large files without loading all into memory
# ✓ List all capture files in directory
```

**Manual Testing:**
```bash
# Run MCP Gateway to generate some logs
bun run --filter @fiberplane/mcp-gateway-cli dev

# In another terminal, test the reader
bun run packages/core/src/logs/reader.ts
```

---

### Step 1.2: Create Log Query Module

**Task:** Implement filtering, sorting, and pagination for logs.

**Files to Create:**
- `packages/core/src/logs/query.ts`
- `packages/core/src/logs/types.ts`

**Implementation:**

```typescript
export interface LogQueryOptions {
  serverName?: string;
  sessionId?: string;
  method?: string;
  search?: string;
  hasError?: boolean;
  minDuration?: number;
  maxDuration?: number;
  startTime?: string;
  endTime?: string;
  sortBy?: 'timestamp' | 'duration' | 'method' | 'server';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export async function queryLogs(
  storageDir: string,
  options: LogQueryOptions
): Promise<PaginatedResult<LogEntry>>
```

**Validation:**
```bash
bun test packages/core/src/logs/query.test.ts

# Test cases:
# ✓ Filter by server name
# ✓ Filter by session ID
# ✓ Filter by method
# ✓ Filter by time range
# ✓ Filter by duration
# ✓ Full-text search in request/response
# ✓ Sort by timestamp (asc/desc)
# ✓ Sort by duration
# ✓ Pagination works correctly
# ✓ Combine multiple filters
```

**Manual Testing:**
```typescript
// Test script: packages/core/src/logs/query.manual.test.ts
const results = await queryLogs('~/.mcp-gateway/capture', {
  serverName: 'figma-server',
  limit: 10,
});
console.log(`Found ${results.total} logs`);
```

---

### Step 1.3: Create Log Aggregator Module

**Task:** Generate statistics and summaries.

**Files to Create:**
- `packages/core/src/logs/aggregator.ts`

**Implementation:**

```typescript
export async function getServerStats(storageDir: string): Promise<ServerStats[]>
export async function getSessionStats(storageDir: string, serverName?: string): Promise<SessionStats[]>
export async function getMethodStats(storageDir: string, options: LogQueryOptions): Promise<MethodStats[]>
export async function getPerformanceStats(storageDir: string, options: LogQueryOptions): Promise<PerformanceStats>
```

**Validation:**
```bash
bun test packages/core/src/logs/aggregator.test.ts

# Test cases:
# ✓ Calculate server statistics
# ✓ Calculate session statistics
# ✓ Calculate method statistics
# ✓ Calculate performance percentiles (p50, p95, p99)
# ✓ Handle empty logs gracefully
```

---

### Step 1.4: Export Core Index

**Task:** Export new modules from core package.

**Files to Modify:**
- `packages/core/src/index.ts`

**Validation:**
```bash
bun run --filter @fiberplane/mcp-gateway-core build
bun run --filter @fiberplane/mcp-gateway-core typecheck

# Verify no circular dependencies
bun run check-circular
```

---

## Phase 2: API Package Creation

Create the HTTP API server package.

### Step 2.1: Create API Package Structure

**Task:** Set up new package with proper configuration.

**Commands:**
```bash
mkdir -p packages/api/src/{routes,middleware,lib}
```

**Files to Create:**
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
    "hono": "^4.0.0",
    "zod": "^3.22.0"
  }
}
```

**Validation:**
```bash
cd packages/api
bun install
bun run build

# Verify package appears in workspace
bun workspaces list
```

---

### Step 2.2: Create Hono App Factory

**Task:** Set up base Hono application with middleware.

**Files to Create:**
- `packages/api/src/app.ts`
- `packages/api/src/middleware/cors.ts`
- `packages/api/src/middleware/errorHandler.ts`
- `packages/api/src/lib/config.ts`

**Implementation:**

```typescript
// app.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { errorHandler } from './middleware/errorHandler';
import { logsRoutes } from './routes/logs';
import { serversRoutes } from './routes/servers';
import { sessionsRoutes } from './routes/sessions';
import { statsRoutes } from './routes/stats';
import { healthRoutes } from './routes/health';

export function createApp(storageDir: string) {
  const app = new Hono();

  // Middleware
  app.use('*', logger());
  app.use('*', cors({ origin: 'http://localhost:5173' }));
  app.onError(errorHandler);

  // Routes
  app.route('/api/logs', logsRoutes(storageDir));
  app.route('/api/servers', serversRoutes(storageDir));
  app.route('/api/sessions', sessionsRoutes(storageDir));
  app.route('/api/stats', statsRoutes(storageDir));
  app.route('/api/health', healthRoutes(storageDir));

  return app;
}
```

**Validation:**
```bash
# Create test file
bun test packages/api/src/app.test.ts

# Test cases:
# ✓ App factory creates Hono instance
# ✓ CORS middleware configured
# ✓ Routes registered correctly
```

---

### Step 2.3: Implement Logs Endpoints

**Task:** Create routes for log querying.

**Files to Create:**
- `packages/api/src/routes/logs.ts`
- `packages/api/src/lib/validation.ts`

**Implementation:**

```typescript
// routes/logs.ts
export function logsRoutes(storageDir: string) {
  const app = new Hono();

  // GET /api/logs
  app.get('/', async (c) => {
    const query = logQuerySchema.parse(c.req.query());
    const result = await queryLogs(storageDir, query);
    return c.json(result);
  });

  // GET /api/logs/:id
  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const log = await getLogById(storageDir, id);
    if (!log) {
      return c.json({ error: 'Log not found' }, 404);
    }
    return c.json(log);
  });

  // GET /api/logs/export
  app.get('/export', async (c) => {
    const query = exportQuerySchema.parse(c.req.query());
    const { format } = query;
    const data = await exportLogs(storageDir, query);

    const contentType = {
      json: 'application/json',
      jsonl: 'application/x-ndjson',
      csv: 'text/csv',
    }[format];

    c.header('Content-Type', contentType);
    c.header('Content-Disposition', `attachment; filename="logs.${format}"`);
    return c.body(data);
  });

  return app;
}
```

**Validation:**
```bash
# Integration tests
bun test packages/api/src/routes/logs.test.ts

# Test cases:
# ✓ GET /api/logs returns paginated results
# ✓ GET /api/logs with filters applies correctly
# ✓ GET /api/logs/:id returns single log
# ✓ GET /api/logs/:id returns 404 for invalid ID
# ✓ GET /api/logs/export returns correct format
# ✓ Invalid query params return 400
```

**Manual Testing:**
```bash
# Start API server
bun run --filter @fiberplane/mcp-gateway-api dev

# Test endpoints
curl http://localhost:3000/api/logs
curl http://localhost:3000/api/logs?serverName=figma-server
curl http://localhost:3000/api/logs?limit=5&page=1
```

---

### Step 2.4: Implement Supporting Endpoints

**Task:** Create routes for servers, sessions, stats, health.

**Files to Create:**
- `packages/api/src/routes/servers.ts`
- `packages/api/src/routes/sessions.ts`
- `packages/api/src/routes/stats.ts`
- `packages/api/src/routes/health.ts`

**Validation:**
```bash
bun test packages/api/src/routes/servers.test.ts
bun test packages/api/src/routes/sessions.test.ts
bun test packages/api/src/routes/stats.test.ts
bun test packages/api/src/routes/health.test.ts

# Manual testing
curl http://localhost:3000/api/servers
curl http://localhost:3000/api/sessions
curl http://localhost:3000/api/stats
curl http://localhost:3000/api/health
```

---

### Step 2.5: Add Static File Serving

**Task:** Serve web UI static assets in production.

**Files to Modify:**
- `packages/api/src/app.ts`

**Implementation:**

```typescript
import { serveStatic } from 'hono/bun';

// Serve static files (production only)
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './public' }));
  app.get('/*', serveStatic({ path: './public/index.html' }));
}
```

**Validation:**
```bash
# Build web UI first (step 3)
bun run --filter @fiberplane/mcp-gateway-web build

# Copy to API public folder
cp -r packages/web/dist packages/api/public

# Start API in production mode
NODE_ENV=production bun run --filter @fiberplane/mcp-gateway-api start

# Visit http://localhost:3000
# Should serve the web UI
```

---

## Phase 3: Web UI Package Creation

Create the React-based web interface.

### Step 3.1: Create Web Package Structure

**Task:** Initialize Vite + React + TypeScript project.

**Commands:**
```bash
cd packages
npm create vite@latest web -- --template react-ts
cd web
```

**Files to Modify:**
- `packages/web/package.json` - Update name and add dependencies
- `packages/web/vite.config.ts` - Configure proxy
- `packages/web/tsconfig.json` - Configure paths

**package.json additions:**
```json
{
  "name": "@fiberplane/mcp-gateway-web",
  "dependencies": {
    "@fiberplane/mcp-gateway-types": "workspace:*",
    "@tanstack/react-router": "^1.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-virtual": "^3.0.0",
    "zustand": "^4.5.0",
    "date-fns": "^3.0.0",
    "lucide-react": "^0.300.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@tanstack/router-vite-plugin": "^1.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

**Validation:**
```bash
cd packages/web
bun install
bun run dev

# Should start on http://localhost:5173
# Visit in browser - should see Vite + React page
```

---

### Step 3.2: Configure Tailwind CSS

**Task:** Set up Tailwind for styling.

**Commands:**
```bash
cd packages/web
bunx tailwindcss init -p
```

**Files to Modify:**
- `packages/web/tailwind.config.ts`
- `packages/web/src/index.css`

**Validation:**
```bash
bun run dev

# Add test Tailwind classes to App.tsx
# <div className="bg-blue-500 text-white p-4">Test</div>
# Verify styling appears in browser
```

---

### Step 3.3: Set Up TanStack Router

**Task:** Configure file-based routing.

**Files to Create:**
- `packages/web/src/routes/__root.tsx`
- `packages/web/src/routes/index.tsx`
- `packages/web/src/routes/logs/index.tsx`
- `packages/web/src/routes/logs/$logId.tsx`

**Files to Modify:**
- `packages/web/vite.config.ts` - Add TanStack Router plugin
- `packages/web/src/main.tsx` - Set up router

**Validation:**
```bash
bun run dev

# Visit http://localhost:5173
# Should redirect to /logs
# Visit /logs - should show logs page (empty for now)
# Visit /logs/123 - should show detail page
```

---

### Step 3.4: Set Up TanStack Query

**Task:** Configure React Query for data fetching.

**Files to Create:**
- `packages/web/src/lib/queryClient.ts`
- `packages/web/src/lib/api.ts`

**Files to Modify:**
- `packages/web/src/main.tsx` - Wrap with QueryClientProvider

**Validation:**
```bash
# Create test hook
# src/hooks/useLogs.ts

bun run dev

# In browser console:
# Should see React Query devtools
# Network tab should show API requests to localhost:3000
```

---

### Step 3.5: Create Zustand Stores

**Task:** Set up client state management.

**Files to Create:**
- `packages/web/src/stores/filterStore.ts`
- `packages/web/src/stores/uiStore.ts`

**Validation:**
```typescript
// Test in component
function TestComponent() {
  const { filters, updateFilters } = useFilterStore();
  console.log(filters);
  return null;
}

# Verify state updates work in browser
```

---

### Step 3.6: Build Log Table Component

**Task:** Create virtualized table with TanStack Virtual.

**Files to Create:**
- `packages/web/src/components/logs/LogTable.tsx`
- `packages/web/src/components/logs/LogRow.tsx`
- `packages/web/src/components/logs/LogTableHeader.tsx`

**Validation:**
```bash
bun run dev

# Generate test logs with MCP Gateway
bun run --filter @fiberplane/mcp-gateway-cli dev

# Web UI should show logs in table
# Scroll should be smooth (virtual scrolling)
# Click row should navigate to detail page
```

---

### Step 3.7: Build Filter Components

**Task:** Create filter sidebar and controls.

**Files to Create:**
- `packages/web/src/components/logs/LogFilters.tsx`
- `packages/web/src/components/logs/LogSearchBar.tsx`
- `packages/web/src/components/logs/AppliedFilters.tsx`
- `packages/web/src/components/logs/ServerTabs.tsx`

**Validation:**
```bash
bun run dev

# Test each filter:
# ✓ Server tabs filter by server
# ✓ Search bar filters logs
# ✓ Filter sidebar checkboxes work
# ✓ Applied filters show correctly
# ✓ Clear filters button resets
# ✓ URL params update with filters
```

---

### Step 3.8: Build Log Detail Component

**Task:** Create detail view with request/response.

**Files to Create:**
- `packages/web/src/components/logs/LogDetail.tsx`
- `packages/web/src/components/common/JsonViewer.tsx`
- `packages/web/src/components/common/CopyButton.tsx`

**Validation:**
```bash
bun run dev

# Click on log row
# ✓ Modal/page opens
# ✓ Shows log metadata
# ✓ Request tab shows formatted JSON
# ✓ Response tab shows formatted JSON
# ✓ Copy button copies to clipboard
# ✓ Close button returns to list
```

---

### Step 3.9: Add UI Components Library

**Task:** Install and configure Shadcn/ui or Radix UI.

**Commands:**
```bash
cd packages/web
bunx shadcn-ui@latest init

# Add components
bunx shadcn-ui@latest add button
bunx shadcn-ui@latest add dialog
bunx shadcn-ui@latest add select
bunx shadcn-ui@latest add checkbox
bunx shadcn-ui@latest add tabs
```

**Validation:**
```bash
bun run dev

# Verify components render correctly
# Test accessibility (keyboard navigation, ARIA)
```

---

## Phase 4: CLI Integration

Integrate API server into CLI package.

### Step 4.1: Add API Dependency to CLI

**Task:** Add API package as dependency.

**Files to Modify:**
- `packages/mcp-gateway/package.json`

**Dependencies:**
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
bun run build
```

---

### Step 4.2: Add CLI Flags for Web UI

**Task:** Add `--ui` and `--ui-port` flags.

**Files to Modify:**
- `packages/mcp-gateway/src/cli.ts`

**Implementation:**

```typescript
const args = {
  // ... existing flags
  ui: {
    type: 'boolean',
    default: false,
    description: 'Start web UI server',
  },
  'ui-port': {
    type: 'number',
    default: 3000,
    description: 'Web UI server port',
  },
};
```

**Validation:**
```bash
bun run --filter @fiberplane/mcp-gateway-cli dev -- --help

# Should show new flags
```

---

### Step 4.3: Start API Server from CLI

**Task:** Conditionally start API server when `--ui` flag provided.

**Files to Modify:**
- `packages/mcp-gateway/src/cli.ts`

**Implementation:**

```typescript
if (parsedArgs.ui) {
  const { createApp } = await import('@fiberplane/mcp-gateway-api');
  const app = createApp(storageDir);

  const server = Bun.serve({
    port: parsedArgs['ui-port'],
    fetch: app.fetch,
  });

  logger.info(`Web UI available at http://localhost:${server.port}`);
}
```

**Validation:**
```bash
# Start CLI with UI
bun run --filter @fiberplane/mcp-gateway-cli dev -- --ui

# Should see:
# ✓ TUI starts normally
# ✓ Log message: "Web UI available at http://localhost:3000"
# ✓ API server responds to requests
# ✓ Web UI loads in browser
```

---

### Step 4.4: Update CLI Documentation

**Task:** Document new flags in README.

**Files to Modify:**
- `packages/mcp-gateway/README.md`
- Root `README.md`

**Validation:**
```bash
# Manual review of documentation
# Ensure examples are correct
```

---

## Phase 5: Testing & Polish

Comprehensive testing and refinements.

### Step 5.1: Write Integration Tests

**Task:** Create end-to-end tests for API.

**Files to Create:**
- `packages/api/tests/integration/logs.test.ts`
- `packages/api/tests/integration/servers.test.ts`

**Validation:**
```bash
bun test packages/api/tests/

# All integration tests should pass
```

---

### Step 5.2: Write Component Tests

**Task:** Test React components.

**Files to Create:**
- `packages/web/src/components/logs/__tests__/LogTable.test.tsx`
- `packages/web/src/components/logs/__tests__/LogFilters.test.tsx`

**Validation:**
```bash
bun test packages/web/

# All component tests should pass
```

---

### Step 5.3: Add E2E Tests

**Task:** Create Playwright tests for critical flows.

**Files to Create:**
- `packages/web/e2e/logs.spec.ts`

**Test Flows:**
```typescript
test('can view and filter logs', async ({ page }) => {
  // Start MCP Gateway with UI
  // Navigate to /logs
  // Verify logs load
  // Apply filter
  // Verify filtered results
  // Click log row
  // Verify detail view
});
```

**Validation:**
```bash
bunx playwright test

# All E2E tests should pass
```

---

### Step 5.4: Performance Testing

**Task:** Test with large datasets.

**Validation:**
```bash
# Generate 1000+ log entries
# Test MCP server with many requests

# Verify:
# ✓ API responds within 500ms
# ✓ Web UI renders smoothly
# ✓ Virtual scrolling works
# ✓ No memory leaks
```

---

### Step 5.5: Accessibility Audit

**Task:** Ensure WCAG compliance.

**Tools:**
- Lighthouse
- axe DevTools
- Keyboard navigation testing

**Validation:**
```bash
# Run Lighthouse audit
bunx lighthouse http://localhost:5173/logs

# Should achieve:
# ✓ Accessibility score > 90
# ✓ All keyboard navigation works
# ✓ Screen reader compatible
```

---

### Step 5.6: Cross-Browser Testing

**Task:** Test in major browsers.

**Browsers:**
- Chrome/Edge (Chromium)
- Firefox
- Safari

**Validation:**
```
# Manual testing checklist:
☐ Loads correctly in all browsers
☐ Styling consistent
☐ All features work
☐ No console errors
```

---

## Phase 6: Documentation & Deployment

Finalize documentation and prepare for release.

### Step 6.1: Update Project Documentation

**Task:** Document the new packages and features.

**Files to Modify:**
- `CLAUDE.md` - Add API and Web packages
- Root `README.md` - Document `--ui` flag
- `packages/api/README.md` - API documentation
- `packages/web/README.md` - Web UI documentation

**Validation:**
```bash
# Manual review
# Ensure all commands work as documented
```

---

### Step 6.2: Add Changesets

**Task:** Create changeset for new feature.

**Commands:**
```bash
bun changeset

# Select packages: core, api, web, cli
# Change type: minor (new feature)
# Description: "Add web UI for viewing MCP logs"
```

**Validation:**
```bash
# Verify changeset created
ls .changeset/

# Preview version bump
bun changeset version --dry-run
```

---

### Step 6.3: Update CI/CD Workflows

**Task:** Ensure CI builds new packages.

**Files to Modify:**
- `.github/workflows/ci.yml`

**Add Build Steps:**
```yaml
- name: Build API package
  run: bun run --filter @fiberplane/mcp-gateway-api build

- name: Build Web package
  run: bun run --filter @fiberplane/mcp-gateway-web build
```

**Validation:**
```bash
# Push to GitHub
# Verify CI passes
```

---

### Step 6.4: Manual QA with Real Servers

**Task:** Test with production MCP servers.

**Test Servers:**
- Figma
- Notion
- Weather
- File system

**Test Scenarios:**
```
☐ Start MCP Gateway with UI
☐ Connect to real MCP server
☐ Make requests via Claude Code
☐ View logs in web UI
☐ Apply filters
☐ View log details
☐ Export logs
☐ Verify all data correct
```

**Validation:**
```bash
# Start with UI
bun run --filter @fiberplane/mcp-gateway-cli dev -- --ui

# In Claude Code, use MCP server
# Verify logs appear in web UI
```

---

## Phase 7: Release

Publish the new feature.

### Step 7.1: Version Bump

**Commands:**
```bash
bun changeset version
git add .
git commit -m "Version packages"
```

**Validation:**
```bash
# Verify version numbers updated
# Verify CHANGELOG.md updated
```

---

### Step 7.2: Build All Packages

**Commands:**
```bash
bun run clean
bun run build
```

**Validation:**
```bash
# Verify all packages build successfully
# Check dist/ folders
```

---

### Step 7.3: Test Build Locally

**Task:** Install and test built packages.

**Commands:**
```bash
# Link globally
cd packages/cli
bun link

# Test in another directory
cd ~/test-project
mcp-gateway --ui
```

**Validation:**
```bash
# Verify:
# ✓ CLI works
# ✓ UI starts
# ✓ All features work
```

---

### Step 7.4: Publish to npm

**Commands:**
```bash
bun changeset publish
git push --follow-tags
```

**Validation:**
```bash
# Verify packages published
npm view @fiberplane/mcp-gateway-api
npm view @fiberplane/mcp-gateway-web

# Install from npm
npm install -g @fiberplane/mcp-gateway
mcp-gateway --ui
```

---

## Summary Checklist

### Core Package ✓
- [ ] Log reader module
- [ ] Log query module
- [ ] Log aggregator module
- [ ] All tests pass
- [ ] No circular dependencies

### API Package ✓
- [ ] Package structure created
- [ ] Hono app configured
- [ ] All endpoints implemented
- [ ] Integration tests pass
- [ ] Static file serving works

### Web Package ✓
- [ ] Vite + React setup
- [ ] TanStack Router configured
- [ ] TanStack Query configured
- [ ] Zustand stores created
- [ ] Log table component
- [ ] Filter components
- [ ] Detail view component
- [ ] Component tests pass
- [ ] E2E tests pass

### CLI Integration ✓
- [ ] API dependency added
- [ ] CLI flags added
- [ ] API server starts from CLI
- [ ] Documentation updated

### Quality Assurance ✓
- [ ] All tests pass
- [ ] Performance acceptable
- [ ] Accessibility compliant
- [ ] Cross-browser compatible
- [ ] Real-world testing complete

### Release ✓
- [ ] Documentation complete
- [ ] Changesets created
- [ ] CI/CD updated
- [ ] Packages published

---

## Estimated Timeline

- **Phase 1 (Core):** 2-3 days
- **Phase 2 (API):** 2-3 days
- **Phase 3 (Web):** 4-5 days
- **Phase 4 (CLI):** 1 day
- **Phase 5 (Testing):** 2-3 days
- **Phase 6 (Documentation):** 1 day
- **Phase 7 (Release):** 1 day

**Total:** ~13-17 days

---

## Risk Mitigation

### Risk: Large log files cause performance issues
**Mitigation:** Implement streaming and pagination early. Test with 10k+ entries.

### Risk: Complex filtering logic is buggy
**Mitigation:** Write comprehensive tests for all filter combinations.

### Risk: Web UI is not responsive
**Mitigation:** Test on mobile/tablet devices early. Use responsive Tailwind classes.

### Risk: Type mismatches between API and UI
**Mitigation:** Share types from `@fiberplane/mcp-gateway-types` package. Use Zod for runtime validation.

### Risk: CI/CD pipeline breaks
**Mitigation:** Test builds locally first. Update CI config before publishing.

---

## Success Criteria

1. **Functional Requirements:**
   - ✓ Web UI displays all captured logs
   - ✓ Filters work correctly
   - ✓ Detail view shows complete data
   - ✓ Export functionality works
   - ✓ Performance acceptable with 1000+ logs

2. **Developer Experience:**
   - ✓ Hot reload works in dev
   - ✓ Type safety across packages
   - ✓ Easy to add new features

3. **User Experience:**
   - ✓ Intuitive navigation
   - ✓ Fast page loads
   - ✓ Accessible
   - ✓ Responsive design

4. **Quality:**
   - ✓ All tests pass
   - ✓ No regressions in existing features
   - ✓ Documentation complete
