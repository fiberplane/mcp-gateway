# MCP Gateway Web UI Architecture

## Overview

This document outlines the architecture for adding a web-based UI to the MCP Gateway project. The web UI will provide a visual interface for viewing, filtering, and analyzing captured MCP traffic logs.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │         @fiberplane/mcp-gateway-web (React SPA)           │  │
│  │                                                            │  │
│  │  - TanStack Router (routing)                              │  │
│  │  - TanStack Query (data fetching, caching)                │  │
│  │  - URL-based state (filters synced to URL params)        │  │
│  │  - UI Components (tables, filters, details)               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              │ HTTP/REST                         │
│                              ▼                                   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │
┌──────────────────────────────┴──────────────────────────────────┐
│                    Node.js Process                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │      @fiberplane/mcp-gateway-api (HTTP API Server)        │  │
│  │                                                            │  │
│  │  - REST endpoints for log queries                         │  │
│  │  - WebSocket support for live updates (future)            │  │
│  │  - CORS configuration for local dev                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │      @fiberplane/mcp-gateway-core (Business Logic)        │  │
│  │                                                            │  │
│  │  - Log reading from JSONL files                           │  │
│  │  - Filtering, sorting, pagination                         │  │
│  │  - Aggregations (by server, session, method)              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                    File System                             │  │
│  │                                                            │  │
│  │  ~/.mcp-gateway/capture/<server>/<session>.jsonl          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. API Package (`@fiberplane/mcp-gateway-api`)

**Purpose:** Provides HTTP REST API for querying captured MCP traffic logs.

**Responsibilities:**
- Expose REST endpoints for log retrieval
- Handle filtering, sorting, pagination
- Serve static web UI assets (production)
- Manage CORS for local development
- Future: WebSocket support for live log streaming

**Technology:**
- Hono (lightweight HTTP framework)
- Built on top of `@fiberplane/mcp-gateway-core`

**Key Endpoints:**
- `GET /api/logs` - Query logs with filters
- `GET /api/logs/:id` - Get single log entry
- `GET /api/servers` - List available servers
- `GET /api/sessions` - List sessions
- `GET /api/stats` - Get aggregated statistics
- `GET /` - Serve web UI (production)

### 2. Web UI Package (`@fiberplane/mcp-gateway-web`)

**Purpose:** Single-page React application for visualizing MCP traffic logs.

**Responsibilities:**
- Display log entries in a filterable, sortable table
- Provide detailed view for individual log entries
- Show server/session statistics
- Support filtering by: server, session, method, timestamp
- Export logs to various formats (JSON, CSV)

**Technology Stack:**
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TanStack Router** - Type-safe routing
- **TanStack Query (React Query)** - Server state management, caching
- **URL Parameters** - Filter state persistence and sharing
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible component primitives (dropdowns, checkboxes, tabs)

**Key Features:**
- Log table view with sortable columns
- Filter bar with cascading dropdown menu
- Multi-select filters (method, client, server, session)
- Duration filter with comparison operators
- Filter badges with array truncation (first 2 values + "+N more")
- URL-based filter state (shareable links)
- Real-time polling for new logs
- Log detail expansion with JSON viewer
- Search across log content
- Export functionality
- Responsive design

**Filter Architecture:**

The web UI implements a URL-based filter system with the following components:

1. **Filter State Management:**
   - Filter state stored in URL search parameters (e.g., `?method=tools/call,prompts/get&server=figma`)
   - Type-safe parsing with Zod schemas (`packages/types/src/filters.ts`)
   - Automatic URL sync on filter changes
   - Shareable links preserve filter state

2. **Filter UI Components:**
   - `FilterBar` - Container with search input, filter badges, and controls
   - `AddFilterDropdown` - Cascading dropdown menu for adding filters
   - `FilterTypeMenu` - Top-level menu with filter type submenus
   - `FilterValueSubmenu` - Reusable submenu with multi-select checkboxes and search
   - `FilterBadge` - Removable badge showing active filter with value truncation

3. **Filter Types:**
   - **Multi-value filters** (method, client, server, session):
     - Support multiple selections with checkboxes
     - Search within values
     - Display as badges with truncation (first 2 values + "+N more")
     - Method filters show colored pills
   - **Comparison filters** (duration):
     - Single value with operator (equals, >, <, ≥, ≤)
     - Numeric input validation

4. **Data Flow:**
   - TanStack Query fetches available filter values from API
   - User selects values in cascading dropdown
   - Selection immediately updates URL parameters
   - `filter-utils.ts` parses URL and applies client-side filtering
   - Log list re-renders with filtered results

