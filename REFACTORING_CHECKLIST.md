# Package Refactoring - Implementation Checklist

> Track progress during refactoring. Check off items as completed.

## Pre-Flight Checks

- [ ] Read full [REFACTORING_PLAN.md](./REFACTORING_PLAN.md)
- [ ] Understand tight coupling issues
- [ ] Create feature branch: `jj branch create feat/package-refactoring`
- [ ] Ensure clean working directory: `jj status`
- [ ] Bookmark current state: `jj bookmark pre-refactoring`

---

## Phase 1: Create Package Structure

### Directory Setup
- [ ] Create `packages/types/src/`
- [ ] Create `packages/core/src/{registry,capture,mcp/tools}`
- [ ] Create `packages/server/src/routes/`
- [ ] Create `packages/mcp-gateway/src/`
- [ ] Rename `packages/mcp-gateway/` → `packages/mcp-gateway/` (or keep temporarily)

### Package Configuration
- [ ] Create `packages/types/package.json`
- [ ] Create `packages/core/package.json`
- [ ] Create `packages/server/package.json`
- [ ] Update `packages/mcp-gateway/package.json` (ensure name is `@fiberplane/mcp-gateway`)
- [ ] Create `packages/types/tsconfig.json`
- [ ] Create `packages/core/tsconfig.json`
- [ ] Create `packages/server/tsconfig.json`
- [ ] Update `packages/mcp-gateway/tsconfig.json`

### Root Configuration
- [ ] Update root `tsconfig.json` with project references
- [ ] Update root `package.json` workspaces
- [ ] Update `.changeset/config.json`
- [ ] Run `bun install` and verify workspaces

**Checkpoint:** `bun install` succeeds, all workspaces recognized

---

## Phase 2: @fiberplane/mcp-gateway-types

### Move Files
- [ ] Copy `packages/mcp-gateway/src/schemas.ts` → `packages/types/src/schemas.ts`
- [ ] Copy `packages/mcp-gateway/src/types.ts` → `packages/types/src/shared.ts`
- [ ] Extract types from `packages/mcp-gateway/src/registry.ts` → `packages/types/src/registry.ts`
  - [ ] `ServerHealth` type
  - [ ] `McpServer` interface
  - [ ] `Registry` interface

### Create Index
- [ ] Create `packages/types/src/index.ts` with exports

### Update Imports
- [ ] Search for `from './schemas'` in `packages/mcp-gateway/src/`
- [ ] Replace with `from '@fiberplane/mcp-gateway-types'`
- [ ] Search for `from './types'`
- [ ] Replace with `from '@fiberplane/mcp-gateway-types'`
- [ ] Update registry type imports

**Checkpoint:**
- [ ] `bun run --filter @fiberplane/mcp-gateway-types build` succeeds
- [ ] `bun run --filter @fiberplane/mcp-gateway typecheck` succeeds
- [ ] `bun run --filter @fiberplane/mcp-gateway dev` works

---

## Phase 3: @fiberplane/mcp-gateway-core

### Move Registry
- [ ] Move functions from `registry.ts` → `packages/core/src/registry/index.ts`
  - [ ] Keep types in mcp-types, import them
- [ ] Move `storage.ts` → `packages/core/src/registry/storage.ts`
- [ ] Update imports in moved files

### Move Capture
- [ ] Move `capture.ts` → `packages/core/src/capture/index.ts`
- [ ] Move `sse-parser.ts` → `packages/core/src/capture/sse-parser.ts`
- [ ] Update imports in moved files

### Move Infrastructure
- [ ] Move `logger.ts` → `packages/core/src/logger.ts`
- [ ] Move `health.ts` → `packages/core/src/health.ts`
- [ ] Update imports in moved files

### Move MCP Server
- [ ] Move `mcp-server.ts` → `packages/core/src/mcp/server.ts`
- [ ] Move `mcp-tools/server-tools.ts` → `packages/core/src/mcp/tools/server-tools.ts`
- [ ] Move `mcp-tools/capture-tools.ts` → `packages/core/src/mcp/tools/capture-tools.ts`
- [ ] Update imports in moved files

### Create Index
- [ ] Create `packages/core/src/index.ts` with exports
- [ ] Export registry functions
- [ ] Export storage functions
- [ ] Export capture functions
- [ ] Export logger
- [ ] Export health
- [ ] Export MCP server

