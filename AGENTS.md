# MCP Gateway Monorepo - Claude Code Instructions

## Project Overview

This is a Bun workspace monorepo containing the MCP Gateway project. The repository structure follows monorepo best practices while maintaining backward compatibility for the main `@fiberplane/mcp-gateway` package.

## Repository Structure

```
/Users/jaccoflenter/dev/fiberplane/mcp-gateway/
├── packages/
│   ├── mcp-gateway/             # @fiberplane/mcp-gateway (main package)
│   │   ├── src/                 # CLI orchestration
│   │   │   └── cli.ts           # CLI entry point
│   │   ├── bin/                 # Development CLI executable
│   │   ├── tests/               # Integration tests
│   │   ├── package.json         # CLI package configuration
│   │   └── tsconfig.json
│   ├── types/                   # @fiberplane/mcp-gateway-types
│   │   ├── src/                 # Type definitions and Zod schemas
│   │   ├── package.json         # Types package configuration
│   │   └── tsconfig.json
│   ├── core/                    # @fiberplane/mcp-gateway-core
│   │   ├── src/                 # Core business logic
│   │   │   ├── registry/        # Registry operations
│   │   │   ├── capture/         # MCP traffic capture
│   │   │   ├── logs/            # Log storage and queries
│   │   │   ├── utils/           # Shared utilities
│   │   │   ├── logger.ts        # Logging infrastructure
│   │   │   └── health.ts        # Health checks
│   │   ├── package.json         # Core package configuration
│   │   └── tsconfig.json
│   ├── management-mcp/          # @fiberplane/mcp-gateway-management-mcp
│   │   ├── src/                 # Gateway management MCP API
│   │   │   ├── tools/           # MCP tools (server & capture)
│   │   │   ├── app.ts           # MCP server creation
│   │   │   └── index.ts         # Public exports
│   │   ├── package.json         # Management MCP package configuration
│   │   ├── tsconfig.json
│   │   └── README.md            # Management MCP documentation
│   ├── server/                  # @fiberplane/mcp-gateway-server
│   │   ├── src/                 # HTTP server with proxy
│   │   │   ├── routes/          # Proxy and OAuth routes
│   │   │   ├── app.ts           # Hono application factory
│   │   │   └── index.ts         # Public exports
│   │   ├── package.json         # Server package configuration
│   │   ├── tsconfig.json
│   │   └── README.md            # Server documentation
│   ├── web/                     # @fiberplane/mcp-gateway-web
│   │   ├── src/                 # React web UI
│   │   │   ├── components/      # React components
│   │   │   ├── lib/             # API client and utilities
│   │   │   ├── App.tsx          # Main application
│   │   │   └── main.tsx         # Entry point
│   │   ├── public/              # Static assets (gitignored)
│   │   ├── package.json         # Web package configuration
│   │   ├── tsconfig.json
│   │   └── vite.config.ts       # Vite configuration
│   └── api/                     # @fiberplane/mcp-gateway-api
│       ├── src/                 # REST API for UI
│       │   ├── routes/          # API route handlers
│       │   ├── app.ts           # API app factory
│       │   └── index.ts         # Public exports
│       ├── package.json         # API package configuration
│       ├── tsconfig.json
│       └── README.md            # API documentation
├── test-mcp-server/             # Test MCP server for validation
│   ├── *.ts                     # Test server configurations
│   └── package.json             # Test server dependencies
├── scripts/                     # Shared build scripts
│   └── build.ts                 # Package build script
├── .github/workflows/           # CI/CD workflows
├── package.json                 # Root workspace configuration
└── [config files]              # Root-level configurations
```

## Important Commands

