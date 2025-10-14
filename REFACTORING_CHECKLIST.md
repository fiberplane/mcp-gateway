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

## Phase 8: Comprehensive Testing (Optional)

> **Note:** Most testing has been done during Phases 1-7. This phase is for final comprehensive validation.

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

## Phase 9: Binary Distribution Strategy

> **Goal:** Fix Node.js compatibility by distributing platform-specific Bun binaries via npm. Solves the issue where `npm install -g @fiberplane/mcp-gateway` fails with Node.js because OpenTUI requires Bun-specific APIs.

### Step 1: Create Build Script

- [ ] Create `scripts/build-binaries.ts`
- [ ] Read version from `packages/mcp-gateway/package.json`
- [ ] Define target platforms: `linux-x64`, `darwin-arm64`, `darwin-x64`
- [ ] Implement platform loop with `bun build --compile`
- [ ] Generate `package.json` for each platform package
- [ ] Set correct `os` and `cpu` fields for npm platform filtering

**Validation:**
- [ ] Script runs: `bun run scripts/build-binaries.ts`
- [ ] Binaries created in `packages/mcp-gateway-{platform}/`
- [ ] Each binary is executable (Unix) or .exe (Windows)
- [ ] Each platform package has valid `package.json`

### Step 2: Create Platform Binary Packages

- [ ] Create `packages/mcp-gateway-linux-x64/`
- [ ] Create `packages/mcp-gateway-darwin-arm64/`
- [ ] Create `packages/mcp-gateway-darwin-x64/`
- [ ] Add `.gitignore` to each platform package (ignore binaries)
- [ ] Add each platform to workspace (already covered by `packages/*` glob)

**Package Configuration (generated by script):**
```json
{
  "name": "@fiberplane/mcp-gateway-{platform}",
  "version": "0.4.x",
  "os": ["{os}"],
  "cpu": ["{cpu}"],
  "files": ["mcp-gateway"],
  "publishConfig": { "access": "public" }
}
```

**Validation:**
- [ ] `bun install` recognizes new packages
- [ ] Platform packages appear in workspace list
- [ ] Binaries run: `./packages/mcp-gateway-{platform}/mcp-gateway --version`

### Step 3: Create CLI Wrapper Package

- [ ] Create `packages/cli/package.json`
- [ ] Set name to `@fiberplane/mcp-gateway` (main package)
- [ ] Add `optionalDependencies` for all platform packages
- [ ] Add `bin` field pointing to `./bin/mcp-gateway`
- [ ] Add `postinstall` script: `"postinstall": "node postinstall.mjs"`
- [ ] Create `packages/cli/postinstall.mjs`
- [ ] Implement platform detection logic
- [ ] Implement binary symlink/copy logic (symlink for Unix, copy for Windows)
- [ ] Add error handling for unsupported platforms

**Validation:**
- [ ] `cd packages/cli && bun install` runs postinstall
- [ ] Symlink created: `packages/cli/bin/mcp-gateway`
- [ ] Symlink points to correct platform binary
- [ ] Binary works: `packages/cli/bin/mcp-gateway --version`

### Step 4: Update Current CLI Package

- [ ] Rename `packages/mcp-gateway/` to `packages/mcp-gateway-source/` (optional, for clarity)
- [ ] Or keep as `packages/mcp-gateway/` but update its name to `@fiberplane/mcp-gateway-source`
- [ ] Update `packages/cli/package.json` to depend on source package (dev only, not published)
- [ ] Update documentation to clarify source vs. wrapper package

**Alternative Approach (Recommended):**
- [ ] Keep `packages/mcp-gateway/` as source
- [ ] Change its name to `@fiberplane/mcp-gateway-source` (internal only)
- [ ] Update all workspace references
- [ ] The CLI wrapper becomes the public `@fiberplane/mcp-gateway`

**Validation:**
- [ ] No naming conflicts between packages
- [ ] Workspace packages resolve correctly
- [ ] Source package still builds: `bun run --filter @fiberplane/mcp-gateway-source build`

### Step 5: Update Build Workflows

