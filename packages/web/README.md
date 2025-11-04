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
