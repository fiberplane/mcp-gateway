# MCP Gateway Monorepo - Claude Code Instructions

## Project Overview

This is a Bun workspace monorepo containing the MCP Gateway project. The repository structure follows monorepo best practices while maintaining backward compatibility for the main `@fiberplane/mcp-gateway` package.

## Repository Structure

```
/Users/jaccoflenter/dev/fiberplane/mcp-gateway/
├── packages/
│   ├── types/                   # @fiberplane/mcp-gateway-types
│   │   ├── src/                 # Type definitions and Zod schemas
│   │   ├── package.json         # Types package configuration
│   │   └── tsconfig.json
│   ├── core/                    # @fiberplane/mcp-gateway-core
│   │   ├── src/                 # Core business logic
│   │   │   ├── registry/        # Registry operations
│   │   │   ├── capture/         # MCP traffic capture
│   │   │   ├── mcp/             # MCP server & tools
│   │   │   ├── utils/           # Shared utilities
│   │   │   ├── logger.ts        # Logging infrastructure
│   │   │   └── health.ts        # Health checks
│   │   ├── package.json         # Core package configuration
│   │   └── tsconfig.json
│   ├── server/                  # @fiberplane/mcp-gateway-server
│   │   ├── src/                 # HTTP server routes
│   │   │   ├── routes/          # API routes (proxy, oauth)
│   │   │   ├── app.ts           # Hono application factory
│   │   │   └── index.ts         # Public exports
│   │   ├── package.json         # Server package configuration
│   │   └── tsconfig.json
│   ├── mcp-gateway/             # @fiberplane/mcp-gateway-cli (private)
│   │   ├── src/                 # CLI orchestration & TUI
│   │   │   ├── tui/             # Terminal UI components
│   │   │   ├── cli.ts           # CLI entry point
│   │   │   ├── binary-entry.ts  # Binary compilation entry point
│   │   │   └── events.ts        # TUI event system
│   │   ├── bin/                 # Development CLI executable
│   │   ├── tests/               # Integration tests
│   │   ├── package.json         # CLI package configuration
│   │   └── tsconfig.json
│   ├── cli/                     # @fiberplane/mcp-gateway (public)
│   │   ├── bin/                 # Symlink to platform binary
│   │   ├── package.json         # Wrapper package with optionalDeps
│   │   └── postinstall.mjs      # Platform detection & binary setup
│   ├── mcp-gateway-darwin-arm64/  # Binary package for macOS ARM64
│   ├── mcp-gateway-darwin-x64/    # Binary package for macOS x64
│   └── mcp-gateway-linux-x64/     # Binary package for Linux x64
├── test-mcp-server/             # Test MCP server for validation
│   ├── *.ts                     # Test server configurations
│   └── package.json             # Test server dependencies
├── scripts/                     # Shared build scripts
│   └── build.ts                 # Package build script
├── .github/workflows/           # CI/CD workflows
├── package.json                 # Root workspace configuration
├── REFACTORING_PLAN.md          # Detailed refactoring documentation
└── [config files]              # Root-level configurations
```

## Important Commands

### Development Commands
- `bun install` - Install all workspace dependencies
- `bun run dev` - Start development mode (filters to CLI package)
- `bun run build` - Build CLI package (filters to main package)
- `bun run build:binaries` - Build platform-specific binaries (current platform or --all)
- `bun run clean` - Clean all dist folders
- `bun run typecheck` - Type check all packages
- `bun run lint` - Lint all files
- `bun run format` - Format all files
- `bun run check-circular` - Check for circular dependencies
- `bun run deps-graph` - Generate dependency graph (deps.svg)

### Package-Specific Commands
- `bun run --filter @fiberplane/mcp-gateway-types build` - Build types package
- `bun run --filter @fiberplane/mcp-gateway-core build` - Build core package
- `bun run --filter @fiberplane/mcp-gateway-server build` - Build server package
- `bun run --filter @fiberplane/mcp-gateway-cli build` - Build CLI package
- `bun run --filter @fiberplane/mcp-gateway-cli dev` - Dev mode for CLI
- `bun run --filter test-mcp-server dev` - Run test MCP server

### Testing Commands
- `bun test` - Run all tests
- `bun run --filter @fiberplane/mcp-gateway-cli test` - Test CLI package only

## Key Points for Claude Code

### 1. Workspace Structure
- This is a **Bun workspace** - always use `bun` commands, not npm/yarn
- **Seven packages** with clear boundaries:
  - `@fiberplane/mcp-gateway-types` - Pure types and Zod schemas (no runtime deps)
  - `@fiberplane/mcp-gateway-core` - Business logic (registry, capture, health, logger, MCP server)
  - `@fiberplane/mcp-gateway-server` - HTTP API layer (Hono routes and middleware)
  - `@fiberplane/mcp-gateway-cli` (private) - CLI and TUI source code (orchestrates other packages)
  - `@fiberplane/mcp-gateway` (public) - Wrapper package for binary distribution
  - `@fiberplane/mcp-gateway-*` (3 platform packages) - Compiled binaries for darwin-arm64, darwin-x64, linux-x64
- Use `--filter` flags for package-specific operations
- Test MCP server is a separate workspace for testing proxy functionality
- **Binary Distribution**: CLI is distributed as platform-specific compiled binaries, not source code

### 2. Package Dependencies
```
types (no deps) → core (types) → server (core, types)
                                    ↓
                                   cli (all packages)
```
- **No circular dependencies** - enforced by `madge` in CI
- During development, packages use `workspace:*` protocol
- During publishing, `workspace:*` is replaced with actual version ranges
- All packages are published to npm independently

