# Monorepo Development Guide

Quick reference for developing in the MCP Gateway monorepo.

**For complete information, see [CLAUDE.md](../../CLAUDE.md)** - the single source of truth for all development instructions.

## Quick Start

```bash
git clone <repo-url>
cd mcp-gateway
bun install

# Dev mode
bun run dev

# Test server
bun run --filter test-mcp-server dev

# Web UI dev server
bun run --filter @fiberplane/mcp-gateway-web dev
```

## Structure

```
packages/
├── types/          # @fiberplane/mcp-gateway-types (Zod schemas)
├── core/           # @fiberplane/mcp-gateway-core (business logic)
├── api/            # @fiberplane/mcp-gateway-api (REST API)
├── server/         # @fiberplane/mcp-gateway-server (MCP protocol)
├── web/            # @fiberplane/mcp-gateway-web (React UI)
├── mcp-gateway/    # @fiberplane/mcp-gateway-cli (CLI source, private)
└── cli/            # @fiberplane/mcp-gateway (public wrapper)
```

**Dependency flow:**
```
types → core → api → cli
             → server ↗
             → web ↗
```

## Common Commands

```bash
# Build all packages
bun run build

# Type check
bun run typecheck

# Lint & format
bun run lint
bun run format

# Tests (runs each workspace's bunfig.toml)
bun run test

# Clean
bun run clean

# Check circular deps
bun run check-circular
```

## Package-Specific Commands

```bash
# Build specific package
bun run --filter @fiberplane/mcp-gateway-core build

# Test specific package
bun run --filter @fiberplane/mcp-gateway-cli test

# Dev mode for web UI (Vite with HMR)
bun run --filter @fiberplane/mcp-gateway-web dev
```

## Adding Dependencies

```bash
# To specific package
cd packages/core
bun add express

# Dev dependencies to root
bun add -D @types/node
```

## Changesets Workflow

**CRITICAL:** Always create changesets for `@fiberplane/mcp-gateway` only (not internal packages).

```bash
# Create changeset
bun changeset

# Validate before committing
bun run changeset:check
```

## Troubleshooting

**Package not found:**
```bash
rm -rf node_modules bun.lockb && bun install
```

**TypeScript errors:**
```bash
bun tsc --build --clean && bun tsc --build
```

**Build failures:**
```bash
bun run clean && bun run build
```

**Circular dependencies:**
```bash
bun run check-circular  # Identify cycles
# Extract shared code to utils/
```

**Mixed changeset error:**
```bash
bun run changeset:check  # Only @fiberplane/mcp-gateway should be versioned
```

## IDE Setup

**.vscode/settings.json:**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome"
}
```

**Recommended extensions:**
- Biome (biomejs.biome)
- Bun for Visual Studio Code

## Additional Resources

- **[CLAUDE.md](../../CLAUDE.md)** - Complete development guide ⭐
- [README.md](../../README.md) - User documentation
- [Web UI Development](./web-ui-development.md) - UI/design tokens
- [Architecture Overview](../architecture/overview.md) - System design
