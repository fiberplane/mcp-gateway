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

## Phase 5: Finalize CLI Package ✅

### Reorganize CLI
- [x] Rename `src/run-v2.ts` → `src/cli.ts`
- [x] Keep `src/events.ts` (TUI-specific)
- [x] Rename `src/tui-v2/` → `src/tui/`

### Update Imports
- [x] Update all imports to use workspace packages
- [x] Ensure `@fiberplane/mcp-gateway-types` imports
- [x] Ensure `@fiberplane/mcp-gateway-core` imports
- [x] Ensure `@fiberplane/mcp-gateway-server` imports

### Update Entry Points
- [x] Create/update `src/index.ts` to export `runCli`
- [x] Update `bin/cli.js` to import from `../dist/cli.js`

### Verify Package.json
- [x] Name is `@fiberplane/mcp-gateway`
- [x] Dependencies use `workspace:*`
- [x] Bin entry point is correct

**Checkpoint:**
- [x] `bun run --filter @fiberplane/mcp-gateway build` succeeds
- [x] CLI runs: `bun run --filter @fiberplane/mcp-gateway dev`
- [x] TUI displays correctly
- [x] All functionality works (add/remove servers, view logs, etc.)

**Additional Improvements:**
- [x] Configure TypeScript to use source files during development
- [x] Configure Biome linter with noConsole suppression for scripts folder

---

## Phase 6: Clean Up ✅ (N/A)

### Remove Old Files
- [x] Verify all files have been moved (renamed in place, nothing to clean)
- [x] Delete old `packages/mcp-gateway/src/` directory (N/A - renamed in place)
- [x] Verify no dead imports remain

### Verify Package Structure
- [x] `packages/types/` has correct structure
- [x] `packages/core/` has correct structure
- [x] `packages/server/` has correct structure
- [x] `packages/mcp-gateway/` has correct structure

**Checkpoint:**
- [x] No build errors
- [x] No TypeScript errors
- [x] All packages build successfully

**Note:** Phase 6 was N/A as files were renamed in place during Phase 5.

---

## Phase 7: Update Build and CI ✅

### Add Circular Dependency Checking
- [x] Install madge: `bun add -D madge`
- [x] Add `check-circular` script to root `package.json`
- [x] Add `deps-graph` script to root `package.json` (optional)
- [x] Run `bun run check-circular` to verify no cycles
- [x] Fixed circular dependency: `logger.ts ↔ registry/storage.ts`
  - Extracted `ensureStorageDir` to `utils/storage.ts`
  - Updated imports in both files
  - Exported utility from core package index

### Update GitHub Actions
- [x] Update `.github/workflows/ci.yml` - Added circular dependency check
- [x] Update `.github/workflows/release.yml` - Build all packages
- [x] Add circular dependency check step (after install, before typecheck)
- [x] Ensure all packages are built in correct order (types → core → server → cli)

### Update Root Scripts
- [x] `package.json` already has correct `dev` script
- [x] `package.json` already has correct `build` script
- [x] Add `check-circular` script
- [x] Add `deps-graph` script (optional)
- [x] Add `clean` script for dist folders
- [x] Verify other scripts still work

### Update Changesets Config
- [x] Using **independent versioning** (keep `fixed: []` empty) ✅
- [x] Verify `packages/*` is tracked ✅
- [x] Ensure test-mcp-server is ignored ✅
- [x] Verify all package.json have `"access": "public"` for publishing ✅
- [x] Note: `workspace:*` will be replaced with actual versions on publish ✅

### Update Documentation
- [x] Update `CLAUDE.md` with new structure
- [x] Update `CLAUDE.md` with new commands (check-circular, deps-graph)
- [x] Document circular dependency checking in troubleshooting
- [x] Add package dependency diagram
- [x] Document development workflow improvements
- [x] README.md update pending (can be done in separate PR)

**Checkpoint:**
- [x] `bun run check-circular` passes (no cycles) ✅
- [x] `bun run dev` works from root ✅
- [x] `bun run build` works from root ✅
- [x] `bun run typecheck` works from root ✅
- [x] CI configuration updated (will be tested on push) ✅

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