### 3. Build System
- **Shared build script** at `scripts/build.ts` referenced by all packages
- Each package has its own build configuration
- TypeScript declaration files generated only for library packages (not CLI)
- Build order matters: types → core → server → cli

### 4. TypeScript Configuration
- **Development mode**: Uses source `.ts` files directly (no build required for typechecking)
- **Production mode**: Uses compiled `.d.ts` declaration files
- Each package extends root `tsconfig.json`
- Configuration preserves Hono JSX compatibility (`"module": "Preserve"`)
- Conditional exports in package.json point to source files during dev

### 5. Package Management
- Root `package.json` defines workspace structure
- Main public package maintains original name: `@fiberplane/mcp-gateway`
- CLI source is in `@fiberplane/mcp-gateway-cli` (private, not published directly)
- Internal dependencies use `workspace:*` protocol
- All devDependencies consolidated at root level
- Use `bun add -D` at root for dev dependencies

### 6. CI/CD Integration
- GitHub Actions updated for monorepo structure
- **Circular dependency check** runs in CI before typecheck
- CI builds all packages: types → core → server → cli
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

**To server package:**
```bash
cd packages/server
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
# All tests
bun test

# CLI package only
bun run --filter @fiberplane/mcp-gateway-cli test
```

### Building and Development
```bash
# Build CLI package
bun run build
# or explicitly:
bun run --filter @fiberplane/mcp-gateway-cli build

# Build binaries (current platform only)
bun run build:binaries

# Build binaries for all platforms (requires platform-specific deps)
bun run build:binaries --all

# Development mode
bun run dev

# Test MCP server
bun run --filter test-mcp-server dev
```

### Release Process
```bash
# Create changeset
bun changeset

# Version packages
bun changeset version

# Publish (done by CI)
bun changeset publish
```

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

### Migration Notes

This repository was migrated from a single-package structure to a monorepo. See `MIGRATION.md` for detailed migration steps and rationale. The migration:

- Maintains 100% backward compatibility
- Improves development workflow
- Enables future package splitting
- Follows Fiberplane repository patterns

## Development Workflow

1. **Making changes**: Work in appropriate package directory (`packages/types/`, `packages/core/`, `packages/server/`, or `packages/mcp-gateway/`)
2. **Testing**: Use test MCP server in `test-mcp-server/` directory
3. **Type checking**: Run `bun run typecheck` (works without building packages)
4. **Circular deps**: Check with `bun run check-circular` before committing
5. **Building**: Build packages in dependency order (or use filtered commands)
6. **Committing**: Use conventional commit messages
7. **Releasing**: Use changesets workflow for versioning and publishing

## Package Structure Benefits

The refactored monorepo structure provides:
- ✅ **Clear separation of concerns** - Types, core logic, HTTP layer, and CLI are independent
- ✅ **Better testability** - Each package can be tested in isolation
- ✅ **Reusability** - Server package can be embedded in other applications
- ✅ **Independent versioning** - Packages can be versioned and released independently
- ✅ **No circular dependencies** - Enforced by CI checks with madge

## Binary Distribution

The CLI is distributed as **compiled Bun binaries** rather than source code, following the pattern used by esbuild, @swc/core, and prettier.

### Why Binary Distribution?

The CLI uses OpenTUI which has `bun:ffi` dependencies that **cannot be distributed via npm** as source code:
- `bunx @fiberplane/mcp-gateway` fails with FFI errors when running from npm
- Even Bun cannot execute the package from npm - it requires local installation as a dependency
- The only viable solution is to distribute pre-compiled binaries

### Package Structure

```
@fiberplane/mcp-gateway (public)
├── Wrapper package with optionalDependencies
├── postinstall.mjs detects platform & creates symlink
└── Depends on platform-specific binary packages:
    ├── @fiberplane/mcp-gateway-darwin-arm64 (61MB binary)
    ├── @fiberplane/mcp-gateway-darwin-x64 (61MB binary)
    └── @fiberplane/mcp-gateway-linux-x64 (61MB binary)

@fiberplane/mcp-gateway-cli (private)
└── Source code for CLI (not published directly)
```

### Building Binaries

```bash
# Build for current platform only (default)
bun run build:binaries

# Build for all platforms (requires GitHub Actions - OpenTUI has platform-specific native modules)
bun run build:binaries --all  # Will fail locally on most platforms
```

### How It Works

1. **Development**: Use `bun run dev` to run CLI from source
2. **Binary Build**: `scripts/build-binaries.ts` compiles with `bun build --compile`
3. **Version Injection**: Uses `--define BUILD_VERSION="x.y.z"` for version detection
4. **Platform Detection**: postinstall.mjs detects platform and symlinks appropriate binary
5. **Installation**: `npm install -g @fiberplane/mcp-gateway` installs wrapper + platform binary

### Platform Support

- ✅ macOS ARM64 (darwin-arm64) - Apple Silicon
- ✅ macOS x64 (darwin-x64) - Intel Macs
- ✅ Linux x64 (linux-x64) - Most Linux distributions
- ❌ Windows - Not yet supported (OpenTUI compatibility TBD)

### CI/CD Strategy

Use GitHub Actions matrix builds:
- Each platform builds its own binary in parallel
- Platform-specific binary packages published independently
- Wrapper package published with references to binary packages
- All packages synchronized to same version

## Future Enhancements

The monorepo structure enables:
- Web UI package using React + TanStack Router
- REST API endpoints for non-MCP clients
- Standalone server deployment (without CLI/TUI)
- Shared UI component library
- Multiple distribution formats (ESM, CJS, bundled)

---

**Remember**: This is a Bun workspace. Always use `bun` commands and leverage the `--filter` flag for package-specific operations.