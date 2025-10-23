# MCP Gateway Monorepo Structure

This document outlines the structure, conventions, and architecture of the MCP Gateway monorepo.

## Overview

The MCP Gateway monorepo is built using Bun workspaces and follows modern monorepo practices for maintainability, scalability, and developer experience.

## Directory Structure

```
mcp-gateway/
├── packages/                    # Published packages
│   └── mcp-gateway/            # Main @fiberplane/mcp-gateway package
│       ├── src/                # Source code
│       ├── bin/                # CLI entry points
│       ├── tests/              # Package-specific tests
│       ├── scripts/            # Package-specific build scripts
│       └── package.json        # Package configuration
├── test-mcp-server/            # Development testing server
├── docs/                       # Documentation
├── .github/workflows/          # CI/CD pipelines
├── .changeset/                 # Version management
├── scripts/                    # Shared build/dev scripts (if any)
├── package.json                # Workspace root configuration
├── tsconfig.json               # Root TypeScript config
├── biome.jsonc                 # Linting/formatting config
└── bun.lockb                   # Dependency lockfile
```

## Package Types

### Published Packages (`packages/`)
- **Purpose**: Packages distributed to npm
- **Naming**: `@fiberplane/package-name`
- **Structure**: Standard with `src/`, `dist/`, tests
- **Build**: Individual build scripts, shared tooling

### Development Packages (root level)
- **Purpose**: Development tools, testing, examples
- **Naming**: Simple names (e.g., `test-mcp-server`)
- **Structure**: Minimal, focused on functionality
- **Publishing**: Marked as private, not published

## Configuration Architecture

### Workspace Configuration
```json
{
  "workspaces": ["packages/*", "test-mcp-server"],
  "type": "module"
}
```

### TypeScript Project References
```json
{
  "references": [
    { "path": "./packages/mcp-gateway" },
    { "path": "./test-mcp-server" }
  ]
}
```

### Build System
- **Runtime**: Bun (replaces Node.js/npm)
- **Build Tool**: Custom TypeScript builds via `scripts/build.ts`
- **Bundling**: Bun's built-in bundler
- **Type Generation**: TypeScript compiler

## Dependency Management

### Workspace Dependencies
```json
{
  "dependencies": {
    "@fiberplane/mcp-gateway": "workspace:*"
  }
}
```

### External Dependencies
- **Production**: Added to individual packages
- **Development**: Consolidated at root level
- **Management**: Bun package manager

### Version Pinning
- **Exact versions**: For critical dependencies
- **Ranges**: For development dependencies
- **Workspace protocol**: For internal packages

## Build & Development Workflow

### Commands Structure
```json
{
  "scripts": {
    "dev": "bun run --filter @fiberplane/mcp-gateway dev",
    "build": "bun run --filter @fiberplane/mcp-gateway build",
    "typecheck": "bun run --filter '*' typecheck",
    "lint": "biome check .",
    "format": "biome format --write ."
  }
}
```

### Package-Specific Operations
```bash
# Build specific package
bun run --filter @fiberplane/package-name build

# Run tests for specific package
bun run --filter @fiberplane/package-name test

# Development mode for specific package
bun run --filter @fiberplane/package-name dev
```

## Version Management

### Changesets Integration
- **Tool**: @changesets/cli
- **Configuration**: `.changeset/config.json`
- **Workflow**: Manual changeset creation → automated versioning

### Release Process
1. Developer creates changeset: `bun changeset`
2. CI creates version PR with `changeset version`
3. Merge triggers publish with `changeset publish`

### Package Tracking
```json
{
  "packages": ["packages/*"],
  "ignore": ["test-mcp-server"]
}
```

## CI/CD Architecture

### Workflow Triggers
- **CI**: Pull requests to main
- **Release**: Pushes to main branch

### Job Structure
```yaml
jobs:
  test:
    - Install dependencies
    - Type check all packages
    - Lint all files
    - Build main package
    - Run tests

  release:
    - Install dependencies  
    - Type check & lint
    - Build packages
    - Create release PR or publish
```

### Environment Requirements
- **Bun**: Latest version via oven-sh/setup-bun@v2
- **Node.js**: v22 for npm publishing
- **Secrets**: GITHUB_TOKEN, NPM_TOKEN

## Tooling Stack

### Runtime & Package Management
- **Bun**: Primary runtime and package manager
- **Node.js**: Fallback for npm publishing

### Code Quality
- **TypeScript**: Type safety and compilation
- **Biome**: Linting and formatting
- **Project References**: Composite builds

### Development
- **Watch Mode**: `bun --watch` for development
- **Hot Reload**: Automatic restart on changes
- **Type Checking**: Continuous via composite projects

## Conventions & Standards

### File Naming
- **Packages**: kebab-case (`mcp-gateway`)
- **Files**: kebab-case (`server-tools.ts`)
- **Exports**: camelCase functions, PascalCase classes

### Import/Export Patterns
```typescript
// Barrel exports from index.ts
export { ServerManager } from './server-manager.js';
export { type ServerConfig } from './types.js';

// Internal imports with .js extension
import { ServerManager } from './server-manager.js';
```

### TypeScript Configuration
- **Module**: "Preserve" for Hono JSX compatibility
- **Target**: ESNext
- **Strict**: Enabled with additional strict checks

## Migration History

The repository was migrated from a single-package structure to a monorepo to:
- Enable future package splitting
- Improve development workflows
- Follow Fiberplane organizational patterns
- Maintain 100% backward compatibility

See `MIGRATION.md` for detailed migration steps and rationale.

## Future Architecture

### Planned Package Structure
```
packages/
├── mcp-gateway/          # Core library
├── mcp-cli/             # Command-line interface
├── mcp-ui/              # Web interface components
├── mcp-utils/           # Shared utilities
└── mcp-types/           # TypeScript definitions
```

### Extensibility Patterns
- Plugin architecture for custom tools
- Middleware system for request processing
- Configuration-driven server management
- Event-driven architecture for real-time updates

This structure enables horizontal scaling while maintaining cohesive development experience.