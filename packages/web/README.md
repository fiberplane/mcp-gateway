# @fiberplane/mcp-gateway-web

React-based web UI for browsing and analyzing MCP Gateway logs.

## Key Features

- **Log Browsing** - View captured MCP traffic in sortable, filterable table
- **Advanced Filtering** - Filter by server, session, method, duration, tokens, and search content
- **Real-time Updates** - Automatically polls for new logs
- **Log Details** - Expand rows to view full request/response JSON
- **Export** - Export logs as JSON
- **Server Management** - Add, edit, and remove MCP servers via UI
- **Token Estimation** - Display approximate token costs for LLM operations

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool with HMR
- **TanStack Query** - Data fetching and caching
- **TanStack Router** - Type-safe routing
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible components

## Quick Start

```bash
# Start dev server (from monorepo root)
bun run --filter @fiberplane/mcp-gateway-web dev

# Dev server runs at http://localhost:5173
# Proxies API requests to http://localhost:3333/api
```

For full-stack development:

```bash
# Terminal 1: Start gateway (includes API)
bun run dev

# Terminal 2: Start web UI dev server
bun run --filter @fiberplane/mcp-gateway-web dev
```

## Building

```bash
# Build for production
bun run --filter @fiberplane/mcp-gateway-web build

# Creates optimized files in public/ directory
```

## Integration with CLI

The CLI serves the built web UI at `/ui`:

```bash
mcp-gateway
# Web UI available at: http://localhost:3333/ui
```

## Project Structure

```
packages/web/
├── src/
│   ├── components/         # React components
│   │   ├── log-table.tsx
│   │   ├── filter-bar.tsx
│   │   ├── server-management.tsx
│   │   └── ui/            # Radix UI components
│   ├── lib/               # API client and utilities
│   │   ├── api.ts
│   │   ├── filter-utils.ts
│   │   └── query-client.ts
│   ├── routes/            # TanStack Router routes
│   ├── App.tsx
│   └── main.tsx
└── vite.config.ts
```

## Architecture

### Authentication

Web UI uses token-based authentication with URL query parameter:

```
http://localhost:3333/ui?token=<your-token>
```

**Auth Components:**
- `AuthContext` - Provides token and auth error state to component tree
- `useAuth()` - Hook to access token and error state in components
- `NoTokenState` - Shown when no token in URL
- `InvalidTokenState` - Shown when token is invalid/expired

All API requests include `Authorization: Bearer <token>` header.

### API Client

Type-safe API client with dependency injection:

```typescript
// Interface defines public API
interface IApiClient {
  getLogs(params: {...}): Promise<{...}>;
  getServers(): Promise<{...}>;
  // ... other methods
}

// Factory creates client with token injection
createApiClient(getToken: () => string | null): IApiClient
```

**Context Pattern:**
- `ApiContext` - Provides `IApiClient` instance to component tree
- `useApi()` - Hook to access API client in components

Components never receive `api` as prop - they use `useApi()` hook internally.

### Domain Hooks

High-level hooks hide context complexity and provide clean interfaces:

```typescript
// Hooks internally use useApi() - no prop drilling
useServers()        // List servers with health info
useServerConfigs()  // Full configs (includes headers)
useHealthCheck()    // Trigger manual health check
useServerConfig(name)  // Get single server by name
useServerMap()      // Get server name → info map
```

Components call domain hooks directly without knowing about context.

## Testing

### Test Setup

Use `TestApiProvider` to provide mock API client:

```typescript
import { render } from "@testing-library/react";
import { TestApiProvider } from "@/test-utils/test-providers";

test("my component", () => {
  render(
    <TestApiProvider>
      <MyComponent />
    </TestApiProvider>
  );
});
```

### Mock API Client

```typescript
import { createMockApiClient } from "@/test-utils/mocks";

const mockApi = createMockApiClient();

// Override specific methods
mockApi.getServers.mockResolvedValue({
  servers: [{ name: "test", url: "http://localhost", ... }]
});
```

All mocks implement `IApiClient` interface for type safety.

## Development Patterns

### Adding New Hooks

1. Add method to `IApiClient` interface:
```typescript
// lib/api.ts
interface IApiClient {
  myNewMethod(): Promise<Data>;
}
```

2. Implement in `APIClient` class:
```typescript
class APIClient implements IApiClient {
  async myNewMethod(): Promise<Data> {
    const options = this.createAuthHeaders();
    const response = await fetch(`${this.baseURL}/my-endpoint`, options);
    return this.handleResponse<Data>(response);
  }
}
```

3. Create domain hook:
```typescript
// hooks/use-my-feature.ts
export function useMyFeature() {
  const api = useApi();
  return useQuery({
    queryKey: ["my-feature"],
    queryFn: () => api.myNewMethod()
  });
}
```

### Component Guidelines

- **✅ DO:** Use domain hooks (`useServers`, `useHealthCheck`)
- **✅ DO:** Wrap tests in `TestApiProvider`
- **✅ DO:** Handle auth errors with `useAuth().isUnauthorizedError()`
- **❌ DON'T:** Pass `api` as prop (use context)
- **❌ DON'T:** Call `useApi()` directly in components (use domain hooks)

## Full Documentation

- [Main README](../../README.md) - User guide
- [Web UI Specification](../../docs/api/WEB_UI_SPECIFICATION.md) - Feature details
- [Web UI Architecture](../../docs/development/WEB_UI_ARCHITECTURE.md) - Technical design

## Development

```bash
# Type check
bun run typecheck

# Lint
bun run lint

# Format
bun run format
```

## License

MIT
