# MCP Gateway Package Refactoring Plan

## Overview

This document outlines the plan to refactor the `@fiberplane/mcp-gateway` monorepo from a single package into multiple focused packages. This refactoring is a prerequisite for adding a web UI and REST API in a future PR.

**Goals:**
- ✅ Zero breaking changes for end users
- ✅ Clean separation of concerns
- ✅ Enable future UI/API development
- ✅ Improve testability and maintainability

## Current vs. Proposed Structure

### Current: Single Package

```
packages/mcp-gateway/
├── src/
│   ├── schemas.ts              (types + validation)
│   ├── types.ts                (shared types)
│   ├── registry.ts             (types + logic)
│   ├── storage.ts              (persistence)
│   ├── capture.ts              (MCP traffic capture)
│   ├── sse-parser.ts           (SSE parsing)
│   ├── logger.ts               (logging)
│   ├── health.ts               (health checks)
│   ├── mcp-server.ts           (gateway's MCP server)
│   ├── events.ts               (TUI events)
│   ├── run-v2.ts               (CLI orchestration)
│   ├── mcp-tools/              (MCP tools)
│   ├── server/                 (HTTP server)
│   └── tui-v2/                 (Terminal UI)
└── bin/cli.js

All code tightly coupled in one package
```

### Proposed: Multi-Package Structure

```
packages/
├── types/                      🎯 Pure types & schemas
│   └── (schemas, types, registry types)
│
├── core/                       🎯 Core business logic
│   └── (registry ops, storage, capture, health, logger, MCP)
│
├── server/                     🎯 HTTP API layer
│   └── (Hono app, routes, middleware)
│
└── cli/                        🎯 User interface
    └── (orchestration, TUI, events)

Clear boundaries, testable units
```

### Dependency Flow

**Current:** Everything imports everything ❌

**Proposed:**
```
                        ┌─────────────┐
                        │    types    │ (no deps)
                        └─────────────┘
                               ↑
                               │
                        ┌─────────────┐
                        │    core     │ (types only)
                        └─────────────┘
                               ↑
                        ┌──────┴──────┐
                        │             │
                   ┌─────────┐   ┌─────────┐
                   │ server  │   │   cli   │
                   └─────────┘   └─────────┘
                   (core+types)  (all packages)
```
✅ Clear hierarchy, no circular deps

## Target Package Structure

```
packages/
├── types/                          # @fiberplane/mcp-gateway-types
│   ├── src/
│   │   ├── index.ts               # Main exports
│   │   ├── schemas.ts             # Zod schemas (JSON-RPC, captures, etc.)
│   │   ├── registry.ts            # Registry types only
│   │   └── shared.ts              # Shared types (Context, LogEntry, etc.)
│   ├── package.json
│   └── tsconfig.json
│
├── core/                           # @fiberplane/mcp-gateway-core
│   ├── src/
│   │   ├── index.ts               # Main exports
│   │   ├── registry/
│   │   │   ├── index.ts           # Registry operations
│   │   │   └── storage.ts         # Registry persistence
│   │   ├── capture/
│   │   │   ├── index.ts           # Capture logic
│   │   │   └── sse-parser.ts      # SSE parsing
│   │   ├── mcp/
│   │   │   ├── server.ts          # Gateway's own MCP server
│   │   │   └── tools/
│   │   │       ├── server-tools.ts
│   │   │       └── capture-tools.ts
│   │   ├── health.ts              # Health check logic
│   │   └── logger.ts              # Logger infrastructure
│   ├── package.json
│   └── tsconfig.json
│
├── server/                         # @fiberplane/mcp-gateway-server
│   ├── src/
│   │   ├── index.ts               # Main exports
│   │   ├── app.ts                 # Hono app factory (createApp)
│   │   ├── routes/
│   │   │   ├── proxy.ts           # MCP proxy routes
│   │   │   ├── oauth.ts           # OAuth discovery routes
│   │   │   ├── status.ts          # Status/health routes
│   │   │   └── gateway-mcp.ts     # Gateway's own MCP endpoint
│   │   └── middleware/
│   │       └── logging.ts         # HTTP logging middleware
│   ├── package.json
│   └── tsconfig.json
│
└── cli/                            # @fiberplane/mcp-gateway
    ├── src/
    │   ├── index.ts               # Re-export CLI function
    │   ├── cli.ts                 # CLI orchestration (run-v2.ts)
    │   ├── events.ts              # TUI<->Server event bridge
    │   └── tui/                   # Terminal UI (all of tui-v2/)
    │       ├── App.tsx
    │       ├── store.ts
    │       ├── components/
    │       └── ...
    ├── bin/
    │   └── cli.js                 # CLI entry point
    ├── package.json               # Keeps @fiberplane/mcp-gateway name
    └── tsconfig.json
```