### Development Commands
- `bun install` - Install all workspace dependencies
- `bun run dev` - Start development mode (filters to CLI package)
- `bun run build` - Build all packages in dependency order (types → core → api → management-mcp → server → web → cli)
- `bun run clean` - Clean all dist folders
- `bun run test` - Run all tests across workspace (runs each workspace's tests with proper config)
- `bun run typecheck` - Type check all packages
- `bun run lint` - Lint all files with Biome
- `bun run format` - Format all files with Biome
- `bun run check-circular` - Check for circular dependencies (both within and between packages)
- `bun run deps-graph` - Generate dependency graph (deps.svg)

> **Shutdown Note**: `bun run dev` uses watch mode which intercepts SIGINT/SIGTERM. Shutdown messages/statistics may not appear and port 3333 may not release immediately. For clean shutdown, use `bun run --filter @fiberplane/mcp-gateway dev:no-watch` or wait ~1s before restarting.

### Package-Specific Commands
- `bun run --filter @fiberplane/mcp-gateway-types build` - Build types package
- `bun run --filter @fiberplane/mcp-gateway-core build` - Build core package
- `bun run --filter @fiberplane/mcp-gateway-api build` - Build API package
- `bun run --filter @fiberplane/mcp-gateway-management-mcp build` - Build management MCP package
- `bun run --filter @fiberplane/mcp-gateway-server build` - Build server package
- `bun run --filter @fiberplane/mcp-gateway-web build` - Build web UI
- `bun run --filter @fiberplane/mcp-gateway-web dev` - Dev mode for web UI (Vite dev server)
- `bun run --filter @fiberplane/mcp-gateway build` - Build CLI package
- `bun run --filter @fiberplane/mcp-gateway dev` - Dev mode for CLI
- `bun run --filter test-mcp-server dev` - Run test MCP server

### Testing Commands
- `bun run test` - Run all tests (uses workspace-specific configs)
- `bun run --filter @fiberplane/mcp-gateway test` - Test CLI package only

> **Note:** Use `bun run test` instead of `bun test` from the root. This ensures each workspace uses its own bunfig.toml configuration. The web package requires happy-dom for React tests, which conflicts with CLI tests if loaded globally.

## Key Points for Claude Code

### 1. Workspace Structure
- This is a **Bun workspace** - always use `bun` commands, not npm/yarn
- Several packages with clear boundaries:
  - `@fiberplane/mcp-gateway-types` - Pure types and Zod schemas (no runtime deps)
  - `@fiberplane/mcp-gateway-core` - Business logic (registry, capture, logs, health, logger)
  - `@fiberplane/mcp-gateway-api` - REST API for querying logs (uses dependency injection)
  - `@fiberplane/mcp-gateway-management-mcp` - MCP protocol API for gateway management
  - `@fiberplane/mcp-gateway-server` - MCP protocol HTTP server (proxy, OAuth)
  - `@fiberplane/mcp-gateway-web` - React-based web UI for browsing logs (relies on the REST API)
  - `@fiberplane/mcp-gateway` - Main CLI package that orchestrates server + API + management MCP + web UI
- Use `--filter` flags for package-specific operations
- Test MCP server is a separate workspace for testing proxy functionality

### 2. Package Dependencies
```
types (no deps) → core (types) → api (core types only, DI) ────────┐
                                ↘ management-mcp (core, MCP tools) ─┤→ cli (orchestrates all)
                                ↘ server (core, proxy) ─────────────┤
                                ↘ web (api client) ─────────────────┘
```
- **No circular dependencies** - enforced by `madge` in CI
- **API uses dependency injection** - query functions passed at runtime
- **Management MCP is auth-agnostic** - wrapped with auth middleware at orchestration level
- **Server focuses on proxy infrastructure** - proxy, OAuth, health checks only
- **CLI orchestrates everything** - mounts server, API, management MCP, and web UI
- **Dependency validation** - `depcheck` used to catch missing dependencies in all packages
  - Bun's hoisting can mask missing dependencies in package.json
  - `validate-deps` scripts catch these before they cause issues in different environments
  - Run `bun run validate-deps` to check all packages
  - Run `bun run --filter <package> validate-deps` to check specific package
  - Enforced in CI before build step
- During development, packages use `workspace:*` protocol
- During publishing, `workspace:*` is replaced with actual version ranges
- All packages are published to npm independently

### 3. Build System
- **Shared build script** at `scripts/build.ts` referenced by all packages
- Each package has its own build configuration
- TypeScript declaration files generated only for library packages (not CLI or web)
- Web package uses Vite for building React app
- Build order matters: types → core → api → management-mcp → server/web → cli

### 4. TypeScript Configuration
- **Development mode**: Uses source `.ts` files directly (no build required for typechecking)
- **Production mode**: Uses compiled `.d.ts` declaration files
- Each package extends root `tsconfig.json`
- Configuration preserves Hono JSX compatibility (`"module": "Preserve"`)
- Conditional exports in package.json point to source files during dev

### 5. Package Management
- Root `package.json` defines workspace structure
- Main public package maintains original name: `@fiberplane/mcp-gateway`
- Internal dependencies use `workspace:*` protocol
- All devDependencies consolidated at root level
- Use `bun add -D` at root for dev dependencies

### 6. CI/CD Integration
- GitHub Actions updated for monorepo structure
- **Circular dependency check** runs in CI before typecheck
- CI builds all packages: types → core → api → server → web → cli
- Changesets configured for independent versioning
- Changesets ignores `test-mcp-server`, tracks `packages/*`
- Publishing is automated via changesets action

### 7. Backward Compatibility
- ✅ Main package name unchanged: `@fiberplane/mcp-gateway`
- ✅ CLI command unchanged: `mcp-gateway`
- ✅ API surface identical
- ✅ Installation: `npm install -g @fiberplane/mcp-gateway`

## Common Tasks

### Adding New Dependencies

**To types package:**
```bash
cd packages/types
bun add <package-name>
```

**To core package:**
```bash
cd packages/core
bun add <package-name>
```

**To API package:**
```bash
cd packages/api
bun add <package-name>
```

**To server package:**
```bash
cd packages/server
bun add <package-name>
```

**To web package:**
```bash
cd packages/web
bun add <package-name>
```

**To CLI package:**
```bash
cd packages/mcp-gateway
bun add <package-name>
```

**To test-mcp-server:**
```bash
cd test-mcp-server
bun add <package-name>
```

**Dev dependencies (add to root):**
```bash
bun add -D <package-name>
```

### Adding New Packages

When adding new packages to the monorepo, follow this structured approach:

#### Package Structure Requirements
- All publishable packages go in `packages/` directory
- Use `@fiberplane/` namespace for published packages
- Follow consistent structure: `src/`, `dist/`, `package.json`, `tsconfig.json`
- Reference shared build script: `"build": "bun run ../../scripts/build.ts"`

#### Configuration Updates Required
1. **Root tsconfig.json** - Add project reference
2. **Changesets config** - Automatically includes `packages/*`
3. **GitHub workflows** - Automatically pick up workspace packages

#### Key Conventions
- Use `workspace:*` for internal dependencies
- Set `"type": "module"` for ESM compatibility
- Include proper exports configuration for dual module support
- Use consistent TypeScript configuration extending root config

### Running Tests
```bash
# All tests (from root - runs each workspace's tests with proper config)
bun run test

# Specific package tests
bun run --filter @fiberplane/mcp-gateway test
bun run --filter @fiberplane/mcp-gateway-web test
bun run --filter @fiberplane/mcp-gateway-core test
```

### Building and Development
```bash
# Build all packages
bun run build

# Development mode
bun run dev

# Test MCP server
bun run --filter test-mcp-server dev
```

### Testing with the Gateway

**IMPORTANT - Gateway Endpoint Pattern**

When the gateway is running (`bun run dev`), it proxies MCP servers through this endpoint pattern:

```
http://localhost:3333/s/{serverName}/mcp
```

**NOT** `http://localhost:3333/{serverName}/mcp` ❌

**Examples:**
- Server named "everything" → `http://localhost:3333/s/everything/mcp` ✅
- Server named "test-server" → `http://localhost:3333/s/test-server/mcp` ✅

**Common test workflow:**
```bash
# 1. Start test MCP server (runs on port 3001 or 3002)
bun run --filter test-mcp-server dev

# 2. Start gateway (runs on port 3333)
bun run dev

# 3. Make requests through gateway proxy
curl http://localhost:3333/s/everything/mcp \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'

# 4. View logs
# - Web UI: http://localhost:3333/ui
# - API: http://localhost:3333/api/logs
```

**Gateway Configuration:**
- Config file: `~/.mcp-gateway/mcp.json`
- Database: `~/.mcp-gateway/logs.db`
- Clear database: `rm ~/.mcp-gateway/logs.db*`

### Release Process
```bash
# Create changeset
bun changeset

# Validate changesets (recommended before committing)
bun run changeset:check

# Version packages
bun changeset version

# Publish (done by CI)
bun changeset publish
```

**Important**: Always validate changesets before committing to avoid mixed changeset errors:
- **Mixed changesets** (referencing both ignored and non-ignored packages) are not allowed
- Ignored packages: `@fiberplane/mcp-gateway-web`, `@fiberplane/mcp-gateway-types`, etc. (see `.changeset/config.json`)
- Only `@fiberplane/mcp-gateway` (the public wrapper) should be versioned in changesets
- Other package changes should be described in the changeset body, not as versioned packages

### Changeset Workflow

**CRITICAL**: When making changes to ANY internal package, ALWAYS create a changeset for `@fiberplane/mcp-gateway`, not for the package you modified.

#### Why This Matters

All internal packages (`types`, `core`, `api`, `server`, `web`) are:
- ✅ **Private** - Not published to npm independently
- ✅ **Ignored by changesets** - See `.changeset/config.json`
- ✅ **Distributed as part of the main package** - Bundled with `@fiberplane/mcp-gateway`

The only package that gets versioned and published is:
- `@fiberplane/mcp-gateway` (main public package)

#### How to Create Changesets

**Rule**: Changes to internal packages → Create changeset for `@fiberplane/mcp-gateway`

**Examples:**

1. **Web UI changes:**
```bash
# You edited packages/web/src/components/LogTable.tsx
bun changeset
# Select: @fiberplane/mcp-gateway
# Select: patch (or minor/major)
# Description: "Improved log table accessibility and keyboard navigation"
```

Resulting changeset:
```md
---
"@fiberplane/mcp-gateway": patch
---

Improved log table accessibility and keyboard navigation in web UI
```

2. **Core logic changes:**
```bash
# You edited packages/core/src/health.ts
bun changeset
# Select: @fiberplane/mcp-gateway
# Select: minor
# Description: "Added health check support for MCP servers"
```

Resulting changeset:
```md
---
"@fiberplane/mcp-gateway": minor
---

Added health check support for MCP servers
```

3. **Multiple package changes:**
```bash
# You edited packages/web/, packages/core/, and packages/api/
bun changeset
# Select: @fiberplane/mcp-gateway
# Select: minor
```

Resulting changeset:
```md
---
"@fiberplane/mcp-gateway": minor
---

**Web**: Improved accessibility with better focus indicators and keyboard navigation
**Core**: Added health check support for MCP servers
**CLI**: Updated server health status display
```

#### Version Bump Guidelines

- **patch** (0.4.2 → 0.4.3): Bug fixes, small improvements, internal refactoring
- **minor** (0.4.2 → 0.5.0): New features, enhancements (backward compatible)
- **major** (0.4.2 → 1.0.0): Breaking changes, major architectural changes

#### What NOT to Do

❌ **Wrong**: Creating changesets for internal packages
```md
---
"@fiberplane/mcp-gateway-web": patch
---
```
This will cause a "mixed changeset" error since `web` is ignored.

❌ **Wrong**: Referencing multiple packages
```md
---
"@fiberplane/mcp-gateway": patch
"@fiberplane/mcp-gateway-web": patch
---
```
This will also cause a "mixed changeset" error.

✅ **Correct**: Always reference only `@fiberplane/mcp-gateway`
```md
---
"@fiberplane/mcp-gateway": patch
---

Improved web UI (describe the change in the body)
```

#### Validation

Always run validation before committing:
```bash
bun run changeset:check
```

This ensures your changesets are correctly formatted and won't cause CI failures.

### Publishing Lifecycle & Dependency Management

The `@fiberplane/mcp-gateway` package uses npm lifecycle hooks to manage dependencies during publishing:

#### How It Works

**Development state:**
- package.json contains only minimal direct dependencies (`@hono/node-server`, `hono`)
- Internal packages are `devDependencies` with `workspace:*` protocol

**Publishing flow:**

1. **`prepublishOnly` hook** (runs before `npm pack` or `npm publish`):
   ```bash
   bun run ../../scripts/merge-dependencies.ts  # Merge internal deps into dependencies
   bun run build                                  # Build package
   ```
   - Collects all dependencies from internal packages (types, core, api, server)
   - Merges them into mcp-gateway's `dependencies` section
   - Adds `optionalDependencies` (e.g., `@libsql/*` platform packages)
   - Updates lockfile

2. **`postpublish` hook** (runs after `npm publish` or `npm pack`):
   ```bash
   bun run ../../scripts/clean-dependencies.ts   # Clean back to minimal state
   ```
   - Removes merged dependencies
   - Resets to minimal direct dependencies only
   - Removes `optionalDependencies`
   - Updates lockfile

#### Manual Scripts

```bash
# Clean dependencies manually
cd packages/mcp-gateway
bun run clean-deps

# Merge dependencies manually
bun run ../../scripts/merge-dependencies.ts
```

#### Why This Approach?

- **Clean development**: package.json stays minimal during development
- **Complete published package**: All transitive dependencies listed explicitly
- **No manual maintenance**: Dependencies auto-merge from internal packages
- **Automatic cleanup**: Restores clean state after publish

#### Scripts Location

- `scripts/merge-dependencies.ts` - Collects deps from internal packages
- `scripts/clean-dependencies.ts` - Resets to minimal state

## Troubleshooting

### Common Issues

1. **"Package not found" errors**
   - Ensure you're using `--filter` for package-specific commands
   - Check that workspace dependencies are installed with `bun install`

2. **TypeScript errors**
   - Run `bun run typecheck` to see all package errors
   - Ensure all tsconfig.json files are properly configured
   - Check that project references are correct in root tsconfig.json

3. **Build failures**
   - Verify build script path in package.json: `../../scripts/build.ts`
   - Ensure all dependencies are installed
   - Check that the target package exists and is properly configured

4. **Workspace dependency issues**
   - Internal packages should use `"@fiberplane/mcp-gateway-*": "workspace:*"`
   - Run `bun install` after making workspace changes

5. **Circular dependency detected**
   - Run `bun run check-circular` to identify cycles
   - Extract shared code into a utility module
   - Example: Extract `ensureStorageDir` from `registry/storage.ts` to `utils/storage.ts`
   - Verify fix with `bun run check-circular` (should show no cycles)

6. **Type assertion warnings with readFile**
   - Bun's type definitions for `readFile` don't properly narrow with encoding parameter
   - Use pattern: `await readFile(path, "utf8") as unknown as string`
   - Add comment explaining why assertion is needed

7. **Mixed changeset error**
   - Error: "Mixed changesets that contain both ignored and not ignored packages are not allowed"
   - Run `bun run changeset:check` to validate changesets before committing
   - Fix by removing ignored packages from changeset frontmatter
   - Only `@fiberplane/mcp-gateway` should be versioned (other packages are ignored)
   - Example fix: Remove `"@fiberplane/mcp-gateway-web": patch` from changeset

### Migration Notes

This repository was migrated from a single-package structure to a monorepo. See `MIGRATION.md` for detailed migration steps and rationale. The migration:

- Maintains 100% backward compatibility
- Improves development workflow
- Enables future package splitting
- Follows Fiberplane repository patterns

## Development Workflow

1. **Making changes**: Work in appropriate package directory (`packages/types/`, `packages/core/`, `packages/api/`, `packages/server/`, `packages/web/`, or `packages/mcp-gateway/`)
2. **Testing**: Use test MCP server in `test-mcp-server/` directory
3. **Web UI development**: Run `bun run --filter @fiberplane/mcp-gateway-web dev` to start Vite dev server with hot reload
4. **Type checking**: Run `bun run typecheck` (works without building packages)
5. **Circular deps**: Check with `bun run check-circular` before committing
6. **Building**: Build packages in dependency order (or use filtered commands)
7. **Committing**: Use conventional commit messages
8. **Changesets**: Create with `bun changeset`, validate with `bun run changeset:check` before committing
9. **Releasing**: Use changesets workflow for versioning and publishing

## Package Structure Benefits

The refactored monorepo structure provides:
- ✅ **Clear separation of concerns** - Types, core logic, query API, MCP protocol server, web UI, and CLI orchestrator are independent
- ✅ **Better testability** - Each package can be tested in isolation
- ✅ **Reusability** - API and server packages can be embedded in other applications
- ✅ **Dependency injection** - API package uses DI for flexibility and testing
- ✅ **Focused responsibilities** - Server handles MCP protocol, CLI handles orchestration
- ✅ **Independent versioning** - Packages can be versioned and released independently
- ✅ **No circular dependencies** - Enforced by CI checks with madge
- ✅ **Multiple UIs** - Web UI for visual management and monitoring

## Web UI

The gateway includes a React-based web UI (`@fiberplane/mcp-gateway-web`) for browsing captured logs.

### Features
- **Log browsing** - View all captured MCP traffic with filtering by server and session
- **Real-time updates** - Automatically polls for new logs
- **Log details** - Expand individual logs to view full request/response JSON
- **Export functionality** - Export selected or all logs as JSON

### Development
```bash
# Start web UI dev server (with hot reload)
bun run --filter @fiberplane/mcp-gateway-web dev

# Build for production
bun run --filter @fiberplane/mcp-gateway-web build
```

### Integration with CLI
The CLI automatically builds and serves the web UI at `/ui` when started:
```bash
mcp-gateway
# Web UI available at: http://localhost:3333/ui
```

### Technology Stack
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TanStack Query** - Data fetching and caching
- **TanStack Router** - Client-side routing
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible component primitives

## Future Enhancements

The monorepo structure enables:
- Additional export formats (CSV, Excel, etc.)
- Real-time WebSocket updates (instead of polling)

---

**Remember**: This is a Bun workspace. Always use `bun` commands and leverage the `--filter` flag for package-specific operations.
