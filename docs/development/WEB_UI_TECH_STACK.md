# MCP Gateway Web UI - Tech Stack Summary

## Overview

This document summarizes the final technology decisions for the MCP Gateway Web UI.

---

## Core Stack

| Layer | Technology | Version | Why? |
|-------|-----------|---------|------|
| **Build Tool** | Vite | Latest | Fast HMR, optimal for React |
| **Framework** | React 18 | 18.x | Component-based, large ecosystem |
| **Language** | TypeScript | 5.x | Type safety, better DX |
| **Styling** | Tailwind CSS | 3.x | Utility-first, fast development |
| **Components** | Shadcn/ui | Latest | Accessible, customizable, copy-paste |
| **State (Server)** | TanStack Query | 5.x | Server state, polling, caching |
| **State (Client)** | Zustand | 4.x | Simple client state for filters |
| **Date Formatting** | date-fns | Latest | Lightweight, tree-shakeable |

---

## Why Shadcn/ui?

### ✅ Pros
- **Own the code** - Components copied to your repo, not npm dependencies
- **Customizable** - Full control, can modify any component
- **Tailwind-native** - Perfect match for our styling approach
- **Fast scaffolding** - CLI adds components in seconds
- **Long-term viable** - Growing ecosystem, active maintenance
- **No lock-in** - It's just React + Radix + Tailwind code

### Components Used
```bash
bunx shadcn-ui@latest add table      # LogTable
bunx shadcn-ui@latest add select     # ServerFilter, SessionFilter
bunx shadcn-ui@latest add input      # MethodSearch
bunx shadcn-ui@latest add button     # Export, Refresh, Load More
bunx shadcn-ui@latest add badge      # Method badges
bunx shadcn-ui@latest add dialog     # Optional: Log details modal
```

### Alternatives Considered

| Option | Tailwind? | Scaffolding | Verdict |
|--------|-----------|-------------|---------|
| **Radix UI** (raw) | ✅ Manual | ⚡ Slow | Too verbose |
| **Shadcn/ui** | ✅✅✅ | ⚡⚡⚡ Fast | ✅ **Winner** |
| Material UI | ❌ | ⚡⚡ | Not Tailwind |
| Chakra UI | ❌ | ⚡⚡ | Uncertain future |

---

## Design System

### Source
Figma design with **semantic CSS variables**: https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground

### Token Strategy
- **Extracted from Figma** - Semantic tokens like `--bg/primary`, `--spacing/md`
- **HSL format** - Easier theming and opacity manipulation
- **Intent-based badges** - `info`, `success`, `warning`, `error` (not raw colors)

See `docs/DESIGN_TOKENS.md` for complete mapping.

### Fonts
- **UI Text:** Inter (Google Fonts)
- **Code/Monospace:** Roboto Mono (Google Fonts)

---

## Package Structure

```
packages/web/
├── src/
│   ├── components/
│   │   ├── ui/              ← Shadcn components (owned by us)
│   │   │   ├── button.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── input.tsx
│   │   │   ├── badge.tsx
│   │   │   └── dialog.tsx
│   │   ├── ServerFilter.tsx
│   │   ├── SessionFilter.tsx
│   │   ├── MethodSearch.tsx
│   │   ├── LogTable.tsx
│   │   ├── LogDetails.tsx
│   │   ├── ExportButton.tsx
│   │   └── RefreshButton.tsx
│   ├── hooks/
│   │   └── useLogs.ts       ← TanStack Query hook
│   ├── lib/
│   │   ├── api.ts           ← API client
│   │   ├── queryClient.ts   ← TanStack Query config
│   │   ├── badge-color.ts   ← Method badge color logic
│   │   └── utils.ts         ← Shadcn utils (cn function)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css            ← Tailwind + design tokens
├── components.json          ← Shadcn config
├── tailwind.config.ts       ← Tailwind + design tokens
├── vite.config.ts
├── package.json
└── tsconfig.json
```

---

## API Integration

### Data Fetching Pattern

```typescript
// TanStack Query for server state
const { data, isLoading } = useQuery({
  queryKey: ['logs', filters],
  queryFn: () => api.getLogs(filters),
  refetchInterval: 1000, // Poll every second
  refetchIntervalInBackground: false,
})

// Zustand for filter state
const [filters, setFilters] = useStore((state) => [
  state.filters,
  state.setFilters,
])
```

### Endpoints Used
- `GET /api/logs` - Paginated logs with filters
- `GET /api/servers` - Server list for dropdown
- `GET /api/sessions` - Session list for dropdown
- `GET /api/logs/export` - Export to JSONL

---

## Styling Approach

### Utility-First with Tailwind

```tsx
// Example: Button with design tokens
<button className="bg-bg-primary text-fg-on-primary px-3 py-2 rounded-md text-sm hover:opacity-90">
  Export
</button>

// Example: Method badge with utility
<span className={cn(
  'px-1.5 py-1 rounded-md text-sm font-mono',
  getMethodBadgeColor(log.method)
)}>
  {log.method}
</span>
```

### Component Composition

```tsx
// Shadcn Select (owned by us, can customize)
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

<Select value={serverName} onValueChange={setServerName}>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="All servers" />
  </SelectTrigger>
  <SelectContent>
    {servers.map(server => (
      <SelectItem key={server.name} value={server.name}>
        {server.name} ({server.logCount})
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

## Development Experience

### Hot Reload
- Vite HMR for instant updates
- TanStack Query devtools for debugging
- Tailwind JIT for fast styling

### Type Safety
- TypeScript across the stack
- Zod for API validation
- Typed query hooks

### Component Development
- Shadcn CLI for instant scaffolding
- Storybook (optional, post-MVP)
- React DevTools

---

## Performance Considerations

### Bundle Size
- **Vite code splitting** - Automatic route-based splitting
- **Tree shaking** - Unused Tailwind classes purged
- **Shadcn advantage** - Only components we use, no full library

### Runtime Performance
- **TanStack Query caching** - Avoids unnecessary refetches
- **Polling optimization** - Stops when tab hidden
- **Virtual scrolling** - Deferred to post-MVP (if needed)

---

## Future Enhancements

### Post-MVP
- Dark mode (design tokens ready!)
- Advanced filters (time range, duration slider)
- Full-text search in JSON
- Stats dashboard
- Multiple export formats (CSV, JSON)

### Scalability
- Virtual scrolling for 1000+ logs
- Infinite query for pagination
- WebSocket updates (replace polling)
- Service worker for offline support

---

## Installation Commands

```bash
# Create Vite project
cd packages
npm create vite@latest web -- --template react-ts
cd web
bun install

# Initialize Shadcn
bunx shadcn-ui@latest init

# Add components
bunx shadcn-ui@latest add table select input button badge dialog

# Add dependencies
bun add @tanstack/react-query zustand date-fns

# Add Tailwind (if not installed by Shadcn)
bun add -D tailwindcss postcss autoprefixer
bunx tailwindcss init -p
```

---

## Configuration Files

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

### `tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## Summary

**Tech Stack:** React + TypeScript + Vite + Tailwind + Shadcn/ui + TanStack Query + Zustand

**Key Decisions:**
- ✅ Shadcn for accessible, customizable components
- ✅ Semantic design tokens from Figma
- ✅ HSL color format for theming
- ✅ TanStack Query for server state + polling
- ✅ Zustand for simple client state
- ✅ Own the component code (no black box)

**Timeline:** 2 days for Web UI (Days 3-4 of 5-day MVP)

**Next Steps:** See `docs/IMPLEMENTATION_CHECKLIST.md` for detailed tasks
