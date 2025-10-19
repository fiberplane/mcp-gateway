# MCP Gateway Web UI Technical Specification

## Overview

Single-page React application for viewing and analyzing MCP Gateway traffic logs. Built with modern React patterns and TanStack ecosystem for optimal performance and developer experience.

## Technology Stack

### Core
- **React 18.3+** - UI library with concurrent features
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
- **Zustand** - Lightweight client state
  - UI state (sidebar open/closed, theme)
  - Filter state (active filters, sort order)
  - Selection state (selected log entries)

### Styling
- **Tailwind CSS 3+** - Utility-first CSS
- **Radix UI** or **Shadcn/ui** - Accessible component primitives
  - Dialog, Dropdown, Select, Checkbox, etc.
  - Full keyboard navigation
  - ARIA compliant

### Additional Libraries
- **TanStack Virtual** - Virtual scrolling for large lists
- **date-fns** - Date formatting and manipulation
- **zod** - Runtime validation (shared with API)
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
│   │   ├── ui/             # Shadcn/ui components
│   │   ├── layout/         # Layout components
│   │   ├── logs/           # Log-specific components
│   │   │   ├── LogTable.tsx
│   │   │   ├── LogFilters.tsx
│   │   │   ├── LogDetail.tsx
│   │   │   └── LogRow.tsx
│   │   └── common/         # Shared components
│   ├── hooks/              # Custom React hooks
│   │   ├── useLogs.ts      # TanStack Query hooks
│   │   ├── useServers.ts
│   │   └── useSessions.ts
│   ├── stores/             # Zustand stores
│   │   ├── filterStore.ts  # Filter state
│   │   └── uiStore.ts      # UI state
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
  const { data, isLoading, error } = useLogs(search);

  // Zustand for UI state
  const { isFilterOpen, toggleFilters } = useUIStore();

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Server tabs */}
      <ServerTabs />

      <div className="flex flex-1 flex-col">
        {/* Search and quick filters */}
        <LogSearchBar />

        {/* Applied filters */}
        <AppliedFilters />

        {/* Main table */}
        <LogTable
          logs={data?.data}
          isLoading={isLoading}
          onRowClick={(log) => navigate({ to: '/logs/$logId', params: { logId: log.id } })}
        />

        {/* Pagination */}
        <Pagination {...data?.pagination} />
      </div>

      {/* Filter sidebar */}
      {isFilterOpen && <LogFilters />}
    </div>
  );
}
```

### 4. Log Table Component

Virtualized table for performance with large datasets:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function LogTable({ logs, isLoading, onRowClick }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: logs?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // Row height in pixels
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <table className="w-full">
        <LogTableHeader />
        <tbody style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const log = logs[virtualRow.index];
            return (
              <LogRow
                key={virtualRow.key}
                log={log}
                onClick={() => onRowClick(log)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

**Columns:**
- Checkbox (for selection)
- Timestamp
- Session ID
- Method (with badge)
- Method Details
- Sender
- Receiver
- Duration
- Tokens

### 5. Log Filters Component

Sidebar with advanced filtering options:

```typescript
function LogFilters() {
  const { filters, updateFilters, resetFilters } = useFilterStore();
  const { data: servers } = useServers();
  const { data: sessions } = useSessions();

  return (
    <aside className="w-96 border-l bg-gray-50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3>Filters</h3>
        <Button variant="ghost" onClick={resetFilters}>Clear all</Button>
      </div>

      {/* Server filter */}
      <FilterSection title="Server">
        <CheckboxGroup
          options={servers}
          value={filters.serverNames}
          onChange={(value) => updateFilters({ serverNames: value })}
        />
      </FilterSection>

      {/* Session filter */}
      <FilterSection title="Session">
        <Select
          options={sessions}
          value={filters.sessionId}
          onChange={(value) => updateFilters({ sessionId: value })}
        />
      </FilterSection>

      {/* Method filter */}
      <FilterSection title="Method">
        <CheckboxGroup
          options={['initialize', 'tools/list', 'tools/call', 'resources/list']}
          value={filters.methods}
          onChange={(value) => updateFilters({ methods: value })}
        />
      </FilterSection>

      {/* Time range filter */}
      <FilterSection title="Time Range">
        <DateRangePicker
          from={filters.startTime}
          to={filters.endTime}
          onChange={(range) => updateFilters(range)}
        />
      </FilterSection>

      {/* Duration filter */}
      <FilterSection title="Duration">
        <RangeSlider
          min={0}
          max={5000}
          value={[filters.minDuration, filters.maxDuration]}
          onChange={([min, max]) => updateFilters({ minDuration: min, maxDuration: max })}
        />
      </FilterSection>

      {/* Error filter */}
      <FilterSection title="Status">
        <Checkbox
          checked={filters.hasError}
          onChange={(checked) => updateFilters({ hasError: checked })}
          label="Show only errors"
        />
      </FilterSection>
    </aside>
  );
}
```

### 6. Log Detail View (`routes/logs/$logId.tsx`)

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

### 7. Server Tabs Component

Quick filter by server:

```typescript
function ServerTabs() {
  const { data: servers } = useServers();
  const { filters, updateFilters } = useFilterStore();

  return (
    <Tabs value={filters.serverName ?? 'all'} onValueChange={(value) => {
      updateFilters({ serverName: value === 'all' ? undefined : value });
    }}>
      <TabsList>
        <TabsTrigger value="all">
          All servers
          <Badge>{servers?.total}</Badge>
        </TabsTrigger>
        {servers?.servers.map((server) => (
          <TabsTrigger key={server.name} value={server.name}>
            <ServerIndicator name={server.name} />
            {server.displayName}
            <Badge>{server.logCount}</Badge>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
```

## State Management

### Zustand Filter Store

```typescript
interface FilterState {
  // Filter values
  serverNames: string[];
  sessionId?: string;
  methods: string[];
  search?: string;
  hasError?: boolean;
  minDuration?: number;
  maxDuration?: number;
  startTime?: Date;
  endTime?: Date;

  // Sort
  sortBy: 'timestamp' | 'duration' | 'method' | 'server';
  sortOrder: 'asc' | 'desc';

  // Actions
  updateFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;

  // Computed
  activeFilterCount: number;
}

export const useFilterStore = create<FilterState>((set, get) => ({
  // Initial state
  serverNames: [],
  methods: [],
  sortBy: 'timestamp',
  sortOrder: 'desc',

  // Actions
  updateFilters: (filters) => set((state) => ({ ...state, ...filters })),
  resetFilters: () => set(getDefaultFilters()),

  // Computed
  get activeFilterCount() {
    const state = get();
    return [
      state.serverNames.length,
      state.sessionId ? 1 : 0,
      state.methods.length,
      state.search ? 1 : 0,
      // ... count other active filters
    ].reduce((a, b) => a + b, 0);
  },
}));
```

### Zustand UI Store

```typescript
interface UIState {
  isFilterOpen: boolean;
  theme: 'light' | 'dark';
  selectedLogs: Set<string>;

  toggleFilters: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleLogSelection: (logId: string) => void;
  clearSelection: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isFilterOpen: true,
  theme: 'light',
  selectedLogs: new Set(),

  toggleFilters: () => set((state) => ({ isFilterOpen: !state.isFilterOpen })),
  setTheme: (theme) => set({ theme }),
  toggleLogSelection: (logId) => set((state) => {
    const selectedLogs = new Set(state.selectedLogs);
    if (selectedLogs.has(logId)) {
      selectedLogs.delete(logId);
    } else {
      selectedLogs.add(logId);
    }
    return { selectedLogs };
  }),
  clearSelection: () => set({ selectedLogs: new Set() }),
}));
```

## TanStack Query Hooks

### useLogs Hook

```typescript
interface UseLogsOptions {
  page?: number;
  limit?: number;
  serverName?: string;
  sessionId?: string;
  method?: string;
  // ... other filters
}

export function useLogs(options: UseLogsOptions) {
  return useQuery({
    queryKey: ['logs', options],
    queryFn: () => apiClient.getLogs(options),
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: true,
    retry: 2,
  });
}
```

### useLog Hook (single log)

```typescript
export function useLog(logId: string) {
  return useQuery({
    queryKey: ['logs', logId],
    queryFn: () => apiClient.getLog(logId),
    staleTime: 5 * 60_000, // 5 minutes
    enabled: !!logId,
  });
}
```

### useServers Hook

```typescript
export function useServers() {
  return useQuery({
    queryKey: ['servers'],
    queryFn: () => apiClient.getServers(),
    staleTime: 60_000, // 1 minute
  });
}
```

### useSessions Hook

```typescript
export function useSessions(serverName?: string) {
  return useQuery({
    queryKey: ['sessions', serverName],
    queryFn: () => apiClient.getSessions(serverName),
    staleTime: 60_000, // 1 minute
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
2. **Virtual Scrolling:** TanStack Virtual for log table
3. **Memoization:** React.memo, useMemo, useCallback where appropriate
4. **Lazy Loading:** Lazy load heavy components (JSON viewer, charts)
5. **Image Optimization:** SVG icons, optimized PNGs
6. **Bundle Size:** Tree-shaking, no unnecessary dependencies

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