## Package Dependencies

```
┌──────────────────────┐
│ @fiberplane/mcp-gateway-types│  (no dependencies)
└──────────────────────┘
           ↑
           │
┌──────────────────────┐
│ @fiberplane/mcp-gateway-core │  (types)
└──────────────────────┘
           ↑
           │
     ┌─────┴─────┐
     │           │
┌─────────┐  ┌─────────────────────┐
│ server  │  │ cli (mcp-gateway)   │
└─────────┘  └─────────────────────┘
   (core      (core, server, types)
    types)
```

## File Migration Map

### Package 1: @fiberplane/mcp-gateway-types

**From** `packages/mcp-gateway/src/` → **To** `packages/types/src/`

| Current File | New Location | Changes |
|-------------|--------------|---------|
| `schemas.ts` | `schemas.ts` | Move entire file |
| `types.ts` | `shared.ts` | Rename, move |
| `registry.ts` | `registry.ts` | **Extract types only** (McpServer, Registry, ServerHealth) |

**Key Points:**
- Zero runtime dependencies (except zod for schemas)
- Pure types and schemas only
- Will be used by all other packages

### Package 2: @fiberplane/mcp-gateway-core

**From** `packages/mcp-gateway/src/` → **To** `packages/core/src/`

| Current File | New Location | Changes |
|-------------|--------------|---------|
| `registry.ts` | `registry/index.ts` | **Logic only** (functions like addServer, removeServer, etc.) |
| `storage.ts` | `registry/storage.ts` | Move entire file |
| `capture.ts` | `capture/index.ts` | Move entire file |
| `sse-parser.ts` | `capture/sse-parser.ts` | Move entire file |
| `health.ts` | `health.ts` | Move entire file |
| `logger.ts` | `logger.ts` | Move entire file |
| `mcp-server.ts` | `mcp/server.ts` | Move entire file |
| `mcp-tools/server-tools.ts` | `mcp/tools/server-tools.ts` | Move entire file |
| `mcp-tools/capture-tools.ts` | `mcp/tools/capture-tools.ts` | Move entire file |

**Dependencies:**
- `@fiberplane/mcp-gateway-types` (workspace:*)
- `mcp-lite`, `zod` (already in deps)

**Exports:**
```typescript
// packages/core/src/index.ts
export * from './registry/index.js';
export * from './registry/storage.js';
export * from './capture/index.js';
export * from './health.js';
export * from './logger.js';
export * from './mcp/server.js';
```

### Package 3: @fiberplane/mcp-gateway-server

**From** `packages/mcp-gateway/src/server/` → **To** `packages/server/src/`

| Current File | New Location | Changes |
|-------------|--------------|---------|
| `server/create-server.ts` | `app.ts` | Rename, adjust imports |
| `server/create-proxy-routes.ts` | `routes/proxy.ts` | Rename, adjust imports |
| `server/create-oauth-routes.ts` | `routes/oauth.ts` | Rename, adjust imports |
| `server/index.ts` | `index.ts` | Move, re-export app factory |

**Dependencies:**
- `@fiberplane/mcp-gateway-types` (workspace:*)
- `@fiberplane/mcp-gateway-core` (workspace:*)
- `hono`, `@hono/node-server`, `@hono/standard-validator` (already in deps)

**Exports:**
```typescript
// packages/server/src/index.ts
export { createApp } from './app.js';
export type { ServerOptions } from './app.js';
```

### Package 4: @fiberplane/mcp-gateway (CLI)

**From** `packages/mcp-gateway/src/` → **To** `packages/mcp-gateway/src/`

| Current File | New Location | Changes |
|-------------|--------------|---------|
| `run-v2.ts` | `cli.ts` | Rename, adjust imports |
| `events.ts` | `events.ts` | Move (TUI-specific events) |
| `tui-v2/**` | `tui/**` | Move entire directory |
| `bin/cli.js` | `bin/cli.js` | Update import path |
| `index.ts` | `index.ts` | Export `runCli` function |

