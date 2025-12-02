# Web UI Development Guide

React-based web UI for viewing MCP Gateway logs. Built with React 19, TanStack Router/Query, and Tailwind v4.

## Quick Start

```bash
# Install dependencies
bun install

# Start dev server (Vite with HMR)
bun run --filter @fiberplane/mcp-gateway-web dev  # http://localhost:5173

# Build for production
bun run --filter @fiberplane/mcp-gateway-web build
```

## Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool with HMR
- **Tailwind v4** - Styling with `@theme` directive
- **Radix UI** - Accessible component primitives
- **TanStack Router** - Type-safe routing
- **TanStack Query** - Server state, caching, polling

## Architecture

```
Browser (React SPA)
  ↓ HTTP/REST
API Server (Hono)
  ↓
Core (SQLite queries)
  ↓
logs.db (~/.mcp-gateway/)
```

**Key Features:**
- URL-based filter state (shareable links)
- Client-side filtering for instant response
- Real-time polling with TanStack Query
- Advanced filtering (search, operators, numeric ranges)
- JSON log viewer with copy/export
- Server management interface

---

## Pages

The web UI uses TanStack Router for page-based navigation:

### Home Page (`/`)

Main logs view with:
- Server tabs for quick filtering
- Advanced filter bar (search, server, session, client, method, duration, tokens)
- Real-time log table with polling
- Log detail viewer with JSON syntax highlighting
- Export functionality

### Marketplace Page (`/marketplace`)

Curated list of popular MCP servers:
- Pre-configured server entries (Linear, Notion, GitHub, Figma, etc.)
- Search functionality
- Server cards show: icon, description, tool count, documentation link
- "Add to Gateway" button pre-fills server configuration
- Detection of already-added servers

**Data source:** `packages/web/src/lib/marketplace-data.ts` (hardcoded list)

### Servers Page (`/servers`)

Server management overview:
- List all configured servers
- Server type badges (HTTP/stdio)
- Status indicators
- Quick actions (view details, edit, delete)
- Add server button

### Server Details Page (`/servers/:serverName`)

Individual server management:
- Gateway URL with copy button
- Configuration details (type, URL/command, session mode for stdio)
- **Health information** (HTTP servers):
  - Last check time, response time, status history
  - Manual health check button
- **Process status** (stdio servers):
  - Running/crashed/stopped state, PID
  - Restart button (shared mode only)
  - Error messages and stderr logs
- Danger zone (delete server)

---

## Design Tokens (For Agentic Use)

All tokens defined in `packages/web/src/index.css` using Tailwind v4's `@theme` directive.

### Tailwind Class Reference

Tailwind v4 auto-generates utilities from `--color-*` variables. Use these classes:

| CSS Variable | Tailwind Classes | Usage |
|--------------|------------------|-------|
| `--color-primary` | `bg-primary` `text-primary` | Primary backgrounds/text |
| `--color-primary-foreground` | `text-primary-foreground` | Text on primary bg |
| `--color-background` | `bg-background` | Page background (#f5f6f7) |
| `--color-card` | `bg-card` | Card backgrounds (#ffffff) |
| `--color-muted` | `bg-muted` | Muted backgrounds (#f9fafb) |
| `--color-muted-foreground` | `text-muted-foreground` | Muted text (#6b7280) |
| `--color-foreground` | `text-foreground` | Body text (#000000) |
| `--color-border` | `border-border` | Borders (#e5e7eb) |
| `--color-input` | `border-input` | Input borders (#e5e7eb) |
| `--color-ring` | `ring-ring` | Focus rings (#1e293b) |

### Badge Colors (Intent-based)

| CSS Variable | Hex Value | Tailwind Class | Usage |
|--------------|-----------|----------------|-------|
| `--color-badge-info` | `#dddbff` | `bg-badge-info` | Info badges (purple) |
| `--color-badge-success` | `#dcfce7` | `bg-badge-success` | Success badges (green) |
| `--color-badge-warning` | `#fef3c7` | `bg-badge-warning` | Warning badges (yellow) |
| `--color-badge-error` | `#fee2e2` | `bg-badge-error` | Error badges (red) |

### Method Category Colors

For ColorPill components in filters and logs:

| CSS Variable | Hex Value | Tailwind Class | Usage |
|--------------|-----------|----------------|-------|
| `--color-method-init` | `#dddbff` | `bg-method-init` | Initialize, ping |
| `--color-method-resource` | `#ffe6e0` | `bg-method-resource` | resources/* |
| `--color-method-tool` | `#f7dd91` | `bg-method-tool` | tools/* |
| `--color-method-prompt` | `#d1eaac` | `bg-method-prompt` | prompts/* |
| `--color-method-notification` | `#f8d2e8` | `bg-method-notification` | notifications/* |
| `--color-method-default` | `#e5e7eb` | `bg-method-default` | Unknown methods |

### Status Indicator Colors

For online/offline/error status:

| CSS Variable | Hex Value | Tailwind Class | Usage |
|--------------|-----------|----------------|-------|
| `--color-status-success` | `#22c55e` | `bg-status-success` `text-status-success` | Online (green) |
| `--color-status-warning` | `#f59e0b` | `bg-status-warning` `text-status-warning` | Warning (amber) |
| `--color-status-error` | `#ef4444` | `bg-status-error` `text-status-error` | Error (red) |
| `--color-status-neutral` | `#9ca3af` | `bg-status-neutral` `text-status-neutral` | Offline (gray) |

### Terminal/Console Colors

For terminal output mockups and code examples:

| CSS Variable | Hex Value | Tailwind Class | Usage |
|--------------|-----------|----------------|-------|
| `--color-terminal-bg` | `#1a1817` | `bg-terminal-bg` | Terminal background (dark) |
| `--color-terminal-text` | `#e5e7eb` | `text-terminal-text` | Terminal text (light gray) |

### Shadow Colors

| CSS Variable | Value | Usage |
|--------------|-------|-------|
| `--color-shadow-subtle` | `rgba(0, 0, 0, 0.05)` | Subtle inner shadows for grouping |

### Code Examples

```tsx
// Button
<button className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm hover:opacity-90">
  Export
</button>

// Method badge
<span className="bg-method-tool text-foreground px-1.5 py-1 rounded-md text-sm font-mono">
  tools/call
</span>

// Status indicator
<div className="flex items-center gap-2">
  <div className="w-2 h-2 rounded-full bg-status-success" />
  <span className="text-sm text-status-success">Online</span>
</div>

// Table row
<tr className="hover:bg-muted border-b border-border">
  <td className="px-4 py-2 text-sm text-foreground">16:00:44</td>
  <td className="px-4 py-2 text-sm text-muted-foreground">6d3fFeB8</td>
</tr>

// Opacity modifier
<div className="bg-status-success/20 border border-status-success rounded-full">
  <div className="w-2 h-2 bg-status-success rounded-full" />
</div>
```

### Full Token Definition

Location: `packages/web/src/index.css`

```css
@import "tailwindcss";

@theme {
  /* Background */
  --color-background: #f5f6f7;
  --color-card: #ffffff;
  --color-muted: #f9fafb;
  --color-primary: #272624;

  /* Badge colors */
  --color-badge-info: #dddbff;
  --color-badge-success: #dcfce7;
  --color-badge-warning: #fef3c7;
  --color-badge-error: #fee2e2;

  /* Method categories */
  --color-method-init: #dddbff;
  --color-method-resource: #ffe6e0;
  --color-method-tool: #f7dd91;
  --color-method-prompt: #d1eaac;
  --color-method-notification: #f8d2e8;
  --color-method-default: #e5e7eb;

  /* Status indicators */
  --color-status-success: #22c55e;
  --color-status-warning: #f59e0b;
  --color-status-error: #ef4444;
  --color-status-neutral: #9ca3af;

  /* Foreground */
  --color-foreground: #000000;
  --color-primary-foreground: #ffffff;
  --color-muted-foreground: #6b7280;

  /* Borders */
  --color-border: #e5e7eb;
  --color-input: #e5e7eb;
  --color-ring: #1e293b;

  /* Fonts */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "Roboto Mono", Consolas, monospace;

  /* Border radius */
  --radius: 0.5rem;
}
```

---

## Component Patterns

### TanStack Query (Data Fetching)

```typescript
// Auto-refetches every 5 seconds
const { data, isLoading } = useQuery({
  queryKey: ['logs'],
  queryFn: () => apiClient.getLogs(),
  refetchInterval: 5_000,
  staleTime: 30_000,
})
```

### URL-based Filters

```typescript
// Filters stored in URL params: ?method=tools/call,prompts/get&server=figma
const filters = parseFiltersFromUrl(searchParams)

// Update URL on filter change
navigate({ search: serializeFiltersToUrl(newFilters) })
```

### Radix UI Components

```tsx
import { DropdownMenu } from '@radix-ui/react-dropdown-menu'

<DropdownMenu.Root>
  <DropdownMenu.Trigger>Add Filter</DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <DropdownMenu.Item onClick={onSelectMethod}>Method</DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
```

### Advanced Filters

The filter bar supports multiple filter types with powerful query capabilities:

**String Filters (with operators):**
- Server, session, client, method
- Operator prefixes: `is:` (exact), `contains:` (partial)
- Multi-select with OR logic
- Example: `?server=is:figma&server=is:notion`

**Numeric Filters:**
- Duration range (milliseconds): `durationGte`, `durationLte`
- Token range (total tokens): `tokensGt`, `tokensLt`
- Supports exact match, greater than, less than

**Full-Text Search:**
- Searches across request/response JSON content
- Multiple search terms use AND logic
- Example: `?q=error&q=timeout` (finds logs with both terms)

**Example filter state in URL:**
```
?method=contains:tools&server=is:figma-server&durationGte=1000&q=error
```

**Filter UI Components:**
- `FilterBar` - Container with filter badges and add button
- `AddFilterDropdown` - Dropdown for adding new filters
- Filter badges with remove buttons
- Server/session/client/method dropdowns with autocomplete

---

## Project Structure

```
packages/web/
├── src/
│   ├── components/
│   │   ├── ui/              # Radix UI wrappers
│   │   ├── filter-bar.tsx
│   │   ├── log-table.tsx
│   │   └── server-management.tsx
│   ├── lib/
│   │   ├── api.ts           # API client
│   │   ├── filter-utils.ts  # URL filter parsing
│   │   └── query-client.ts  # TanStack Query config
│   ├── routes/              # TanStack Router
│   └── index.css            # Design tokens
├── tailwind.config.ts       # Minimal (v4)
└── vite.config.ts
```

---

## API Integration

```typescript
class APIClient {
  async getLogs(): Promise<LogEntry[]> {
    const res = await fetch('/api/logs')
    return res.json()
  }

  async getServers(): Promise<Server[]> {
    const res = await fetch('/api/servers')
    return res.json()
  }
}
```

**Endpoints:**
- `GET /api/logs` - Query logs
- `GET /api/servers` - List servers
- `GET /api/sessions` - List sessions
- `POST /api/logs/clear` - Clear logs

---

## Development Tips

**Vite dev server proxies API:**
```typescript
// vite.config.ts
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
}
```

**Component hot reload:**
- Edit `.tsx` files → Instant HMR
- Edit `index.css` → Tailwind JIT rebuild

**Query devtools:**
```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools />
</QueryClientProvider>
```

---

## Resources

- [Figma Design](https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground)
- [API Specification](../api/API_SPECIFICATION.md)
- [Tailwind v4 Docs](https://tailwindcss.com/docs/v4-beta)
- [TanStack Query](https://tanstack.com/query/latest)
- [Radix UI](https://www.radix-ui.com/)
