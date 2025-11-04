# Monorepo Development Guide

Complete guide for developing in the MCP Gateway monorepo, including structure, workflow, and package management.

**Table of Contents:**
- [Monorepo Structure](#monorepo-structure)
- [Development Workflow](#development-workflow)
- [Adding New Packages](#adding-new-packages)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

---

## Monorepo Structure

### Overview

The MCP Gateway monorepo is built using Bun workspaces and follows modern monorepo practices for maintainability, scalability, and developer experience.

### Directory Structure

```
mcp-gateway/
├── packages/                    # Published packages
│   ├── types/                  # @fiberplane/mcp-gateway-types
│   ├── core/                   # @fiberplane/mcp-gateway-core
│   ├── api/                    # @fiberplane/mcp-gateway-api
│   ├── server/                 # @fiberplane/mcp-gateway-server
│   ├── web/                    # @fiberplane/mcp-gateway-web
│   ├── cli/                    # @fiberplane/mcp-gateway (public wrapper)
│   └── mcp-gateway/            # @fiberplane/mcp-gateway-cli (private source)
├── test-mcp-server/            # Development testing server
├── docs/                       # Documentation
├── .github/workflows/          # CI/CD pipelines
├── .changeset/                 # Version management
├── scripts/                    # Shared build/dev scripts
├── package.json                # Workspace root configuration
├── tsconfig.json               # Root TypeScript config
├── biome.jsonc                 # Linting/formatting config
└── bun.lockb                   # Dependency lockfile
```

### Package Types

#### Published Packages (`packages/`)

**Purpose:** Packages distributed to npm

**Naming:** `@fiberplane/package-name`

**Structure:** Standard with `src/`, `dist/`, tests

**Build:** Individual build scripts, shared tooling

**Packages:**
- `types` - Pure types and Zod schemas (no runtime deps)
- `core` - Business logic (registry, capture, logs, health, logger, MCP server)
- `api` - REST API for querying logs (uses dependency injection)
- `server` - MCP protocol HTTP server (proxy, OAuth, gateway MCP server)
- `web` - React-based web UI for browsing logs
- `mcp-gateway-cli` (private) - CLI orchestrator (mounts server + API + web UI)
- `mcp-gateway` (public) - Wrapper package for binary distribution

#### Development Packages (root level)

**Purpose:** Development tools, testing, examples

**Naming:** Simple names (e.g., `test-mcp-server`)

**Structure:** Minimal, focused on functionality

**Publishing:** Marked as private, not published

### Package Dependencies

```
types (no deps) → core (types) → api (core types only, DI) → cli (orchestrates all)
                                ↘ server (core, MCP protocol) ↗
                                ↘ web (api client) ↗
```

**Key Points:**
- No circular dependencies (enforced by `madge` in CI)
- API uses dependency injection for query functions
- Server focuses on MCP protocol only
- CLI orchestrates everything

### Configuration Architecture

#### Workspace Configuration

```json
{
  "workspaces": [
    "packages/*",
    "test-mcp-server"
  ],
  "type": "module"
}
```

#### TypeScript Project References

```json
{
  "references": [
    { "path": "./packages/types" },
    { "path": "./packages/core" },
    { "path": "./packages/api" },
    { "path": "./packages/server" },
    { "path": "./packages/web" },
    { "path": "./packages/mcp-gateway" },
    { "path": "./test-mcp-server" }
  ]
}
```

**Why Project References?**
- **Incremental builds:** Only rebuild changed packages
- **Type checking:** Cross-package type safety and imports
- **IDE support:** Go-to-definition across packages
- **Build coordination:** `bun run typecheck` works efficiently

**Important:** Each package must be explicitly listed - TypeScript doesn't support wildcards like `./packages/*`

#### Build System

- **Runtime:** Bun (replaces Node.js/npm)
- **Build Tool:** Custom TypeScript builds via `scripts/build.ts`
- **Bundling:** Bun's built-in bundler
- **Type Generation:** TypeScript compiler

### Dependency Management

#### Workspace Dependencies

```json
{
  "dependencies": {
    "@fiberplane/mcp-gateway-core": "workspace:*"
  }
}
```

Use `"workspace:*"` for internal dependencies. During development, packages use source `.ts` files directly. During publishing, `workspace:*` is replaced with actual version ranges.

#### External Dependencies

- **Production:** Added to individual packages
- **Development:** Consolidated at root level
- **Management:** Bun package manager

#### Version Pinning

- **Exact versions:** For critical dependencies
- **Ranges:** For development dependencies
- **Workspace protocol:** For internal packages

---

## Development Workflow

### Quick Start

```bash
# Clone and setup
git clone <repo-url>
cd mcp-gateway
bun install

# Start development
bun run dev                    # Main package development mode
bun run --filter test-mcp-server dev  # Test server
```

### Common Development Tasks

#### Starting Development Environment

**Main Package Development:**
```bash
# Start the main MCP Gateway in development mode
bun run dev

# Alternative: explicit filter
bun run --filter @fiberplane/mcp-gateway-cli dev
```

**Test Server Development:**
```bash
# Start test MCP server
bun run --filter test-mcp-server dev

# Start comprehensive test server
bun run --filter test-mcp-server start:comprehensive
```

**Full Stack Development:**
```bash
# Terminal 1: Main gateway
bun run dev

# Terminal 2: Test server
bun run --filter test-mcp-server dev

# Terminal 3: Web UI dev server (with hot reload)
bun run --filter @fiberplane/mcp-gateway-web dev
```

**Web UI Development:**
```bash
# Start Vite dev server with hot reload
bun run --filter @fiberplane/mcp-gateway-web dev

# Build for production
bun run --filter @fiberplane/mcp-gateway-web build
```

#### Code Quality Checks

**Type Checking:**
```bash
# Check all packages
bun run typecheck

# Check specific package
bun run --filter @fiberplane/mcp-gateway-core typecheck
```

**Linting and Formatting:**
```bash
# Check for issues
bun run lint

# Fix auto-fixable issues
bun run format

# Check specific files
biome check src/specific-file.ts
```

#### Building and Testing

**Building:**
```bash
# Build all packages in dependency order
bun run build

# Build specific package
bun run --filter @fiberplane/mcp-gateway-core build

# Build binaries (current platform)
bun run build:binaries

# Clean build (remove dist first)
bun run clean && bun run build
```

**Testing:**
```bash
# Run all tests (uses each workspace's bunfig.toml)
bun run test

# Run specific package tests
bun run --filter @fiberplane/mcp-gateway-cli test

# Run tests with coverage
bun test --coverage

# Watch mode
bun test --watch
```

**Important:** Use `bun run test` instead of `bun test` from root. This ensures each workspace uses its own `bunfig.toml` configuration. The web package requires happy-dom for React tests, which conflicts with CLI tests if loaded globally.

#### Dependency Management

**Adding Dependencies:**
```bash
# To core package
cd packages/core
bun add express @types/express

# To test server
cd test-mcp-server
bun add some-test-utility

# Dev dependencies to root
bun add -D @types/node
```

**Updating Dependencies:**
```bash
# Update all dependencies
bun update

# Update specific dependency
bun update express

# Update to latest versions
bun update --latest
```

**Workspace Dependencies:**
```bash
# Add workspace dependency
cd packages/new-package
bun add @fiberplane/mcp-gateway-core@workspace:*
```

### Commands Structure

```json
{
  "scripts": {
    "dev": "bun run --filter @fiberplane/mcp-gateway-cli dev",
    "build": "bun run --filter @fiberplane/mcp-gateway-cli build",
    "build:binaries": "bun run scripts/build-binaries.ts",
    "typecheck": "bun run --filter '*' typecheck",
    "lint": "biome check .",
    "format": "biome format --write .",
    "test": "bun run --filter '*' test",
    "clean": "rm -rf packages/*/dist"
  }
}
```

### Package-Specific Operations

```bash
# Build specific package
bun run --filter @fiberplane/mcp-gateway-core build

# Run tests for specific package
bun run --filter @fiberplane/mcp-gateway-core test

# Development mode for specific package
bun run --filter @fiberplane/mcp-gateway-web dev
```

### Git Workflow

#### Branch Strategy

- `main` - Stable release branch
- `feature/description` - Feature branches
- `fix/description` - Bug fix branches

#### Commit Guidelines

```bash
# Conventional commits
feat: add new MCP server configuration
fix: resolve connection timeout issue
docs: update API documentation
test: add integration tests for proxy

# With scope
feat(server): add health check endpoint
fix(cli): handle invalid server URLs
```

#### Making Changes

```bash
# Create feature branch
git checkout -b feature/add-server-monitoring

# Make changes, commit regularly
git add .
git commit -m "feat: add basic server monitoring"

# Push and create PR
git push -u origin feature/add-server-monitoring
```

### Release Workflow

#### Creating Changesets

```bash
# Create changeset for your changes
bun changeset

# Follow prompts to:
# 1. Select packages that changed (@fiberplane/mcp-gateway only!)
# 2. Choose semver bump (patch/minor/major)
# 3. Write changelog entry
```

**CRITICAL:** When making changes to ANY internal package, ALWAYS create a changeset for `@fiberplane/mcp-gateway`, not for the package you modified. All internal packages are private and ignored by changesets.

#### Changeset Examples

```bash
# Patch release (bug fix)
patch: Fix connection timeout in proxy

# Minor release (new feature)
minor: Add health check endpoints

# Major release (breaking change)
major: Restructure configuration format
```

#### Validation

Always validate before committing:
```bash
bun run changeset:check
```

This ensures changesets are correctly formatted and won't cause CI failures.

#### Version Management

```bash
# Preview version bumps (dry run)
bun changeset version --snapshot

# Apply version bumps (done by CI)
bun changeset version

# Publish packages (done by CI)
bun changeset publish
```

### Debugging

#### Development Debugging

```bash
# Enable debug logging
DEBUG=mcp-gateway:* bun run dev

# Run with Node.js debugger
bun --inspect run src/index.ts

# Verbose output
bun run dev --verbose
```

#### Build Debugging

```bash
# Check TypeScript compilation
bun tsc --noEmit --project packages/core/tsconfig.json

# Check build output
ls -la packages/core/dist/

# Check circular dependencies
bun run check-circular
```

#### Test Debugging

```bash
# Run specific test with output
bun test packages/cli/tests/cli.test.ts --verbose

# Debug test failures
bun test --reporter=verbose

# Run single test
bun test -t "specific test name"
```

### IDE Setup

#### VS Code Configuration

Create `.vscode/settings.json`:
```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome"
}
```

#### Recommended Extensions

- Biome (biomejs.biome)
- TypeScript and JavaScript Language Features
- Bun for Visual Studio Code

### Performance Tips

#### Build Performance

```bash
# Use incremental builds
bun tsc --build --incremental

# Parallel type checking
bun run typecheck

# Skip type checking during development
bun --no-check src/index.ts
```

#### Development Performance

```bash
# Use watch mode efficiently
bun --watch src/index.ts

# Limit file watching
bun --watch --ignore node_modules src/index.ts
```

### Environment Variables

#### Development

```bash
# .env.local
DEBUG=mcp-gateway:*
MCP_GATEWAY_STORAGE=./dev-storage
NODE_ENV=development
```

#### Testing

```bash
# Test environment
NODE_ENV=test
MCP_GATEWAY_STORAGE=./test-storage
```

---

## Adding New Packages

### Quick Reference

#### Package Structure

```
packages/your-package-name/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

#### Required Files

**package.json Template:**
```json
{
  "name": "@fiberplane/your-package-name",
  "version": "0.0.0",
  "type": "module",
  "description": "Your package description",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "bun run ../../scripts/build.ts",
    "dev": "bun run --watch src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

**tsconfig.json Template:**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

### Step-by-Step Process

#### 1. Create Package Structure

```bash
mkdir -p packages/your-package-name/src
cd packages/your-package-name
```

#### 2. Initialize Package Files

Create the package.json and tsconfig.json files using the templates above.

#### 3. Create Source Files

```bash
echo 'export const hello = () => "Hello from your-package-name";' > src/index.ts
```

#### 4. Update Root Configuration

Add your package to the root `tsconfig.json` references section:
```json
{
  "references": [
    { "path": "./packages/types" },
    { "path": "./packages/core" },
    { "path": "./packages/your-package-name" },  // <- Add here
    // ... other packages
  ]
}
```

#### 5. Install and Build

```bash
# From root directory
bun install
bun run --filter @fiberplane/your-package-name build
bun run typecheck
```

### Configuration Requirements

**Workspace Dependencies:**
- Use `"workspace:*"` for internal dependencies
- Add external dependencies normally with `bun add`

**Build System Integration:**
- All packages use shared build script: `"build": "bun run ../../scripts/build.ts"`
- Build outputs go to `dist/` directory
- TypeScript declarations are generated automatically

**Publishing Configuration:**
- Packages are automatically discovered by changesets
- GitHub workflows build and publish all packages in `packages/*`
- Use `bun changeset` to create version bumps

### Package Types

#### Library Packages

Standard TypeScript libraries that export functions/classes:
- Use ES modules (`"type": "module"`)
- Export from `src/index.ts`
- Build to `dist/` with types

#### CLI Packages

Command-line tools:
- Add `bin` field in package.json
- Create executable in `src/cli.ts`
- Use `#!/usr/bin/env node` shebang

#### Internal Packages

Packages only used within the monorepo:
- Set `"private": true`
- Don't need publishing configuration
- Can be utilities, shared configs, etc.

### Testing New Packages

**Basic Validation:**
```bash
# Type check
bun run typecheck

# Build
bun run --filter @fiberplane/your-package-name build
```

**Integration Testing:**
```bash
# Add to another package
cd packages/mcp-gateway
bun add @fiberplane/your-package-name@workspace:*

# Use in code
import { hello } from '@fiberplane/your-package-name';
```

### Common Patterns

**Shared Utilities Package:**
```bash
mkdir -p packages/utils/src
# Add utility functions, shared types, constants
```

**Plugin Package:**
```bash
mkdir -p packages/plugin-name/src
# Add MCP gateway extensions, middleware
```

**CLI Extensions:**
```bash
mkdir -p packages/cli-tools/src
# Add command-line utilities, scripts
```

---

## Configuration

### Version Management

#### Changesets Integration

- **Tool:** @changesets/cli
- **Configuration:** `.changeset/config.json`
- **Workflow:** Manual changeset creation → automated versioning

#### Release Process

1. Developer creates changeset: `bun changeset`
2. CI creates version PR with `changeset version`
3. Merge triggers publish with `changeset publish`

#### Package Tracking

```json
{
  "packages": ["packages/mcp-gateway"],
  "ignore": [
    "packages/types",
    "packages/core",
    "packages/api",
    "packages/server",
    "packages/web",
    "packages/mcp-gateway-cli",
    "test-mcp-server"
  ]
}
```

Only `@fiberplane/mcp-gateway` (the public wrapper) is versioned. Other packages are private and bundled.

### CI/CD Architecture

#### Workflow Triggers

- **CI:** Pull requests to main
- **Release:** Pushes to main branch

#### Job Structure

```yaml
jobs:
  test:
    - Install dependencies
    - Check circular dependencies
    - Type check all packages
    - Lint all files
    - Build all packages
    - Run tests

  release:
    - Install dependencies
    - Type check & lint
    - Build packages
    - Create release PR or publish
```

#### Environment Requirements

- **Bun:** Latest version via oven-sh/setup-bun@v2
- **Node.js:** v22 for npm publishing
- **Secrets:** GITHUB_TOKEN, NPM_TOKEN

### Tooling Stack

#### Runtime & Package Management

- **Bun:** Primary runtime and package manager
- **Node.js:** Fallback for npm publishing

#### Code Quality

- **TypeScript:** Type safety and compilation
- **Biome:** Linting and formatting
- **Project References:** Composite builds
- **Madge:** Circular dependency detection

#### Development

- **Watch Mode:** `bun --watch` for development
- **Hot Reload:** Automatic restart on changes
- **Type Checking:** Continuous via composite projects

### Conventions & Standards

#### File Naming

- **Packages:** kebab-case (`mcp-gateway`)
- **Files:** kebab-case (`server-tools.ts`)
- **Exports:** camelCase functions, PascalCase classes

#### Import/Export Patterns

```typescript
// Barrel exports from index.ts
export { ServerManager } from './server-manager.js';
export { type ServerConfig } from './types.js';

// Internal imports with .js extension
import { ServerManager } from './server-manager.js';
```

#### TypeScript Configuration

- **Module:** "Preserve" for Hono JSX compatibility
- **Target:** ESNext
- **Strict:** Enabled with additional strict checks

---

## Troubleshooting

### Common Issues

#### "Package not found" errors

```bash
# Reinstall dependencies
rm -rf node_modules bun.lockb
bun install

# Ensure you're using --filter for package-specific commands
bun run --filter @fiberplane/mcp-gateway-core build
```

#### TypeScript errors after adding packages

```bash
# Check project references
bun tsc --showConfig

# Rebuild TypeScript references
bun tsc --build --clean
bun tsc --build

# Verify package is in root tsconfig.json references
```

#### Build failures

```bash
# Clean and rebuild
rm -rf packages/*/dist
bun run build

# Verify build script path in package.json
# Should be: "build": "bun run ../../scripts/build.ts"

# Check that target package exists
ls packages/your-package-name/
```

#### Test failures

```bash
# Check test setup
bun test --reporter=verbose

# Clear test cache
rm -rf .bun-test-cache

# Run with specific config
bun test --config packages/web/bunfig.toml
```

#### Circular dependency detected

```bash
# Identify cycles
bun run check-circular

# Extract shared code into utility module
# Move shared code to packages/core/src/utils/

# Verify fix
bun run check-circular  # Should show no cycles
```

#### Type assertion warnings with readFile

Bun's type definitions for `readFile` don't properly narrow with encoding parameter.

**Solution:**
```typescript
// Use this pattern:
const content = await readFile(path, "utf8") as unknown as string;

// Add comment explaining why:
// Bun types don't narrow readFile return type with encoding parameter
```

#### Mixed changeset error

**Error:** "Mixed changesets that contain both ignored and not ignored packages are not allowed"

**Solution:**
```bash
# Validate changesets before committing
bun run changeset:check

# Only @fiberplane/mcp-gateway should be versioned
# Remove any ignored packages from changeset frontmatter
```

#### Workspace dependency issues

```bash
# Internal packages should use workspace protocol
"@fiberplane/mcp-gateway-core": "workspace:*"

# Run install after making workspace changes
bun install

# Check workspace links
bun pm ls
ls -la node_modules/@fiberplane/
```

### Debugging Commands

```bash
# Check workspace structure
bun pm ls

# Verify package links
ls -la node_modules/@fiberplane/

# Check TypeScript project references
bun tsc --showConfig

# Analyze bundle size
bun run build && ls -lh packages/*/dist/

# Check for circular dependencies
bun run check-circular

# Generate dependency graph
bun run deps-graph  # Creates deps.svg
```

### Getting Help

1. Check existing issues in GitHub
2. Review documentation in `/docs`
3. Look at similar implementations in codebase
4. Ask team members for guidance

---

## Migration History

The repository was migrated from a single-package structure to a monorepo to:
- Enable future package splitting
- Improve development workflows
- Follow Fiberplane organizational patterns
- Maintain 100% backward compatibility

See `MIGRATION.md` for detailed migration steps and rationale.

---

## Examples

See the existing packages for reference:
- `packages/types/` - Pure types package (no dependencies)
- `packages/core/` - Core business logic package
- `packages/api/` - REST API with dependency injection
- `packages/server/` - HTTP server for MCP protocol
- `packages/web/` - React SPA with Vite
- `packages/mcp-gateway/` - CLI orchestrator
- `test-mcp-server/` - Development/testing package (not published)

---

## Additional Resources

- [Main README](../../README.md) - User guide
- [CLAUDE.md](../../CLAUDE.md) - Complete project instructions
- [Architecture Overview](../architecture/overview.md) - System design
- [Contributing Guidelines](../../CONTRIBUTING.md) - Contribution process