**Dependencies:**
- `@fiberplane/mcp-gateway-types` (workspace:*)
- `@fiberplane/mcp-gateway-core` (workspace:*)
- `@fiberplane/mcp-gateway-server` (workspace:*)
- `@opentui/core`, `@opentui/react`, `react`, `zustand` (already in deps)

**Exports:**
```typescript
// packages/mcp-gateway/src/index.ts
export { runCli } from './cli.js';
```

## Migration Steps

### Phase 1: Create Package Structure (No Code Changes Yet)

**Goal:** Set up the directory structure and package.json files without moving code.

1. Create new package directories:
   ```bash
   mkdir -p packages/types/src
   mkdir -p packages/core/src/{registry,capture,mcp/tools}
   mkdir -p packages/server/src/routes
   mkdir -p packages/mcp-gateway/src
   ```

2. Create package.json for each package:
   - `packages/types/package.json`
   - `packages/core/package.json`
   - `packages/server/package.json`
   - Update `packages/mcp-gateway/package.json` to `packages/mcp-gateway/package.json`

3. Create tsconfig.json for each package

4. Update root `tsconfig.json` with project references

5. Update root `package.json` workspace configuration

6. Update `.changeset/config.json` to track all packages

**Validation:** Ensure `bun install` works and workspaces are recognized.

### Phase 2: Move @fiberplane/mcp-gateway-types

**Goal:** Extract all types and schemas into the types package.

1. **Create `packages/types/src/schemas.ts`:**
   - Copy `packages/mcp-gateway/src/schemas.ts` → `packages/types/src/schemas.ts`

2. **Create `packages/types/src/shared.ts`:**
   - Copy `packages/mcp-gateway/src/types.ts` → `packages/types/src/shared.ts`

3. **Create `packages/types/src/registry.ts`:**
   - Extract type definitions from `packages/mcp-gateway/src/registry.ts`
   - Include: `ServerHealth`, `McpServer`, `Registry` types only
   - Do NOT include functions

4. **Create `packages/types/src/index.ts`:**
   ```typescript
   export * from './schemas.js';
   export * from './shared.js';
   export * from './registry.js';
   ```

5. **Update import paths in `packages/mcp-gateway/src/`:**
   - Replace local imports with `@fiberplane/mcp-gateway-types`
   - Example: `import { JsonRpcRequest } from './schemas.js'` → `import { JsonRpcRequest } from '@fiberplane/mcp-gateway-types'`

**Validation:**
- `bun run --filter @fiberplane/mcp-gateway-types build` succeeds
- `bun run --filter @fiberplane/mcp-gateway typecheck` succeeds
- Original package still works: `bun run --filter @fiberplane/mcp-gateway dev`

### Phase 3: Move @fiberplane/mcp-gateway-core

**Goal:** Extract core MCP proxy logic into the core package.

1. **Move registry logic:**
   - Extract functions from `registry.ts` → `packages/core/src/registry/index.ts`
   - Import types from `@fiberplane/mcp-gateway-types`
   - Move `storage.ts` → `packages/core/src/registry/storage.ts`

2. **Move capture logic:**
   - Move `capture.ts` → `packages/core/src/capture/index.ts`
   - Move `sse-parser.ts` → `packages/core/src/capture/sse-parser.ts`

3. **Move infrastructure:**
   - Move `logger.ts` → `packages/core/src/logger.ts`
   - Move `health.ts` → `packages/core/src/health.ts`

4. **Move MCP server creation:**
   - Move `mcp-server.ts` → `packages/core/src/mcp/server.ts`
   - Move `mcp-tools/server-tools.ts` → `packages/core/src/mcp/tools/server-tools.ts`
   - Move `mcp-tools/capture-tools.ts` → `packages/core/src/mcp/tools/capture-tools.ts`

5. **Create exports in `packages/core/src/index.ts`**

6. **Update imports in remaining files:**
   - Replace local imports with `@fiberplane/mcp-gateway-core`

**Validation:**
- `bun run --filter @fiberplane/mcp-gateway-core build` succeeds
- `bun run --filter @fiberplane/mcp-gateway-core test` succeeds
- Original package still works

### Phase 4: Move @fiberplane/mcp-gateway-server

**Goal:** Extract HTTP server into the server package.

1. **Move server files:**
   - Move `server/create-server.ts` → `packages/server/src/app.ts`
   - Move `server/create-proxy-routes.ts` → `packages/server/src/routes/proxy.ts`
   - Move `server/create-oauth-routes.ts` → `packages/server/src/routes/oauth.ts`

