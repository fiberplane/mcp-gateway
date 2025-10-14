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

### Phase 8: Comprehensive Testing (Optional)

**Goal:** Verify everything works end-to-end.

> **Note:** Most testing has been completed during Phases 1-7. This phase is for final comprehensive validation if needed.

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
   bun bin/cli.js --help
   bun bin/cli.js --version
   bun bin/cli.js
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

### Phase 9: Binary Distribution Strategy

**Goal:** Fix Node.js compatibility by distributing platform-specific Bun binaries through npm.

**Problem:** The current package requires Bun to run because OpenTUI uses Bun-specific APIs (`bun:ffi`). When users install with `npm install -g @fiberplane/mcp-gateway` and try to run with Node.js, it fails.

**Solution:** Compile the application into standalone Bun binaries for each platform and distribute them as optional dependencies, following the pattern used by [opencode](https://github.com/sst/opencode) and [other binary-distributed packages](https://sentry.engineering/blog/publishing-binaries-on-npm).

#### Architecture Overview

```
packages/
├── mcp-gateway/                    # Source code (renamed to mcp-gateway-source)
├── mcp-gateway-linux-x64/          # Platform binary (NEW)
├── mcp-gateway-darwin-arm64/       # Platform binary (NEW)
├── mcp-gateway-darwin-x64/         # Platform binary (NEW)
└── cli/                            # Wrapper package (NEW) - becomes @fiberplane/mcp-gateway
```

**How it works:**
1. User runs `npm install -g @fiberplane/mcp-gateway`
2. npm installs the `cli` package (main package)
3. npm reads `optionalDependencies` and installs only the matching platform binary
4. Postinstall script detects platform and creates symlink to binary
5. `mcp-gateway` command becomes available globally

#### Step 1: Create Binary Build Script

**File:** `scripts/build-binaries.ts`

```typescript
#!/usr/bin/env bun
import { $ } from "bun";
import { mkdir } from "fs/promises";
import { join } from "path";

// Read version from main package
const mainPkg = await Bun.file("./packages/mcp-gateway/package.json").json();
const VERSION = mainPkg.version;

const PLATFORMS = [
  { target: "bun-linux-x64", name: "linux-x64", os: "linux", cpu: "x64", ext: "" },
  { target: "bun-darwin-arm64", name: "darwin-arm64", os: "darwin", cpu: "arm64", ext: "" },
  { target: "bun-darwin-x64", name: "darwin-x64", os: "darwin", cpu: "x64", ext: "" },
];

console.log(`Building binaries v${VERSION} for ${PLATFORMS.length} platforms...\n`);

for (const platform of PLATFORMS) {
  console.log(`📦 Building for ${platform.name}...`);

  const pkgDir = `./packages/mcp-gateway-${platform.name}`;
  await mkdir(pkgDir, { recursive: true });

  // Compile binary
  await $`bun build --compile \
    --target=${platform.target} \
    --minify \
    --bytecode \
    ./packages/mcp-gateway/src/cli.ts \
    --outfile ${pkgDir}/mcp-gateway${platform.ext}`;

  // Make executable
  if (platform.ext === "") {
    await $`chmod +x ${pkgDir}/mcp-gateway`;
  }

  // Create package.json
  const pkgJson = {
    name: `@fiberplane/mcp-gateway-${platform.name}`,
    version: VERSION,
    description: `MCP Gateway binary for ${platform.os}-${platform.cpu}`,
    os: [platform.os],
    cpu: [platform.cpu],
    files: [`mcp-gateway${platform.ext}`],
    publishConfig: {
      access: "public"
    }
  };

  await Bun.write(
    join(pkgDir, "package.json"),
    JSON.stringify(pkgJson, null, 2)
  );

  console.log(`✓ Built ${platform.name}\n`);
}

console.log("✅ All binaries built successfully!");
```

**Usage:** `bun run scripts/build-binaries.ts`

**Validation:**
- Binaries created in `packages/mcp-gateway-{platform}/`
- Each has valid `package.json` with correct `os` and `cpu` fields
- Binaries are executable: `./packages/mcp-gateway-darwin-arm64/mcp-gateway --version`

#### Step 2: Create CLI Wrapper Package

**File:** `packages/cli/package.json`

```json
{
  "name": "@fiberplane/mcp-gateway",
  "version": "0.4.1",
  "description": "Local HTTP proxy for managing and debugging Model Context Protocol servers",
  "type": "module",
  "bin": {
    "mcp-gateway": "./bin/mcp-gateway"
  },
  "scripts": {
    "postinstall": "node postinstall.mjs"
  },
  "optionalDependencies": {
    "@fiberplane/mcp-gateway-linux-x64": "0.4.1",
    "@fiberplane/mcp-gateway-darwin-arm64": "0.4.1",
    "@fiberplane/mcp-gateway-darwin-x64": "0.4.1"
  },
  "publishConfig": {
    "access": "public"
  },
  "homepage": "https://github.com/fiberplane/mcp-gateway",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/fiberplane/mcp-gateway.git"
  },
  "keywords": ["mcp", "model-context-protocol", "proxy", "gateway"],
  "license": "MIT"
}
```

**File:** `packages/cli/postinstall.mjs`

```javascript
#!/usr/bin/env node
import { existsSync, mkdirSync, symlinkSync, chmodSync, copyFileSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Platform detection
const PLATFORM_MAP = {
  "linux-x64": "linux-x64",
  "darwin-x64": "darwin-x64",
  "darwin-arm64": "darwin-arm64",
};

const platform = `${process.platform}-${process.arch}`;
const platformKey = PLATFORM_MAP[platform];

if (!platformKey) {
  console.error(`❌ Unsupported platform: ${platform}`);
  console.error(`   Supported platforms: ${Object.keys(PLATFORM_MAP).join(", ")}`);
  process.exit(1);
}

// Find binary
const binaryName = "mcp-gateway";
const pkgName = `@fiberplane/mcp-gateway-${platformKey}`;
const binaryPath = join(__dirname, "node_modules", pkgName, binaryName);

if (!existsSync(binaryPath)) {
  console.error(`❌ Could not find binary for ${platform}`);
  console.error(`   Expected at: ${binaryPath}`);
  console.error(`   Package ${pkgName} may not have been installed.`);
  process.exit(1);
}

// Create bin directory
const binDir = join(__dirname, "bin");
mkdirSync(binDir, { recursive: true });

const binPath = join(binDir, "mcp-gateway");

// Remove existing symlink/file
if (existsSync(binPath)) {
  unlinkSync(binPath);
}

// Create symlink
try {
  symlinkSync(binaryPath, binPath);
  chmodSync(binPath, 0o755);
  console.log(`✓ Installed mcp-gateway binary for ${platform}`);
} catch (error) {
  console.error(`❌ Failed to create binary symlink: ${error.message}`);
  process.exit(1);
}
```

**Validation:**
- `cd packages/cli && npm install` runs postinstall successfully
- Symlink created at `packages/cli/bin/mcp-gateway`
- Binary works: `packages/cli/bin/mcp-gateway --version`

#### Step 3: Rename Source Package

**Actions:**
1. Rename `packages/mcp-gateway/` package name to `@fiberplane/mcp-gateway-source`
2. Update all internal workspace references
3. Update build scripts to reference new name
4. The new `packages/cli/` becomes the public `@fiberplane/mcp-gateway`

**Package structure after:**
```
packages/
├── types/                          # @fiberplane/mcp-gateway-types
├── core/                           # @fiberplane/mcp-gateway-core
├── server/                         # @fiberplane/mcp-gateway-server
├── mcp-gateway/                    # @fiberplane/mcp-gateway-source (renamed)
├── mcp-gateway-linux-x64/          # @fiberplane/mcp-gateway-linux-x64
├── mcp-gateway-darwin-arm64/       # @fiberplane/mcp-gateway-darwin-arm64
├── mcp-gateway-darwin-x64/         # @fiberplane/mcp-gateway-darwin-x64
└── cli/                            # @fiberplane/mcp-gateway (main)
```

**Validation:**
- No naming conflicts
- `bun run --filter @fiberplane/mcp-gateway-source build` works
- Source package not published (dev only)

#### Step 4: Update CI/CD Workflows

**File:** `.github/workflows/release.yml`

Add steps to build and publish binaries:

```yaml
- name: Build library packages
  run: |
    bun run --filter @fiberplane/mcp-gateway-types build
    bun run --filter @fiberplane/mcp-gateway-core build
    bun run --filter @fiberplane/mcp-gateway-server build
    bun run --filter @fiberplane/mcp-gateway-source build

- name: Build binaries
  run: bun run scripts/build-binaries.ts

- name: Publish library packages
  run: |
    cd packages/types && npm publish --access public
    cd packages/core && npm publish --access public
    cd packages/server && npm publish --access public

- name: Publish platform binaries
  run: |
    for dir in packages/mcp-gateway-*/; do
      if [ -f "$dir/package.json" ]; then
        echo "Publishing $(basename $dir)..."
        cd "$dir"
        npm publish --access public
        cd ../..
      fi
    done
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

- name: Publish CLI wrapper
  run: |
    cd packages/cli
    npm publish --access public
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Add binary testing:**

```yaml
test-binaries:
  needs: build
  strategy:
    matrix:
      os: [ubuntu-latest, macos-13, macos-14]
  runs-on: ${{ matrix.os }}
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
    - run: bun install
    - run: bun run scripts/build-binaries.ts
    - name: Test binary
      run: |
        BINARY=$(ls packages/mcp-gateway-*/mcp-gateway)
        $BINARY --version
        $BINARY --help
```

#### Step 5: Update Documentation

**CLAUDE.md additions:**

```markdown
## Binary Distribution

### Building Binaries

Generate platform-specific binaries:
```bash
bun run scripts/build-binaries.ts
```

This creates:
- `packages/mcp-gateway-linux-x64/mcp-gateway`
- `packages/mcp-gateway-darwin-arm64/mcp-gateway`
- `packages/mcp-gateway-darwin-x64/mcp-gateway`

Each binary includes the full Bun runtime (~90-100MB).

### Platform Support

✅ **Supported:**
- Linux x64
- macOS ARM64 (Apple Silicon)
- macOS x64 (Intel)

🔜 **Future:**
- Windows x64
- Linux ARM64

### Testing Binaries

```bash
# Build binaries
bun run scripts/build-binaries.ts

# Test specific platform
./packages/mcp-gateway-darwin-arm64/mcp-gateway --version

# Test CLI wrapper with npm link
cd packages/cli
npm link
mcp-gateway --version
```
```

**README.md updates:**

```markdown
## Installation

Install globally via npm (works with Node.js):

```bash
npm install -g @fiberplane/mcp-gateway
```

Or use npx:

```bash
npx @fiberplane/mcp-gateway
```

### Platform Support

| Platform | Support |
|----------|---------|
| Linux x64 | ✅ |
| macOS ARM64 (Apple Silicon) | ✅ |
| macOS x64 (Intel) | ✅ |
| Windows x64 | 🔜 Coming soon |
| Linux ARM64 | 🔜 Coming soon |

## Development

Requires Bun for development:

```bash
git clone https://github.com/fiberplane/mcp-gateway
cd mcp-gateway
bun install
bun run dev
```
```

#### Benefits

**For Users:**
- ✅ Works with `npm`/`npx` without Bun installed
- ✅ Fast startup (no transpilation)
- ✅ Small download (only one platform, ~100MB)
- ✅ No runtime dependencies

**For Development:**
- ✅ Cross-platform builds from single CI job
- ✅ Simple release process
- ✅ Version sync across all packages
- ✅ Fits naturally into monorepo

#### Trade-offs

- ⚠️ Binary size: ~90-100MB per platform (includes Bun runtime)
- ⚠️ Build time: ~2-3 minutes for all platforms
- ⚠️ Multiple packages: 4 packages to publish (3 binaries + wrapper)
- ⚠️ Requires Bun for development/CI (not end users)

#### Rollout Plan

**Phase 1: Beta Testing**
- Publish as `@fiberplane/mcp-gateway@next`
- Test with community
- Monitor platform compatibility
- Gather feedback

**Phase 2: Production**
- Promote to `@fiberplane/mcp-gateway@latest`
- Announce on GitHub/Discord
- Monitor download stats per platform

**Phase 3: Expansion**
- Add Windows support
- Add ARM Linux support
- Optimize binary size if needed

**Validation:**
- Local binary builds work on all platforms
- CLI wrapper installs correctly
- `npm install -g @fiberplane/mcp-gateway` works with Node.js
- Binaries run on target platforms
- CI/CD publishes all packages correctly

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
- **Omit file extensions** in imports (using `"moduleResolution": "bundler"`)
  - ✅ `import { foo } from "./foo"` (no extension)
  - ❌ `import { foo } from "./foo.js"` (not needed with bundler mode)
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
