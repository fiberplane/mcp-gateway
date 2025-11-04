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

The design system uses **semantic CSS variables** with fallback values, following the pattern: `var(--category/name, fallback)`.

**Figma Design:** [MCP Gateway Playground](https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground)

### Token Strategy

- **Extracted from Figma** - Semantic tokens like `--bg/primary`, `--spacing/md`
- **HSL format** - Easier theming and opacity manipulation
- **Intent-based badges** - `info`, `success`, `warning`, `error` (not raw colors)

### Fonts

- **UI Text:** Inter (Google Fonts)
- **Code/Monospace:** Roboto Mono (Google Fonts)

### Quick Reference: Tailwind Class Names

**Common Pattern:** Tailwind uses `bg-{color}`, `text-{color}`, `border-{color}` prefixes

| CSS Variable | Tailwind Classes | Usage |
|--------------|------------------|-------|
| `--primary` | `bg-primary` `text-primary` | Primary backgrounds/text |
| `--primary-foreground` | `text-primary-foreground` | Text on primary bg |
| `--card` | `bg-card` | Card backgrounds |
| `--muted` | `bg-muted` `text-muted` | Muted backgrounds/text |
| `--muted-foreground` | `text-muted-foreground` | Muted text color |
| `--badge-info` | `bg-badge-info` | Info badge (purple) |
| `--badge-success` | `bg-badge-success` | Success badge (green) |
| `--badge-warning` | `bg-badge-warning` | Warning badge (yellow) |
| `--badge-error` | `bg-badge-error` | Error badge (red) |
| `--border` | `border-border` | Border color |

**Example:**
```tsx
✅ Correct:  <button className="bg-primary text-primary-foreground">
❌ Wrong:    <button className="bg-bg-primary text-fg-on-primary">
```

### Color Tokens

#### Background Colors

| Figma Token | Fallback Value | Usage | Semantic Name |
|-------------|----------------|-------|---------------|
| `--bg/primary` | `#272624` | Primary button, selected tabs | `bg-primary` |
| N/A | `#dddbff` | Purple method badges (tools/call) | `bg-badge-purple` |
| N/A | `#fef3c7` | Yellow method badges (notifications) | `bg-badge-yellow` |
| N/A | `#fee2e2` | Red method badges (errors) | `bg-badge-red` |
| N/A | `#dcfce7` | Green method badges (initialize) | `bg-badge-green` |
| N/A | `#ffffff` | Card/container backgrounds | `bg-card` |
| N/A | `#f9fafb` | Table row hover | `bg-muted` |

#### Foreground Colors

| Figma Token | Fallback Value | Usage | Semantic Name |
|-------------|----------------|-------|---------------|
| `--fg/on-primary` | `#ffffff` | Text on dark backgrounds | `fg-on-primary` |
| N/A | `#000000` | Body text, table text | `fg-primary` |
| N/A | `#6b7280` | Muted text, timestamps | `fg-muted` |
| N/A | `#111827` | Headers, emphasized text | `fg-emphasis` |

### Tailwind Configuration

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Background colors
        primary: 'hsl(var(--primary))',
        card: 'hsl(var(--card))',
        muted: 'hsl(var(--muted))',

        // Badge colors (intent-based)
        'badge-info': 'hsl(var(--badge-info))',
        'badge-success': 'hsl(var(--badge-success))',
        'badge-warning': 'hsl(var(--badge-warning))',
        'badge-error': 'hsl(var(--badge-error))',

        // Foreground colors
        foreground: 'hsl(var(--foreground))',
        'muted-foreground': 'hsl(var(--muted-foreground))',

        // Border colors
        border: 'hsl(var(--border))',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        'xs': '12px',
        'sm': '14px',
        'base': '16px',
        '2xl': '24px',
      },
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
      },
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '6px',
        'md': '6px',
        'lg': '8px',
      },
    },
  },
  plugins: [],
} satisfies Config
```

### CSS Variables Definition

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Background colors (HSL format for better manipulation) */
    --background: 0 0% 100%;        /* #ffffff - page background */
    --card: 0 0% 100%;              /* #ffffff - card background */
    --muted: 210 20% 98%;           /* #f9fafb - muted background */
    --primary: 30 4% 15%;           /* #272624 - primary background */

    /* Badge colors (intent-based) */
    --badge-info: 245 100% 93%;     /* #dddbff - purple */
    --badge-success: 138 76% 93%;   /* #dcfce7 - green */
    --badge-warning: 48 96% 89%;    /* #fef3c7 - yellow */
    --badge-error: 0 93% 94%;       /* #fee2e2 - red */

    /* Foreground colors */
    --foreground: 0 0% 0%;          /* #000000 - primary text */
    --primary-foreground: 0 0% 100%; /* #ffffff - text on primary */
    --muted-foreground: 220 9% 46%; /* #6b7280 - muted text */

    /* Border colors */
    --border: 214 32% 91%;          /* #e5e7eb */
  }

  /* Dark mode (future) */
  .dark {
    --background: 222 47% 11%;
    --card: 222 47% 11%;
    --primary: 0 0% 100%;
    --foreground: 0 0% 100%;
    --primary-foreground: 0 0% 0%;
    /* ... more dark mode tokens */
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground font-sans;
  }
}
```

### Why HSL Format?

Using HSL (Hue, Saturation, Lightness) instead of hex colors:

✅ **Easier to manipulate** - Change opacity: `hsl(var(--primary) / 0.5)`
✅ **Better for theming** - Adjust lightness for dark mode
✅ **Math-friendly** - Can calculate complementary colors
✅ **Tailwind compatible** - Works seamlessly with Tailwind utilities

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
<button className="bg-bg-primary text-fg-on-primary px-3 py-2 rounded-md text-sm hover:opacity-90">
  Export
</button>

// Method badge with utility
<span className={cn(
  'px-1.5 py-1 rounded-md text-sm font-mono',
  getMethodBadgeColor(log.method)
)}>
  {log.method}
</span>
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

**Method Badge:**
```tsx
<span className="bg-badge-info text-foreground px-1.5 py-1 rounded-md text-sm font-mono">
  tools/call
</span>
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