2. **Refactor imports:**
   - Use `@fiberplane/mcp-gateway-types` for types
   - Use `@fiberplane/mcp-gateway-core` for core logic
   - Update internal imports to new structure

3. **Create exports in `packages/server/src/index.ts`:**
   ```typescript
   export { createApp } from './app.js';
   ```

4. **Update imports in CLI package:**
   - Replace `./server/index.js` with `@fiberplane/mcp-gateway-server`

**Validation:**
- `bun run --filter @fiberplane/mcp-gateway-server build` succeeds
- Original CLI still works with new server package

### Phase 5: Migrate CLI Package

**Goal:** Finalize the CLI package (keeping @fiberplane/mcp-gateway name).

1. **Reorganize files within `packages/mcp-gateway/`:**
   - Keep `bin/cli.js` as-is (just update import path)
   - Rename `src/run-v2.ts` → `src/cli.ts`
   - Keep `src/events.ts` (TUI-specific events)
   - Move `src/tui-v2/` → `src/tui/`

2. **Update all imports:**
   - Use `@fiberplane/mcp-gateway-types`
   - Use `@fiberplane/mcp-gateway-core`
   - Use `@fiberplane/mcp-gateway-server`

3. **Update `src/index.ts`:**
   ```typescript
   export { runCli } from './cli.js';
   ```

4. **Update `bin/cli.js`:**
   ```javascript
   #!/usr/bin/env node
   import { runCli } from "../dist/cli.js";
   runCli();
   ```

5. **Update `package.json`:**
   - Ensure name is still `@fiberplane/mcp-gateway`
   - Update dependencies to use workspace packages
   - Verify bin entry point

**Validation:**
- `bun run --filter @fiberplane/mcp-gateway build` succeeds
- CLI runs: `bun run --filter @fiberplane/mcp-gateway dev`
- Global install simulation works

### Phase 6: Clean Up Original Package

**Goal:** Remove the old `packages/mcp-gateway/` directory if it was renamed.

If you renamed `packages/mcp-gateway/` → `packages/mcp-gateway/`:
1. Already done! ✅

If you kept `packages/mcp-gateway/` temporarily:
1. Delete `packages/mcp-gateway/src/` (all files should be moved)
2. Verify `packages/mcp-gateway/` has all necessary files
3. Remove `packages/mcp-gateway/` directory entirely

### Phase 7: Update Build and CI Configuration

**Goal:** Ensure all tooling works with the new structure.

1. **Add madge for circular dependency checking:**
   - Add madge to devDependencies: `bun add -D madge`
   - Add script to root `package.json`: `"check-circular": "madge --circular --extensions ts,tsx packages/*/src"`
   - Optional: Add script to generate dependency graph: `"deps-graph": "madge --image deps.svg packages/*/src"`

2. **Update GitHub Actions workflows:**
   - Update build commands to use filters
   - Build command: `bun run --filter @fiberplane/mcp-gateway build`
   - Add circular dependency check step (after install, before typecheck):
     ```yaml
     - name: Check for circular dependencies
       run: bun run check-circular
     ```

3. **Update root scripts in root `package.json`:**
   ```json
   {
     "scripts": {
       "dev": "bun run --filter @fiberplane/mcp-gateway dev",
       "build": "bun run --filter @fiberplane/mcp-gateway build",
       "typecheck": "bun run typecheck",
       "test": "bun test",
       "check-circular": "madge --circular --extensions ts,tsx packages/*/src",
       "deps-graph": "madge --image deps.svg packages/*/src"
     }
   }
   ```

4. **Update changesets config:**
   - Using **independent versioning** (keep `fixed: []` empty)
   - Verify `packages/*` is tracked
   - Ensure test-mcp-server is ignored
   - Verify `access: "public"` for all packages to be published

5. **Update documentation:**
   - Update README.md with new structure
   - Update CLAUDE.md with new package commands
   - Document circular dependency checking

**Validation:**
- `bun run check-circular` passes (no cycles detected)
- CI passes
- All workspace commands work
- Publishing dry-run succeeds

### Phase 8: Comprehensive Testing

**Goal:** Verify everything works end-to-end.

**Tests to run:**

1. **Type checking:**
   ```bash
   bun run typecheck
   ```