### Update Imports in Original Package
- [ ] Replace registry imports with `@fiberplane/mcp-gateway-core`
- [ ] Replace storage imports with `@fiberplane/mcp-gateway-core`
- [ ] Replace capture imports with `@fiberplane/mcp-gateway-core`
- [ ] Replace logger imports with `@fiberplane/mcp-gateway-core`
- [ ] Replace health imports with `@fiberplane/mcp-gateway-core`
- [ ] Replace MCP server imports with `@fiberplane/mcp-gateway-core`

**Checkpoint:**
- [ ] `bun run --filter @fiberplane/mcp-gateway-core build` succeeds
- [ ] `bun run --filter @fiberplane/mcp-gateway-core test` succeeds (if tests exist)
- [ ] `bun run --filter @fiberplane/mcp-gateway typecheck` succeeds
- [ ] `bun run --filter @fiberplane/mcp-gateway dev` works

---

## Phase 4: @fiberplane/mcp-gateway-server

### Move Server Files
- [ ] Move `server/create-server.ts` → `packages/server/src/app.ts`
- [ ] Move `server/create-proxy-routes.ts` → `packages/server/src/routes/proxy.ts`
- [ ] Move `server/create-oauth-routes.ts` → `packages/server/src/routes/oauth.ts`
- [ ] Update imports in moved files to use `@fiberplane/mcp-gateway-core` and `@fiberplane/mcp-gateway-types`

### Create Index
- [ ] Create `packages/server/src/index.ts`
- [ ] Export `createApp` function

### Update CLI Imports
- [ ] Replace `./server/index` with `@fiberplane/mcp-gateway-server` in CLI

**Checkpoint:**
- [ ] `bun run --filter @fiberplane/mcp-gateway-server build` succeeds
- [ ] `bun run --filter @fiberplane/mcp-gateway typecheck` succeeds
- [ ] `bun run --filter @fiberplane/mcp-gateway dev` works
- [ ] Can connect to server, proxy requests work

---

## Phase 5: Finalize CLI Package

### Reorganize CLI
- [ ] Rename `src/run-v2.ts` → `src/cli.ts`
- [ ] Keep `src/events.ts` (TUI-specific)
- [ ] Rename `src/tui-v2/` → `src/tui/`

### Update Imports
- [ ] Update all imports to use workspace packages
- [ ] Ensure `@fiberplane/mcp-gateway-types` imports
- [ ] Ensure `@fiberplane/mcp-gateway-core` imports
- [ ] Ensure `@fiberplane/mcp-gateway-server` imports

### Update Entry Points
- [ ] Create/update `src/index.ts` to export `runCli`
- [ ] Update `bin/cli.js` to import from `../dist/cli.js`

### Verify Package.json
- [ ] Name is `@fiberplane/mcp-gateway`
- [ ] Dependencies use `workspace:*`
- [ ] Bin entry point is correct

**Checkpoint:**
- [ ] `bun run --filter @fiberplane/mcp-gateway build` succeeds
- [ ] CLI runs: `bun run --filter @fiberplane/mcp-gateway dev`
- [ ] TUI displays correctly
- [ ] All functionality works (add/remove servers, view logs, etc.)

---

## Phase 6: Clean Up

### Remove Old Files
- [ ] Verify all files have been moved
- [ ] Delete old `packages/mcp-gateway/src/` directory (if kept temporarily)
- [ ] Verify no dead imports remain

### Verify Package Structure
- [ ] `packages/types/` has correct structure
- [ ] `packages/core/` has correct structure
- [ ] `packages/server/` has correct structure
- [ ] `packages/mcp-gateway/` has correct structure

**Checkpoint:**
- [ ] No build errors
- [ ] No TypeScript errors
- [ ] All packages build successfully

---

## Phase 7: Update Build and CI

### Add Circular Dependency Checking
- [ ] Install madge: `bun add -D madge`
- [ ] Add `check-circular` script to root `package.json`
- [ ] Add `deps-graph` script to root `package.json` (optional)
- [ ] Run `bun run check-circular` to verify no cycles
- [ ] Optional: Generate dependency graph with `bun run deps-graph`

### Update GitHub Actions
- [ ] Update `.github/workflows/*.yml` build commands
- [ ] Use `bun run --filter @fiberplane/mcp-gateway build`
- [ ] Add circular dependency check step (after install, before typecheck)
- [ ] Ensure all packages are built in correct order

### Update Root Scripts
- [ ] Update `package.json` dev script
- [ ] Update `package.json` build script
- [ ] Add `check-circular` script
- [ ] Add `deps-graph` script (optional)
- [ ] Verify other scripts still work