5. **Client-Side Filtering:**
   - `parseFiltersFromUrl()` - Converts URL params to Filter objects
   - `serializeFiltersToUrl()` - Converts Filter objects to URL params
   - `matchesFilter()` - Checks if log entry matches filter criteria
   - All filtering happens in browser for instant response

### 3. Core Package Extensions

**Implemented Functionality:**
- `LogReader` - Reads and parses JSONL capture files
- Query functions - Filter, sort, and paginate logs in memory
- Aggregation functions - Generate statistics for available filter values

**Data Flow:**
1. API receives request with query parameters
2. Core package reads relevant JSONL files from disk
3. Core applies filters, sorting, pagination
4. Core returns typed results to API
5. API serializes and sends to client
6. React Query caches and provides to components
7. Web UI applies client-side filtering with `filter-utils.ts`
8. Filter state synced to URL parameters for sharing

## Package Dependencies

```
types (base types)
  └─> core (log reading, querying)
        └─> api (HTTP endpoints)
              └─> web (React UI - dev only)
```

**Note:** Web UI package will be built separately and its static assets will be served by the API package in production.

## Integration Points

### CLI Integration

The CLI package will optionally start the API server:

```bash
mcp-gateway --ui             # Start with web UI on http://localhost:3000
mcp-gateway --ui-port 8080   # Custom port
mcp-gateway                  # TUI only (existing behavior)
```

When `--ui` flag is provided:
1. CLI starts the API server from `@fiberplane/mcp-gateway-api`
2. API serves static web UI assets
3. CLI logs the web UI URL
4. User can access logs via browser while CLI continues proxying

### Data Storage

**Current:** Logs are stored as JSONL files:
```
~/.mcp-gateway/capture/
  ├── server-name-1/
  │   ├── session-abc123.jsonl
  │   └── session-def456.jsonl
  └── server-name-2/
      └── session-xyz789.jsonl
```

**No Changes Required:** The web UI reads from existing capture files. No migration needed.

### Security Considerations

**Local Development:**
- API runs on localhost only
- CORS enabled for local dev (http://localhost:5173)
- No authentication required (local machine only)

**Future Production:**
- If deployed remotely, add authentication
- Consider read-only mode
- Add rate limiting

## Development Workflow

1. **API Development:**
   ```bash
   bun run --filter @fiberplane/mcp-gateway-api dev
   ```
   API runs on http://localhost:3000

2. **Web UI Development:**
   ```bash
   bun run --filter @fiberplane/mcp-gateway-web dev
   ```
   Vite dev server on http://localhost:5173 (proxies API requests to :3000)

3. **Integrated Testing:**
   ```bash
   bun run --filter @fiberplane/mcp-gateway-cli dev -- --ui
   ```
   CLI + API + Web UI all running together

## Build & Distribution

1. **API Package:** Standard TypeScript compilation
2. **Web UI Package:** Vite builds static assets to `dist/`
3. **CLI Package:** Includes API dependency, serves static assets

**Production Build:**
```bash
bun run build  # Builds all packages
```

**API serves static UI:**
```typescript
// In @fiberplane/mcp-gateway-api
import { serveStatic } from 'hono/serve-static'

app.use('/*', serveStatic({
  root: './node_modules/@fiberplane/mcp-gateway-web/dist'
}))
```

## Future Enhancements

1. **Live Updates:** WebSocket connection for real-time log streaming
2. **Export:** Download logs as JSON, CSV, or HAR format
3. **Search:** Full-text search across log content
4. **Bookmarks:** Save and share filter configurations
5. **Themes:** Dark/light mode support
6. **Performance:** Optimize for large log files (>10k entries)
7. **Diff View:** Compare request/response payloads
8. **Timeline View:** Visual timeline of MCP interactions

## Testing Strategy

1. **API Tests:** Integration tests for endpoints
2. **Web UI Tests:** Component tests with Vitest + React Testing Library
3. **E2E Tests:** Playwright for critical user flows
4. **Manual QA:** Test with real MCP servers (Figma, Notion, etc.)

## Success Metrics

1. **Functional:**
   - Can view all captured logs
   - Filters work correctly
   - Performance acceptable with 1000+ logs
   - Detail view shows complete request/response

2. **Developer Experience:**
   - Hot reload works in dev mode
   - Type safety across API boundary
   - Easy to add new filters/features

3. **User Experience:**
   - Loads within 2 seconds
   - Responsive on common screen sizes
   - Intuitive navigation and filtering
