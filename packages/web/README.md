# @fiberplane/mcp-gateway-web

React-based web UI for browsing and analyzing MCP Gateway logs.

## Overview

This package provides a modern web interface for viewing captured MCP traffic. The UI connects to the MCP Gateway API to display logs with filtering, sorting, and export capabilities.

## Features

- **Log Browsing** - View all captured MCP traffic in a sortable table
- **Server Filtering** - Filter logs by MCP server name
- **Session Filtering** - Filter logs by client session ID
- **Real-time Updates** - Automatically polls for new logs (5-second interval)
- **Log Details** - Expand individual logs to view full request/response JSON
- **Export Functionality** - Export selected logs or all logs as JSON
- **Responsive Design** - Works on desktop and mobile browsers
- **Error Handling** - Error Boundary prevents crashes and shows user-friendly errors

## Technology Stack

- **React 19** - UI framework with modern hooks
- **TypeScript** - Full type safety
- **Vite** - Build tool and dev server with HMR
- **TanStack Query** - Data fetching, caching, and synchronization
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **date-fns** - Date formatting utilities

## Development

### Prerequisites

- Bun installed
- MCP Gateway API running (usually on port 3333)

### Quick Start

```bash
# Install dependencies (from monorepo root)
bun install

# Start dev server (from monorepo root)
bun run --filter @fiberplane/mcp-gateway-web dev

# Or from package directory
cd packages/web
bun run dev
```

The dev server will start on `http://localhost:5173` with hot module replacement enabled.

### Development Workflow

For full-stack development, you need to run both the API and web UI:

```bash
# Terminal 1: Start the gateway (includes API)
cd packages/mcp-gateway
bun run dev

# Terminal 2: Start web UI dev server
cd packages/web
bun run dev
```

The web UI dev server will proxy API requests to `http://localhost:3333/api`.

## Building

```bash
# Build for production (from monorepo root)
bun run --filter @fiberplane/mcp-gateway-web build

# Or from package directory
cd packages/web
bun run build
```

This creates optimized production files in `public/` directory:
- `index.html` - Entry point
- `assets/` - Bundled JS and CSS with content hashes

## Integration with CLI

The CLI automatically includes the built web UI and serves it at `/ui`:

```bash
# Start gateway with web UI
mcp-gateway

# Web UI available at:
# http://localhost:3333/ui
```

The CLI bundles the pre-built web UI static files during compilation.

## Project Structure

```
packages/web/
├── src/
│   ├── components/         # React components
│   │   ├── ErrorBoundary.tsx      # Error boundary wrapper
│   │   ├── log-table.tsx          # Main log table component
│   │   ├── pagination.tsx         # Load more button
│   │   ├── server-filter.tsx      # Server dropdown
│   │   ├── session-filter.tsx     # Session dropdown
│   │   ├── export-button.tsx      # JSON export
│   │   └── ui/                    # Radix UI components
│   ├── lib/                # Utilities and API client
│   │   ├── api.ts                 # API client
│   │   ├── badge-color.ts         # Badge color mapping
│   │   ├── query-client.ts        # TanStack Query setup
│   │   ├── use-handler.ts         # Stable callback hook
│   │   └── utils.ts               # Shared utilities
│   ├── App.tsx             # Main application component
│   ├── main.tsx            # Application entry point
│   └── index.css           # Global styles and Tailwind
├── public/                 # Build output (gitignored)
├── components.json         # Radix UI configuration
├── tailwind.config.ts      # Tailwind configuration
├── vite.config.ts          # Vite configuration
└── package.json
```

## Component Architecture

### Main Components

- **App.tsx** - Root component, manages filters and log state
- **LogTable** - Displays logs in expandable table rows
- **Pagination** - "Load More" button for infinite scroll
- **ServerFilter** - Dropdown to filter by server name
- **SessionFilter** - Dropdown to filter by session ID
- **ExportButton** - Exports selected or all logs as JSON
- **ErrorBoundary** - Catches and displays React errors

### Data Flow

```
API (/api/logs, /api/servers, /api/sessions)
  ↓
TanStack Query (caching & polling)
  ↓
App.tsx (state management)
  ↓
Child Components (display & interaction)
```

### State Management

- **Server State** - TanStack Query manages API data, caching, and polling
- **Local State** - React `useState` for filters, selection, and UI state

## API Client

The `lib/api.ts` module provides a typed API client:

```typescript
import { api } from './lib/api';

// Get logs with filters
const response = await api.getLogs({
  serverName: 'my-server',
  sessionId: 'abc-123',
  limit: 100,
  order: 'desc',
});

// Get available servers
const servers = await api.getServers();

// Get sessions for a server
const sessions = await api.getSessions('my-server');
```

## Styling

The UI uses Tailwind CSS with a custom design system:

- **Color Palette** - Neutral grays with blue accents
- **Typography** - System font stack with monospace for code
- **Components** - Radix UI primitives styled with Tailwind
- **Responsive** - Mobile-first breakpoints

## Type Safety

All components and API calls are fully typed:

- **API Types** - Imported from `@fiberplane/mcp-gateway-types`
- **Component Props** - Explicit TypeScript interfaces
- **TanStack Query** - Type-safe query keys and data

## Error Handling

- **ErrorBoundary** - Catches React errors and displays fallback UI
- **API Errors** - Displayed inline with error messages
- **Network Errors** - TanStack Query retry logic with error states

## Performance Optimizations

- **Memoization** - `useHandler` hook for stable callbacks
- **Query Caching** - TanStack Query caches API responses
- **Code Splitting** - Vite automatically splits chunks
- **Tree Shaking** - Unused code eliminated in production

## Development Tips

### Hot Module Replacement

Vite provides instant HMR for fast development. Changes to React components
are reflected immediately without losing state.

### API Proxy

The dev server proxies API requests to avoid CORS issues:

```typescript
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:3333',
    changeOrigin: true,
  },
}
```

### Adding New Components

Use the `npx shadcn@latest add <component>` command to add new Radix UI components.

### TypeScript Errors

Run `bun run typecheck` from monorepo root to check for type errors across all packages.

## Testing

Currently, the web package does not have automated tests. Future additions:
- Unit tests with Vitest
- Component tests with Testing Library
- E2E tests with Playwright

## Accessibility

The UI uses Radix UI primitives which are built with accessibility in mind:
- Keyboard navigation for all interactive elements
- ARIA labels and roles
- Focus management
- Screen reader support

## Browser Support

Aims to work with the latest versions of major desktop browsers:

- Chrome/Edge
- Firefox
- Safari

## Contributing

See the main [CLAUDE.md](../../CLAUDE.md) for development guidelines.

## License

MIT
