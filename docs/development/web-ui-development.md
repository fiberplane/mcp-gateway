# Web UI Development Guide

Complete guide for developing the MCP Gateway Web UI, including architecture, technology stack, and design system.

**Table of Contents:**
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Design System and Tokens](#design-system-and-tokens)
- [Development Workflow](#development-workflow)
- [Component Development](#component-development)
- [Performance Considerations](#performance-considerations)

---

## Architecture

### System Overview

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
│  │  - Log reading from SQLite                                │  │
│  │  - Filtering, sorting, pagination                         │  │
│  │  - Aggregations (by server, session, method)              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                    SQLite Database                         │  │
│  │                                                            │  │
│  │  ~/.mcp-gateway/logs.db                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Package Dependencies

```
types (base types)
  └─> core (log reading, querying)
        └─> api (HTTP endpoints)
              └─> web (React UI - dev only)
```

**Note:** Web UI package is built separately and its static assets are served by the API package in production.

### Key Components

#### API Package (`@fiberplane/mcp-gateway-api`)

**Purpose:** Provides HTTP REST API for querying captured MCP traffic logs.

**Responsibilities:**
- Expose REST endpoints for log retrieval
- Handle filtering, sorting, pagination
- Serve static web UI assets (production)
- Manage CORS for local development
- Future: WebSocket support for live log streaming

**Technology:** Hono (lightweight HTTP framework)

**Key Endpoints:**
- `GET /api/logs` - Query logs with filters
- `GET /api/servers` - List available servers
- `GET /api/sessions` - List sessions
- `POST /api/logs/clear` - Clear all logs

#### Web UI Package (`@fiberplane/mcp-gateway-web`)

**Purpose:** Single-page React application for visualizing MCP traffic logs.

**Responsibilities:**
- Display log entries in a filterable, sortable table
- Provide detailed view for individual log entries
- Show server/session statistics
- Support filtering by: server, session, method, timestamp
- Export logs to various formats (JSON, CSV)

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
- **Token estimation** - Display approximate token costs for LLM operations
- **Method detail preview** - Human-readable summaries of request/response content

### Filter Architecture

The web UI implements a URL-based filter system:

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

### Data Flow

1. API receives request with query parameters
2. Core package reads relevant data from SQLite
3. Core applies filters, sorting, pagination
4. Core returns typed results to API
5. API serializes and sends to client
6. React Query caches and provides to components
7. Web UI applies client-side filtering with `filter-utils.ts`
8. Filter state synced to URL parameters for sharing

---

## Technology Stack

### Core Stack

| Layer | Technology | Version | Why? |
|-------|-----------|---------|------|
| **Build Tool** | Vite | Latest | Fast HMR, optimal for React |
| **Framework** | React 19 | 19.x | Component-based, large ecosystem |
| **Language** | TypeScript | 5.x | Type safety, better DX |
| **Styling** | Tailwind CSS | 3.x | Utility-first, fast development |
| **Components** | Radix UI | Latest | Accessible, customizable primitives |
| **State (Server)** | TanStack Query | 5.x | Server state, polling, caching |
| **Routing** | TanStack Router | Latest | Type-safe routing |
| **Date Formatting** | date-fns | Latest | Lightweight, tree-shakeable |

### Why These Technologies?

**Vite:**
- Fast HMR for instant updates
- Optimal dev experience
- Production build optimization

**React 19:**
- Modern component model
- Large ecosystem
- Strong TypeScript support

**Tailwind CSS:**
- Utility-first approach
- Fast development
- Small production bundle
- Excellent with Radix UI

**Radix UI:**
- Accessible by default
- Unstyled primitives
- Full customization
- Headless architecture

**TanStack Query:**
- Server state management
- Automatic caching
- Background refetching
- Polling support
- DevTools for debugging

**TanStack Router:**
- Type-safe routing
- URL state management
- Loader pattern

### Components Used

From Radix UI:
- `@radix-ui/react-dropdown-menu` - Filter dropdowns
- `@radix-ui/react-checkbox` - Multi-select filters
- `@radix-ui/react-dialog` - Modals
- `@radix-ui/react-tabs` - Tabs
- `@radix-ui/react-select` - Select inputs

### Package Structure

```
packages/web/
├── src/
│   ├── components/
│   │   ├── ui/              ← Radix-based components
│   │   │   ├── button.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── table.tsx
│   │   │   ├── input.tsx
│   │   │   └── badge.tsx
│   │   ├── filter-bar.tsx
│   │   ├── log-table.tsx
│   │   ├── log-details.tsx
│   │   └── server-management.tsx
│   ├── lib/
│   │   ├── api.ts           ← API client
│   │   ├── query-client.ts  ← TanStack Query config
│   │   ├── filter-utils.ts  ← Filter logic
│   │   └── method-detail.ts ← Method preview logic
│   ├── routes/              ← TanStack Router routes
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css            ← Tailwind + design tokens
├── tailwind.config.ts       ← Tailwind + design tokens
├── vite.config.ts
├── package.json
└── tsconfig.json
```

---

## Design System and Tokens

### Overview

The design system uses **Tailwind v4's `@theme` directive** with semantic CSS variables using the `--color-*` naming convention.

**Figma Design:** [MCP Gateway Playground](https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground)

### Token Strategy

- **Tailwind v4 native** - Uses `@theme` block in CSS (not JavaScript config)
- **Hex color format** - Direct color values for simplicity
- **Semantic naming** - `--color-primary`, `--color-badge-info`, etc.
- **Intent-based badges** - `info`, `success`, `warning`, `error` (not raw colors)
- **Method categories** - Distinct colors for different MCP method types
- **Status indicators** - Dedicated colors for online/offline/error states

### Fonts

- **UI Text:** Inter (Google Fonts)
- **Code/Monospace:** Roboto Mono (Google Fonts)

### Quick Reference: Tailwind Class Names

**Common Pattern:** Tailwind v4 auto-generates utility classes from `--color-*` variables

| CSS Variable | Tailwind Classes | Usage |
|--------------|------------------|-------|
| `--color-primary` | `bg-primary` `text-primary` | Primary backgrounds/text |
| `--color-primary-foreground` | `text-primary-foreground` | Text on primary bg |
| `--color-background` | `bg-background` | Page background (light gray) |
| `--color-card` | `bg-card` | Card backgrounds (white) |
| `--color-muted` | `bg-muted` `text-muted` | Muted backgrounds/text |
| `--color-muted-foreground` | `text-muted-foreground` | Muted text color |
| `--color-badge-info` | `bg-badge-info` | Info badge (purple) |
| `--color-badge-success` | `bg-badge-success` | Success badge (green) |
| `--color-badge-warning` | `bg-badge-warning` | Warning badge (yellow) |
| `--color-badge-error` | `bg-badge-error` | Error badge (red) |
| `--color-method-tool` | `bg-method-tool` | Tool method pills (yellow) |
| `--color-method-resource` | `bg-method-resource` | Resource method pills (peach) |
| `--color-status-success` | `bg-status-success` `text-status-success` | Success status (green) |
| `--color-border` | `border-border` | Border color |

**Example:**
```tsx
✅ Correct:  <button className="bg-primary text-primary-foreground">
✅ Correct:  <span className="bg-method-tool">tools/call</span>
❌ Wrong:    <button className="bg-bg-primary text-fg-on-primary">
```

### Color Tokens

All tokens defined in `packages/web/src/index.css` using Tailwind v4's `@theme` directive.

#### Background Colors

| CSS Variable | Hex Value | Usage | Tailwind Class |
|-------------|-----------|-------|----------------|
| `--color-background` | `#f5f5f5` | Page background | `bg-background` |
| `--color-card` | `#ffffff` | Card/container backgrounds | `bg-card` |
| `--color-muted` | `#f9fafb` | Table row hover, muted areas | `bg-muted` |
| `--color-primary` | `#272624` | Primary button, selected tabs | `bg-primary` |

#### Badge Colors (Intent-based)

| CSS Variable | Hex Value | Usage | Tailwind Class |
|-------------|-----------|-------|----------------|
| `--color-badge-info` | `#dddbff` | Info badges (purple) | `bg-badge-info` |
| `--color-badge-success` | `#dcfce7` | Success badges (green) | `bg-badge-success` |
| `--color-badge-warning` | `#fef3c7` | Warning badges (yellow) | `bg-badge-warning` |
| `--color-badge-error` | `#fee2e2` | Error badges (red) | `bg-badge-error` |

#### Method Category Colors

Used for ColorPill components in filters and log displays:

| CSS Variable | Hex Value | Usage | Tailwind Class |
|-------------|-----------|-------|----------------|
| `--color-method-init` | `#dddbff` | Initialize, ping methods | `bg-method-init` |
| `--color-method-resource` | `#ffe6e0` | Resource methods (resources/*) | `bg-method-resource` |
| `--color-method-tool` | `#f7dd91` | Tool methods (tools/*) | `bg-method-tool` |
| `--color-method-prompt` | `#d1eaac` | Prompt methods (prompts/*) | `bg-method-prompt` |
| `--color-method-notification` | `#f8d2e8` | Notification methods | `bg-method-notification` |
| `--color-method-default` | `#e5e7eb` | Unknown/other methods | `bg-method-default` |

#### Status Indicator Colors

Used for online/offline/error status badges and dots:

| CSS Variable | Hex Value | Usage | Tailwind Class |
|-------------|-----------|-------|----------------|
| `--color-status-success` | `#22c55e` | Online status (green) | `bg-status-success` |
| `--color-status-warning` | `#f59e0b` | Warning status (amber) | `bg-status-warning` |
| `--color-status-error` | `#ef4444` | Error status (red) | `bg-status-error` |
| `--color-status-neutral` | `#9ca3af` | Offline/not found (gray) | `bg-status-neutral` |

#### Foreground Colors

| CSS Variable | Hex Value | Usage | Tailwind Class |
|-------------|-----------|-------|----------------|
| `--color-foreground` | `#000000` | Body text, table text | `text-foreground` |
| `--color-primary-foreground` | `#ffffff` | Text on dark backgrounds | `text-primary-foreground` |
| `--color-muted-foreground` | `#6b7280` | Muted text, timestamps | `text-muted-foreground` |

#### Border Colors

| CSS Variable | Hex Value | Usage | Tailwind Class |
|-------------|-----------|-------|----------------|
| `--color-border` | `#e5e7eb` | Table borders, dividers | `border-border` |
| `--color-input` | `#e5e7eb` | Input borders | `border-input` |
| `--color-ring` | `#1e293b` | Focus rings | `ring-ring` |

### Tailwind Configuration

**Tailwind v4** uses a minimal JavaScript configuration file. Theme tokens are defined in CSS using the `@theme` directive.

```typescript
// packages/web/tailwind.config.ts
import type { Config } from "tailwindcss";

// Tailwind v4 - theme configuration is now in CSS using @theme
// This config file is minimal and primarily for content paths
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
} satisfies Config;
```

### CSS Theme Definition

**Location:** `packages/web/src/index.css`

Tailwind v4 uses the `@theme` directive to define design tokens directly in CSS:

```css
@import "tailwindcss";

@theme {
  /* Background colors */
  --color-background: #f5f5f5;  /* Light gray page background - matches Figma design */
  --color-card: #ffffff;
  --color-muted: #f9fafb;
  --color-primary: #272624;

  /* Badge colors (intent-based) */
  --color-badge-info: #dddbff;     /* purple - for tools/* */
  --color-badge-success: #dcfce7;  /* green - for initialize */
  --color-badge-warning: #fef3c7;  /* yellow - for resources/*, notifications/* */
  --color-badge-error: #fee2e2;    /* red - for errors */

  /* Method category colors (for ColorPill components in filters/logs) */
  --color-method-init: #dddbff;      /* purple - initialization & lifecycle */
  --color-method-resource: #ffe6e0;  /* peach - resource methods */
  --color-method-tool: #f7dd91;      /* yellow - tool methods */
  --color-method-prompt: #d1eaac;    /* lime - prompt methods */
  --color-method-notification: #f8d2e8; /* pink - notification methods */
  --color-method-default: #e5e7eb;   /* gray - unknown/other methods */

  /* Foreground colors */
  --color-foreground: #000000;
  --color-primary-foreground: #ffffff;
  --color-muted-foreground: #6b7280;

  /* Border colors */
  --color-border: #e5e7eb;
  --color-input: #e5e7eb;
  --color-ring: #1e293b;

  /* Status indicator colors (for badges, dots, etc.) */
  --color-status-success: #22c55e;   /* green - for online status */
  --color-status-warning: #f59e0b;   /* amber - for warnings */
  --color-status-error: #ef4444;     /* red - for errors */
  --color-status-neutral: #9ca3af;   /* gray - for offline/not-found */

  /* Font families */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "Roboto Mono", Consolas, monospace;

  /* Border radius */
  --radius: 0.5rem;
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}

@layer base {
  * {
    @apply border-border;
  }

  html,
  body {
    @apply h-full;
  }

  body {
    @apply bg-background text-foreground font-sans;
  }

  #root {
    @apply h-full;
  }
}
```

**Key Benefits of Tailwind v4's `@theme`:**
- ✅ **Native CSS** - No JavaScript config needed for theme
- ✅ **Simple syntax** - Direct hex values instead of HSL tuples
- ✅ **Auto-generated utilities** - Tailwind creates `bg-*`, `text-*`, `border-*` classes automatically
- ✅ **Better DX** - Theme tokens visible in CSS file alongside styles

### Why Hex Format?

The project uses direct hex color values for simplicity and readability:

✅ **Designer-friendly** - Matches Figma exports exactly
✅ **Simpler syntax** - No need to convert colors to HSL tuples
✅ **Direct values** - What you see is what you get
✅ **Tailwind v4 compatible** - Auto-generates utilities from hex values

For opacity manipulation, Tailwind provides utilities like `bg-primary/50` (50% opacity).

### Method Badge Color Mapping

```typescript
// packages/web/src/lib/badge-color.ts
export function getMethodBadgeColor(method: string): string {
  // Tools methods → info (purple)
  if (method.startsWith('tools/')) {
    return 'bg-badge-info'
  }

  // Resources methods → warning (yellow)
  if (method.startsWith('resources/')) {
    return 'bg-badge-warning'
  }

  // Notifications methods → warning (yellow)
  if (method.startsWith('notifications/')) {
    return 'bg-badge-warning'
  }

  // Initialize → success (green)
  if (method === 'initialize') {
    return 'bg-badge-success'
  }

  // Default → info
  return 'bg-badge-info'
}

// Usage
<span className={`${getMethodBadgeColor(log.method)} px-1.5 py-1 rounded-md text-sm font-mono`}>
  {log.method}
</span>
```

---

## Development Workflow

### Setting Up

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Start development servers:**

   **API Development:**
   ```bash
   bun run --filter @fiberplane/mcp-gateway-api dev
   ```
   API runs on http://localhost:3000

   **Web UI Development:**
   ```bash
   bun run --filter @fiberplane/mcp-gateway-web dev
   ```
   Vite dev server on http://localhost:5173 (proxies API requests to :3000)

   **Integrated Testing:**
   ```bash
   bun run dev
   ```
   CLI + API + Web UI all running together

### Data Fetching Pattern

```typescript
// TanStack Query for server state
const { data, isLoading } = useQuery({
  queryKey: ['logs', filters],
  queryFn: () => api.getLogs(filters),
  refetchInterval: 1000, // Poll every second
  refetchIntervalInBackground: false,
})
```

### Styling Approach

**Utility-First with Tailwind:**

```tsx
// Button with design tokens
<button className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm hover:opacity-90">
  Export
</button>

// Method badge with Tailwind v4 auto-generated utilities
<span className="bg-method-tool text-foreground px-1.5 py-1 rounded-md text-sm font-mono">
  tools/call
</span>

// Status indicator with opacity
<div className="bg-status-success/20 border border-status-success rounded-full">
  <div className="w-2 h-2 bg-status-success rounded-full" />
</div>
```

### Hot Reload

- Vite HMR for instant updates
- TanStack Query devtools for debugging
- Tailwind JIT for fast styling

### Type Safety

- TypeScript across the stack
- Zod for API validation
- Typed query hooks

---

## Component Development

### Component Composition

```tsx
// Radix Select (customizable)
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

<Select value={serverName} onValueChange={setServerName}>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="All servers" />
  </SelectTrigger>
  <SelectContent>
    {servers.map(server => (
      <SelectItem key={server.name} value={server.name}>
        {server.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Usage Examples

**Button Component:**
```tsx
<button className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm">
  Export
</button>
```

**Method Badge (using method category colors):**
```tsx
<span className="bg-method-tool text-foreground px-1.5 py-1 rounded-md text-sm font-mono">
  tools/call
</span>
```

**Status Indicator:**
```tsx
<div className="flex items-center gap-2">
  <div className="w-2 h-2 rounded-full bg-status-success" />
  <span className="text-sm text-status-success">Online</span>
</div>
```

**Table Row:**
```tsx
<tr className="hover:bg-muted border-b border-border">
  <td className="px-4 py-2 text-sm text-foreground">16:00:44</td>
  <td className="px-4 py-2 text-sm text-muted-foreground">6d3fFeB8</td>
</tr>
```

---

## Performance Considerations

### Bundle Size

- **Vite code splitting** - Automatic route-based splitting
- **Tree shaking** - Unused Tailwind classes purged
- **Radix advantage** - Only components we use, no full library

### Runtime Performance

- **TanStack Query caching** - Avoids unnecessary refetches
- **Polling optimization** - Stops when tab hidden
- **Virtual scrolling** - Deferred to post-MVP (if needed)

### Build & Distribution

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

### Optimization Strategies

1. Performance acceptable with 1000+ logs
2. Client-side filtering for instant response
3. URL-based state management
4. Efficient re-renders with React Query

### Future Enhancements

**Post-MVP:**
- Dark mode (design tokens ready!)
- Advanced filters (time range, duration slider)
- Full-text search in JSON
- Stats dashboard
- Multiple export formats (CSV, JSON)

**Scalability:**
- Virtual scrolling for 1000+ logs
- Infinite query for pagination
- WebSocket updates (replace polling)
- Service worker for offline support

---

## Testing Strategy

1. **API Tests:** Integration tests for endpoints
2. **Web UI Tests:** Component tests with Vitest + React Testing Library
3. **E2E Tests:** Playwright for critical user flows
4. **Manual QA:** Test with real MCP servers

## Success Metrics

**Functional:**
- Can view all captured logs
- Filters work correctly
- Performance acceptable with 1000+ logs
- Detail view shows complete request/response

**Developer Experience:**
- Hot reload works in dev mode
- Type safety across API boundary
- Easy to add new filters/features

**User Experience:**
- Loads within 2 seconds
- Intuitive navigation and filtering
- Responsive design

---

## Security Considerations

**Local Development:**
- API runs on localhost only
- CORS enabled for local dev (http://localhost:5173)
- No authentication required (local machine only)

**Future Production:**
- If deployed remotely, add authentication
- Consider read-only mode
- Add rate limiting

---

## CLI Integration

The CLI package optionally starts the API server:

```bash
mcp-gateway                  # Start with web UI on http://localhost:3333/ui
mcp-gateway --port 8080      # Custom port
```

When started:
1. CLI starts the API server from `@fiberplane/mcp-gateway-api`
2. API serves static web UI assets at `/ui`
3. CLI logs the web UI URL
4. User can access logs via browser while CLI continues proxying

---

## Additional Resources

- [Main README](../../README.md) - User guide
- [API Specification](../api/API_SPECIFICATION.md) - REST endpoints
- [Architecture Overview](../architecture/overview.md) - System design
- [Figma Design](https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground)