### Update Changesets Config
- [ ] Using **independent versioning** (keep `fixed: []` empty)
- [ ] Verify `packages/*` is tracked
- [ ] Ensure test-mcp-server is ignored
- [ ] Verify all package.json have `"access": "public"` for publishing
- [ ] Note: `workspace:*` will be replaced with actual versions on publish

### Update Documentation
- [ ] Update `README.md` with new structure
- [ ] Update `CLAUDE.md` with new commands
- [ ] Document circular dependency checking
- [ ] Keep `MIGRATION.md` for reference
- [ ] Add link to refactoring plan in docs

**Checkpoint:**
- [ ] `bun run check-circular` passes (no cycles)
- [ ] `bun run dev` works from root
- [ ] `bun run build` works from root
- [ ] `bun run typecheck` works from root
- [ ] CI passes (run locally or push to branch)

---

## Phase 8: Comprehensive Testing

### Type Checking
- [ ] `bun run typecheck` passes
- [ ] No TypeScript errors in any package

### Build All Packages
- [ ] `bun run --filter @fiberplane/mcp-gateway-types build` succeeds
- [ ] `bun run --filter @fiberplane/mcp-gateway-core build` succeeds
- [ ] `bun run --filter @fiberplane/mcp-gateway-server build` succeeds
- [ ] `bun run --filter @fiberplane/mcp-gateway build` succeeds

### Run Tests
- [ ] `bun test` passes
- [ ] All test suites succeed
- [ ] No skipped tests that should run

### CLI Functionality
- [ ] `--help` flag works
- [ ] `--version` flag works
- [ ] Default port (3333) works
- [ ] Custom `--port` works
- [ ] Custom `--storage-dir` works

### TUI Functionality
- [ ] TUI renders correctly
- [ ] Can navigate with keyboard
- [ ] Can add new server
- [ ] Can remove server
- [ ] Activity log updates
- [ ] Health checks work
- [ ] Can view server details
- [ ] Can export config
- [ ] Command menu works

### HTTP Server Functionality
- [ ] Server starts on correct port
- [ ] Health endpoint works: `GET /`
- [ ] Status endpoint works: `GET /status`
- [ ] Proxy routes work: `/servers/:server/mcp` and `/s/:server/mcp`
- [ ] Gateway MCP tools work: `/gateway/mcp` and `/g/mcp`
- [ ] OAuth discovery works: `/.well-known/oauth-authorization-server`

### Integration Testing
- [ ] Connect MCP client to proxy
- [ ] Proxy forwards requests correctly
- [ ] Captures are recorded
- [ ] Server metrics update
- [ ] Health checks run and update status

### Backward Compatibility
- [ ] Package is still named `@fiberplane/mcp-gateway`
- [ ] CLI command is still `mcp-gateway`
- [ ] No user-facing API changes
- [ ] Existing configs still work

---

## Final Checks

### Code Quality
- [ ] Run linter: `bun run lint`
- [ ] Format code: `bun run format`
- [ ] No console.log or debugging code left
- [ ] All TODOs addressed or documented

### Version Control (Jujutsu)
- [ ] Review all changes: `jj diff`
- [ ] Commit logical chunks: `jj commit -m "Phase X: Description"`
- [ ] Write clear descriptions for each change
- [ ] Create bookmarks for major phases (optional): `jj bookmark phase-1-complete`
- [ ] Push to remote: `jj git push`
- [ ] Open PR with summary

### PR Description
- [ ] Link to REFACTORING_PLAN.md
- [ ] List breaking changes (should be zero!)
- [ ] Include testing notes
- [ ] Add screenshots of TUI (if applicable)

### Documentation
- [ ] README updated
- [ ] CLAUDE.md updated
- [ ] CHANGELOG prepared (if needed)

---

## Success Criteria

- [x] All packages build ✅
- [x] All tests pass ✅
- [x] Type checking succeeds ✅
- [x] CLI works identically ✅
- [x] TUI functions correctly ✅
- [x] HTTP server works ✅
- [x] Zero breaking changes ✅
- [x] Documentation updated ✅
- [x] CI passes ✅

## Post-Merge

- [ ] Tag release (if appropriate)
- [ ] Monitor for issues
- [ ] Prepare for Phase 2: Web UI development

---

**Notes:**

Use this space for tracking blockers, issues, or decisions made during implementation.