2. **Build all packages:**
   ```bash
   bun run --filter @fiberplane/mcp-gateway-types build
   bun run --filter @fiberplane/mcp-gateway-core build
   bun run --filter @fiberplane/mcp-gateway-server build
   bun run --filter @fiberplane/mcp-gateway build
   ```

3. **Run tests:**
   ```bash
   bun test
   ```

4. **CLI functionality:**
   ```bash
   # Dev mode
   bun run --filter @fiberplane/mcp-gateway dev

   # Built version
   cd packages/mcp-gateway
   node bin/cli.js --help
   node bin/cli.js --version
   node bin/cli.js
   ```

5. **Verify TUI works:**
   - Server list renders
   - Can add/remove servers
   - Activity log works
   - Health checks work

6. **Verify backward compatibility:**
   - Package is still named `@fiberplane/mcp-gateway`
   - CLI command is still `mcp-gateway`
   - No API changes

## Rollback Plan

If issues arise during migration:

1. **Revert via Jujutsu:**
   ```bash
   jj restore --from <change-id-before-refactor>
   # or
   jj undo  # Undo last operation
   ```

2. **Incremental rollback:**
   - Each phase creates a checkpoint (description in commit)
   - Can roll back to any phase with `jj restore`
   - Use `jj bookmark` to mark phase completions
   - View history with `jj log` to find specific changes

## Success Criteria

✅ All packages build successfully
✅ All tests pass
✅ CLI works identically to before
✅ TUI functions correctly
✅ Type checking passes
✅ No breaking changes for users
✅ Documentation updated
✅ CI/CD passes
✅ Clean change history with logical commits (jj)

## Post-Refactoring: Future Work

Once this PR is merged, the next PR can add:

### Phase 2 PR: Add Web UI

**New packages to add:**
```
packages/
└── ui/
    └── @fiberplane/mcp-ui
        - React + zustand + tailwind
        - Tanstack Router + Query
        - Vite build
```

**Modifications to existing packages:**
- `@fiberplane/mcp-gateway-types`: Add API route types
- `@fiberplane/mcp-gateway-server`: Add REST API endpoints, serve static UI
- `@fiberplane/mcp-gateway`: Add `--ui` flag, integrate UI server

This refactoring creates the perfect foundation for that work! 🎉

## Notes and Considerations

### Import Path Conventions
- All imports must use `.js` extensions (ESM requirement)
- Use `workspace:*` for internal package dependencies
- Preserve existing external dependencies

### TypeScript Configuration
- Each package extends root `tsconfig.json`
- Project references for incremental builds
- Preserve `"module": "Preserve"` for Hono JSX compatibility

### Build Scripts
- Each package has its own build script
- Reference shared build script at root: `../../scripts/build.ts`
- Consistent build output: `dist/` directory

### Testing Strategy
- Unit tests stay with their respective packages
- Integration tests can live in CLI package
- Test MCP server remains separate workspace

### Documentation Updates
- Update README.md with new structure
- Update CLAUDE.md with new commands
- Keep MIGRATION.md for historical reference
- This document becomes part of repo docs

## Timeline Estimate

- **Phase 1-2:** 2-3 hours (setup + types)
- **Phase 3:** 2-3 hours (core logic)
- **Phase 4:** 1-2 hours (server)
- **Phase 5:** 1-2 hours (CLI)
- **Phase 6-8:** 1-2 hours (cleanup + testing)

**Total:** ~8-12 hours of focused work

## Potential Tight Coupling Issues

Areas that may require special attention during refactoring:

### 1. Logger Initialization
**Current coupling:** `logger.ts` may be initialized in CLI but used everywhere.
**Solution:** Initialize logger in core package with sensible defaults, allow CLI to override.

### 2. Registry Mutation
**Current coupling:** The CLI mutates the registry object in place when TUI updates occur (`run-v2.ts:211-212`).
**Solution:**
- Core should expose registry reload function
- Server should accept a registry ref or use a getter function
- Event system should trigger proper reloads

### 3. Event System (TUI ↔ Server)
**Current coupling:** `events.ts` is used to communicate between TUI and HTTP server (registry updates).
**Solution:**
- Events stay in CLI package (TUI-specific)
- Core exposes callbacks/hooks for registry changes
- Server uses callbacks instead of direct event imports

### 4. Storage Directory Paths
**Current coupling:** Storage directory is passed around to many functions.
**Solution:**
- Core package exports storage utilities
- Functions accept storageDir as parameter (already mostly done)
- CLI orchestrates path passing

