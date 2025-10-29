# MCP Gateway Web UI Technical Specification

## Overview

Single-page React application for viewing and analyzing MCP Gateway traffic logs. Built with modern React patterns and TanStack ecosystem for optimal performance and developer experience.

## Technology Stack

### Core
- **React 19** - UI framework with modern concurrent features
- **TypeScript 5.3+** - Type safety
- **Vite 5+** - Build tool and dev server

### Routing
- **TanStack Router** - Type-safe routing with built-in search params
  - File-based routing
  - Type-safe navigation
  - Nested layouts
  - Route-level code splitting

### Data Fetching
- **TanStack Query (React Query v5)** - Server state management
  - Automatic caching and background refetching
  - Optimistic updates
  - Infinite scroll support
  - Request deduplication

### State Management
- **URL Parameters** - Filter state persistence
  - Filter state stored in URL search params
  - Type-safe parsing with Zod schemas
  - Shareable links with active filters
  - No client-side state management library needed

### Styling
- **Tailwind CSS 3+** - Utility-first CSS
- **Radix UI** - Accessible component primitives
  - DropdownMenu, Checkbox, Tabs, etc.
  - Full keyboard navigation
  - ARIA compliant

### Additional Libraries
- **date-fns** - Date formatting and manipulation
- **zod** - Runtime validation (shared with types package)
- **lucide-react** - Icon library

## Project Structure

```
packages/web/
├── src/
│   ├── routes/              # TanStack Router routes
│   │   ├── __root.tsx       # Root layout
│   │   ├── index.tsx        # Home page (redirects to /logs)
│   │   └── logs/
│   │       ├── index.tsx    # Log list page
│   │       └── $logId.tsx   # Log detail page
│   ├── components/          # React components
│   │   ├── ui/             # Radix UI wrapper components
│   │   │   ├── button.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── checkbox.tsx
│   │   │   └── tabs.tsx
│   │   ├── filter-bar.tsx          # Filter UI container
│   │   ├── add-filter-dropdown.tsx # Dropdown menu for adding filters
│   │   ├── filter-type-menu.tsx    # Cascading menu with filter types
│   │   ├── filter-value-submenu.tsx # Multi-select submenu
│   │   ├── filter-badge.tsx        # Active filter badge
│   │   ├── search-input.tsx        # Global search input
│   │   ├── log-table.tsx           # Log table component
│   │   └── log-row.tsx             # Individual log row
│   ├── hooks/              # Custom React hooks
│   │   ├── use-logs.ts     # TanStack Query hook for logs
│   │   └── use-available-filters.ts # Query hooks for filter values
│   ├── lib/                # Utility functions
│   │   ├── api.ts          # API client
│   │   ├── queryClient.ts  # TanStack Query config
│   │   └── utils.ts        # Helpers
│   ├── types/              # TypeScript types
│   │   └── api.ts          # API response types
│   ├── App.tsx             # Root component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
├── public/                 # Static assets
├── index.html              # HTML template
├── vite.config.ts          # Vite configuration
├── tailwind.config.ts      # Tailwind configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Package configuration
```

## Key Components

### 1. Root Layout (`routes/__root.tsx`)

Provides global layout structure:

```typescript
export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
```

**Features:**
- Top navigation bar with logo
- Global error boundary
- Loading state
- Toast notifications

### 2. Top Bar Component

```typescript
function TopBar() {
  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex items-center gap-3">
        <Logo />
        <h1>MCP Gateway Logs</h1>
      </div>
      <div className="flex items-center gap-4">
        <ExportButton />
        <Avatar />
      </div>
    </header>
  );
}
```

### 3. Log List Page (`routes/logs/index.tsx`)

Main page showing filterable log table:

```typescript
export const Route = createFileRoute('/logs/')({
  component: LogListPage,
  validateSearch: (search) => logSearchSchema.parse(search),
});

function LogListPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();

  // TanStack Query for data fetching
  const { data, isLoading, error } = useLogs();

  // Parse filters from URL
  const filters = parseFiltersFromUrl(search);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Filter bar with search, badges, and dropdown */}
      <FilterBar
        filters={filters}
        onFiltersChange={(newFilters) => {
          const params = serializeFiltersToUrl(newFilters);
          navigate({ search: params });
        }}
      />

      {/* Main table */}
      <LogTable
        logs={data}
        isLoading={isLoading}
        onRowClick={(log) => navigate({ to: '/logs/$logId', params: { logId: log.id } })}
      />
    </div>
  );
}
```

### 4. Filter Bar Component

Container for filter UI elements:

```typescript
function FilterBar({ filters, onFiltersChange }) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleAddFilter = (type: string, values: string[]) => {
    const newFilter = createFilter(type, values);
    onFiltersChange([...filters, newFilter]);
  };

  const handleRemoveFilter = (filterId: string) => {
    onFiltersChange(filters.filter(f => f.id !== filterId));
  };

  return (
    <div className="flex items-center gap-4 border-b px-6 py-4">
      {/* Search input */}
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search logs..."
      />

      {/* Add filter dropdown */}
      <AddFilterDropdown onAdd={handleAddFilter} activeFilters={filters} />

      {/* Active filter badges */}
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <FilterBadge
            key={filter.id}
            filter={filter}
            onRemove={handleRemoveFilter}
          />
        ))}
      </div>

      {/* Clear all button */}
      {filters.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFiltersChange([])}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
```