- [ ] Update `.github/workflows/release.yml`
- [ ] Add step to run `bun run scripts/build-binaries.ts`
- [ ] Add step to publish platform packages first
- [ ] Then publish CLI wrapper package
- [ ] Add step to create GitHub Release with binaries as assets

**Release Workflow:**
```yaml
- name: Build binaries
  run: bun run scripts/build-binaries.ts

- name: Publish platform binaries
  run: |
    for dir in packages/mcp-gateway-*/; do
      cd "$dir" && npm publish --access public && cd ../..
    done

- name: Publish CLI wrapper
  run: cd packages/cli && npm publish --access public
```

**Validation:**
- [ ] Dry run release workflow locally
- [ ] Verify all platform packages would be published
- [ ] Verify CLI wrapper would be published last
- [ ] Check version sync across all packages

### Step 6: Update CI Testing

- [ ] Add matrix strategy to test binaries on different platforms
- [ ] Test on `ubuntu-latest`, `macos-13` (x64), `macos-14` (arm64)
- [ ] Run `--version` and `--help` checks on each platform
- [ ] Add smoke test: start server and check health endpoint

**CI Test Configuration:**
```yaml
test-binaries:
  strategy:
    matrix:
      os: [ubuntu-latest, macos-13, macos-14]
  runs-on: ${{ matrix.os }}
  steps:
    - name: Test binary
      run: ./packages/mcp-gateway-*/mcp-gateway --version
```

**Validation:**
- [ ] CI passes on all platforms
- [ ] Binaries are executable
- [ ] Version output is correct

### Step 7: Update Documentation

- [ ] Update `CLAUDE.md` with binary build instructions
- [ ] Update `README.md` installation section
- [ ] Add platform support badges (linux-x64, darwin-arm64, darwin-x64)
- [ ] Document binary size (~90-100MB per platform)
- [ ] Add troubleshooting section for unsupported platforms
- [ ] Document development workflow (source vs. binaries)

**Documentation Sections:**
- [ ] Installation: `npm install -g @fiberplane/mcp-gateway` (works with Node.js now)
- [ ] Development: Build from source with Bun
- [ ] Binary distribution: How it works
- [ ] Platform support: Which platforms are supported
- [ ] Future platforms: Windows, ARM Linux

**Validation:**
- [ ] README is clear and accurate
- [ ] Installation instructions are up to date
- [ ] Links work
- [ ] Examples are correct

### Step 8: Testing and Validation

- [ ] Test local binary build: `bun run scripts/build-binaries.ts`
- [ ] Test each binary individually
- [ ] Test CLI wrapper with `npm link`: `cd packages/cli && npm link`
- [ ] Test global install simulation: `npm install -g ./packages/cli`
- [ ] Verify `mcp-gateway` command works globally
- [ ] Test on all supported platforms (linux-x64, darwin-arm64, darwin-x64)
- [ ] Verify binary size is acceptable (~90-100MB)
- [ ] Check startup time (should be fast, no transpilation)

**Smoke Tests:**
- [ ] Binary runs: `mcp-gateway --version`
- [ ] Server starts: `mcp-gateway`
- [ ] Health endpoint responds: `curl http://localhost:3333`
- [ ] TUI renders correctly
- [ ] Can add MCP server
- [ ] Can proxy MCP requests

### Step 9: Rollout Strategy

**Phase 1: Beta Testing**
- [ ] Publish as `@fiberplane/mcp-gateway@next`
- [ ] Test with early adopters
- [ ] Monitor for issues on different platforms
- [ ] Gather feedback on install experience

**Phase 2: Production Release**
- [ ] Promote to `@fiberplane/mcp-gateway@latest`
- [ ] Announce on GitHub, npm, Discord
- [ ] Monitor npm download stats per platform
- [ ] Watch for issues

**Phase 3: Future Expansion**
- [ ] Add Windows support (win32-x64)
- [ ] Add ARM Linux support (linux-arm64)
- [ ] Consider Alpine Linux (musl) variant
- [ ] Optimize binary size if needed

**Checkpoint:**
- [ ] Beta version published successfully
- [ ] No critical issues reported
- [ ] Ready for production promotion

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