### 5. Health Check Callbacks
**Current coupling:** Health checks update TUI store directly (`run-v2.ts:174-183`).
**Solution:**
- Core exports health check function that accepts callback
- CLI provides callback that updates store
- Clean separation maintained

### 6. Session Management
**Current coupling:** Session tracking in schemas.ts uses module-level Map.
**Solution:**
- Move to core package
- Consider making it injectable/configurable
- Document lifetime expectations

### 7. Capture File Generation
**Current coupling:** Capture logic is tightly coupled with storage paths and schemas.
**Solution:**
- Keep in core package as a unit
- Well-defined interface for storage
- Types in types package

### 8. MCP Server Creation
**Current coupling:** MCP server created in core but needs registry/storage from CLI context.
**Solution:**
- Factory function in core accepts dependencies
- CLI provides context
- Already well-structured

### Mitigation Strategy

For each coupling issue:
1. **Identify:** Document the coupling during code review
2. **Design:** Sketch the interface before moving code
3. **Refactor:** Make changes within current package first
4. **Move:** Then move to target package
5. **Verify:** Test at each step

## Questions to Resolve

All questions resolved! ✅

- [x] ~~Should we create a shared build script package?~~ **No** - Keep simple, reference `../../scripts/build.ts`
- [x] ~~Do we want to version packages independently or together?~~ **Independent** - All packages published to npm, proper semver per package
- [x] ~~Should logger be its own package?~~ **No** - Keep in core as singleton
- [x] ~~Should test-mcp-server also be refactored?~~ **No** - Out of scope
- [x] ~~How to handle registry mutation pattern?~~ **Keep current approach** - Works fine, document well
- [x] ~~Should we add circular dependency checking?~~ **Yes** - Use madge in CI (Phase 7)

---

## Benefits and Trade-offs

### ✅ Benefits

**1. Separation of Concerns**
- Types: Zero runtime deps, pure data structures
- Core: Business logic isolated from UI/transport
- Server: HTTP layer independent of CLI
- CLI: Orchestration without business logic

**2. Better Testing**
- Unit test core logic without CLI/server
- Mock interfaces cleanly at package boundaries
- Faster test execution (test only what changed)

**3. Future-Proofing**
- Add web UI without touching core
- Multiple frontends can share core/server
- Deploy server standalone (no CLI)
- Publish core as library for others

**4. Developer Experience**
- Smaller, focused packages
- Clear import paths show dependencies
- TypeScript builds faster (project references)
- Easier onboarding (understand one package at a time)

**5. Maintainability**
- Changes stay local to relevant package
- Breaking changes are explicit (package boundaries)
- Versioning can be independent if needed

### ⚠️ Trade-offs

**1. Initial Complexity**
- More files to navigate initially
- Need to understand package structure
- Import paths are longer

**Mitigation:** Good documentation, clear naming, IDE navigation

**2. Refactoring Effort**
- ~8-12 hours of focused work
- Risk of introducing bugs during move

**Mitigation:** Incremental phases, test at each step, rollback plan

**3. Build Time**
- Potentially longer builds (multiple packages)

**Mitigation:** Project references enable incremental builds, workspace parallelization

### 🎯 Why Now?

This refactoring is the **right time** because:
1. ✅ Project is stable enough (v0.3.3)
2. ✅ Adding UI requires clean boundaries anyway
3. ✅ Current size makes refactoring manageable
4. ✅ Before external API becomes public
5. ✅ While we control all consumers

Doing this later would be harder (more coupling, breaking changes, user impact).

---

## Publishing Strategy

All packages will be published to npm:

- ✅ `@fiberplane/mcp-gateway-types` - Published (dependency of other packages)
- ✅ `@fiberplane/mcp-gateway-core` - Published (dependency of server + cli)
- ✅ `@fiberplane/mcp-gateway-server` - Published (dependency of cli)
- ✅ `@fiberplane/mcp-gateway` - Published (main CLI package users install)

When users run `npm install -g @fiberplane/mcp-gateway`, npm automatically resolves and installs the internal packages from the registry.

**Versioning:** Independent - each package gets its own semantic version reflecting its changes.

**Workspace protocol:** During development, packages use `workspace:*` which gets replaced with actual version ranges (e.g., `^0.4.0`) at publish time.

---

**Status:** Ready for implementation
**Created:** 2025-10-14
**All questions resolved:** ✅
**Next Steps:** Start Phase 1