### 5. Add Filter Dropdown Component

Cascading dropdown menu with filter type submenus:

```typescript
function AddFilterDropdown({ onAdd, activeFilters }) {
  const [open, setOpen] = useState(false);

  // Fetch available filter values
  const methodsQuery = useAvailableMethods({ enabled: open });
  const clientsQuery = useAvailableClients({ enabled: open });
  const serversQuery = useAvailableServers({ enabled: open });

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Add filter
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          {/* Method submenu */}
          <FilterValueSubmenu
            label="Method"
            values={methodsQuery.data?.methods ?? []}
            selectedValues={activeFilters.method ?? []}
            onSelectionChange={(values) => onAdd('method', values)}
            showColorBadges={true}
          />

          {/* Client, Server, Session submenus... */}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

### 6. Filter Badge Component

Displays active filters with truncation:

```typescript
function FilterBadge({ filter, onRemove }) {
  // Format value with truncation for arrays
  const displayValue = Array.isArray(filter.value)
    ? filter.value.length > 2
      ? `${filter.value.slice(0, 2).join(', ')} +${filter.value.length - 2} more`
      : filter.value.join(', ')
    : filter.value;

  return (
    <div className="inline-flex items-center gap-2 px-2 h-9 border rounded-md">
      <FilterIcon field={filter.field} />
      <span className="text-sm font-medium">{filter.field}</span>
      <span className="text-sm">{filter.operator}</span>

      {/* Method filters show colored pills */}
      {filter.field === 'method' ? (
        <ColorPill color={getMethodColor(filter.value)}>
          {displayValue}
        </ColorPill>
      ) : (
        <span className="text-sm font-mono">{displayValue}</span>
      )}

      <IconButton
        variant="ghost"
        size="icon-sm"
        icon={X}
        onClick={() => onRemove(filter.id)}
        aria-label={`Remove ${filter.field} filter`}
      />
    </div>
  );
}
```

### 7. Log Table Component

Standard table with sortable columns:

```typescript
function LogTable({ logs, isLoading, onRowClick }) {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Session</th>
            <th>Method</th>
            <th>Server</th>
            <th>Duration</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {logs?.map((log) => (
            <LogRow
              key={log.id}
              log={log}
              onClick={() => onRowClick(log)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 8. Log Detail View (`routes/logs/$logId.tsx`)

Modal or page showing full request/response details:

```typescript
export const Route = createFileRoute('/logs/$logId')({
  component: LogDetailPage,
});

function LogDetailPage() {
  const { logId } = Route.useParams();
  const { data: log, isLoading } = useLog(logId);
  const navigate = useNavigate();

  if (isLoading) return <Spinner />;
  if (!log) return <NotFound />;

  return (
    <Dialog open onOpenChange={() => navigate({ to: '/logs' })}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Log Entry Details</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <LogMetadata log={log} />
          </TabsContent>

          <TabsContent value="request">
            <JsonViewer data={log.request} />
            <CopyButton data={log.request} />
          </TabsContent>

          <TabsContent value="response">
            <JsonViewer data={log.response} />
            <CopyButton data={log.response} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
```

## Filter Utilities

### URL State Management

```typescript
// packages/web/src/lib/filter-utils.ts

/**
 * Parses filters from URL search parameters
 */
export function parseFiltersFromUrl(search: URLSearchParams): Filter[] {
  const filters: Filter[] = [];

  for (const [key, value] of search.entries()) {
    if (FILTER_FIELDS.includes(key)) {
      // Parse comma-separated values for multi-value filters
      const values = value.split(',').map(v => v.trim());

      filters.push({
        id: generateId(),
        field: key as FilterField,
        operator: MULTI_VALUE_FIELDS.includes(key) ? 'is' : 'eq',
        value: values.length === 1 ? values[0] : values,
      });
    }
  }

  return filters;
}

/**
 * Serializes filters to URL search parameters
 */
export function serializeFiltersToUrl(filters: Filter[]): Record<string, string> {
  const params: Record<string, string> = {};

  for (const filter of filters) {
    const value = Array.isArray(filter.value)
      ? filter.value.join(',')
      : String(filter.value);

    params[filter.field] = value;
  }

  return params;
}

/**
 * Checks if log entry matches filter criteria
 */
export function matchesFilter(log: LogEntry, filter: Filter): boolean {
  const logValue = log[filter.field];

  if (filter.operator === 'is' || filter.operator === 'contains') {
    // Multi-value filters (OR logic)
    const filterValues = Array.isArray(filter.value) ? filter.value : [filter.value];
    return filterValues.some(fv => String(logValue).includes(String(fv)));
  }

  // Comparison operators for numeric fields
  if (typeof logValue === 'number' && typeof filter.value === 'number') {
    switch (filter.operator) {
      case 'eq': return logValue === filter.value;
      case 'gt': return logValue > filter.value;
      case 'lt': return logValue < filter.value;
      case 'gte': return logValue >= filter.value;
      case 'lte': return logValue <= filter.value;
    }
  }

  return false;
}
```

## TanStack Query Hooks

### useLogs Hook

```typescript
export function useLogs() {
  return useQuery({
    queryKey: ['logs'],
    queryFn: () => apiClient.getLogs(),
    staleTime: 30_000, // 30 seconds
    refetchInterval: 5_000, // Poll every 5 seconds
    refetchOnWindowFocus: true,
  });
}
```

### useAvailable* Hooks

Query hooks for fetching available filter values:

```typescript
export function useAvailableMethods(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['available-filters', 'methods'],
    queryFn: () => apiClient.getAvailableMethods(),
    staleTime: 60_000, // 1 minute
    enabled: options?.enabled ?? true,
  });
}

export function useAvailableClients(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['available-filters', 'clients'],
    queryFn: () => apiClient.getAvailableClients(),
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useAvailableServers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['available-filters', 'servers'],
    queryFn: () => apiClient.getAvailableServers(),
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useAvailableSessions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['available-filters', 'sessions'],
    queryFn: () => apiClient.getAvailableSessions(),
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}
```

## API Client

```typescript
class APIClient {
  private baseURL = 'http://localhost:3000/api';

  async getLogs(params: LogQueryParams): Promise<PaginatedResponse<LogEntry>> {
    const url = new URL(`${this.baseURL}/logs`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Failed to fetch logs');
    return response.json();
  }

  async getLog(logId: string): Promise<LogEntry> {
    const response = await fetch(`${this.baseURL}/logs/${logId}`);
    if (!response.ok) throw new Error('Failed to fetch log');
    return response.json();
  }

  async getServers(): Promise<ServersResponse> {
    const response = await fetch(`${this.baseURL}/servers`);
    if (!response.ok) throw new Error('Failed to fetch servers');
    return response.json();
  }

  async getSessions(serverName?: string): Promise<SessionsResponse> {
    const url = new URL(`${this.baseURL}/sessions`);
    if (serverName) url.searchParams.append('serverName', serverName);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Failed to fetch sessions');
    return response.json();
  }

  async exportLogs(params: LogQueryParams & { format: 'json' | 'jsonl' | 'csv' }): Promise<Blob> {
    const url = new URL(`${this.baseURL}/logs/export`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Failed to export logs');
    return response.blob();
  }
}

export const apiClient = new APIClient();
```

## Responsive Design

**Breakpoints:**
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

**Mobile Adaptations:**
- Stack table columns vertically on small screens
- Drawer-style filter sidebar on mobile
- Touch-friendly tap targets (min 44x44px)
- Simplified header on mobile

## Accessibility

- Semantic HTML elements
- ARIA labels and roles
- Keyboard navigation support
- Focus management (modals, dropdowns)
- Screen reader announcements for dynamic content
- High contrast mode support
- Reduced motion support

## Performance Optimizations

1. **Code Splitting:** Route-based code splitting with TanStack Router
2. **Deferred Values:** React 19's `useDeferredValue` for search input debouncing
3. **Query Caching:** TanStack Query caches API responses to reduce network requests
4. **Conditional Fetching:** Filter value queries only run when dropdown is open (`enabled` option)
5. **Client-Side Filtering:** Filters applied in browser for instant response
6. **Memoization:** React.memo, useMemo, useCallback where appropriate
7. **Lazy Loading:** Lazy load heavy components (JSON viewer)
8. **Bundle Size:** Tree-shaking, no unnecessary dependencies

## Testing Strategy

1. **Unit Tests:** Vitest for utilities and hooks
2. **Component Tests:** Vitest + React Testing Library
3. **Integration Tests:** Test user flows with TanStack Router
4. **E2E Tests:** Playwright for critical paths
5. **Visual Regression:** Chromatic or Percy

## Build Configuration

**Vite Config:**

```typescript
export default defineConfig({
  plugins: [react(), TanStackRouterVite()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'tanstack-vendor': ['@tanstack/react-router', '@tanstack/react-query'],
        },
      },
    },
  },
});
```

## Environment Variables

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3000/api

# .env.production
VITE_API_BASE_URL=/api
```

## Development Workflow

1. Start API server: `bun run --filter @fiberplane/mcp-gateway-api dev`
2. Start web dev server: `bun run --filter @fiberplane/mcp-gateway-web dev`
3. Open browser: `http://localhost:5173`
4. Changes hot reload automatically
5. API requests proxied to `:3000`

## Production Build

```bash
bun run --filter @fiberplane/mcp-gateway-web build
```

Output in `packages/web/dist/`:
- Optimized JS bundles
- CSS with Tailwind purged
- Static assets
- index.html
