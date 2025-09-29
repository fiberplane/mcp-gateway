# MCP Gateway Monorepo

A Bun workspace monorepo containing the MCP Gateway project and development tools.

## 📦 Packages

- **[@fiberplane/mcp-gateway](./packages/mcp-gateway/)** - Main MCP Gateway package
- **[test-mcp-server](./test-mcp-server/)** - Test MCP server for validating proxy functionality

## 🚀 Quick Start

```bash
# Install all workspace dependencies
bun install

# Build the main package
bun run build

# Start development mode
bun run dev

# Run test MCP server
bun run --filter test-mcp-server dev
```

## 📋 Available Commands

### Development
- `bun run dev` - Start development mode
- `bun run build` - Build main package  
- `bun run typecheck` - Type check all packages
- `bun run lint` - Lint all files
- `bun run format` - Format all files

### Package-specific
- `bun run --filter @fiberplane/mcp-gateway build` - Build main package only
- `bun run --filter test-mcp-server dev` - Run test MCP server

### Testing & Quality
- `bun test` - Run all tests
- `bun run --filter @fiberplane/mcp-gateway test` - Test main package only

## 🏗️ Project Structure

```
├── packages/
│   └── mcp-gateway/         # Main @fiberplane/mcp-gateway package
│       ├── src/            # Source code
│       ├── bin/            # CLI entry point
│       ├── tests/          # Tests
│       └── package.json    # Package configuration
├── test-mcp-server/       # Test MCP server for proxy validation
├── .github/workflows/     # CI/CD workflows
└── package.json          # Workspace configuration
```

## 📚 Documentation

### Developer Guides
- **[Adding Packages](./docs/adding-packages.md)** - Complete guide to adding new packages to the monorepo
- **[Development Workflow](./docs/development-workflow.md)** - Day-to-day development processes and best practices
- **[Monorepo Structure](./docs/monorepo-structure.md)** - Architecture, conventions, and design decisions

### Project Information
- **[MIGRATION.md](./MIGRATION.md)** - Detailed migration guide and rationale
- **[AGENTS.md](./AGENTS.md)** - Enhanced instructions for Claude Code
- **[Changelog](./packages/mcp-gateway/CHANGELOG.md)** - Package release history

## 🔧 Development

This project uses:
- **[Bun](https://bun.com)** - Fast JavaScript runtime and package manager
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Biome](https://biomejs.dev/)** - Linting and formatting
- **[Changesets](https://github.com/changesets/changesets)** - Version management

### Adding Dependencies

**To main package:**
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

To add a new package to the monorepo:

#### 1. Create Package Directory Structure
```bash
mkdir -p packages/your-package-name
cd packages/your-package-name
```

#### 2. Initialize Package Configuration
Create `package.json`:
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
  "dependencies": {
    "@fiberplane/mcp-gateway": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

#### 3. Create TypeScript Configuration
Create `tsconfig.json`:
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

#### 4. Create Source Structure
```bash
mkdir src
echo 'export const hello = () => "Hello from your-package-name";' > src/index.ts
```

#### 5. Update Root Configuration

Add your package to the root TypeScript configuration (`tsconfig.json`):
```json
{
  "references": [
    { "path": "./packages/mcp-gateway" },
    { "path": "./packages/your-package-name" },
    { "path": "./test-mcp-server" }
  ]
}
```

Update changeset configuration (`.changeset/config.json`) if needed:
```json
{
  "packages": ["packages/*"]
}
```

#### 6. Install Dependencies and Build
```bash
# Install workspace dependencies
bun install

# Build your new package
bun run --filter @fiberplane/your-package-name build

# Type check
bun run typecheck
```

#### 7. Add Package-Specific Scripts (Optional)

Add convenient scripts to root `package.json`:
```json
{
  "scripts": {
    "build:your-package": "bun run --filter @fiberplane/your-package-name build",
    "dev:your-package": "bun run --filter @fiberplane/your-package-name dev"
  }
}
```

#### 8. Configure for Publishing (If Public)

If this package should be published:

1. **Make it public** in `package.json`:
   ```json
   {
     "private": false,
     "publishConfig": {
       "access": "public"
     }
   }
   ```

2. **Add to GitHub workflows** if needed (they should pick up `packages/*` automatically)

3. **Create initial changeset**:
   ```bash
   bun changeset
   ```

#### Example: Adding a Utilities Package

Here's a complete example for adding `@fiberplane/mcp-utils`:

```bash
# Create structure
mkdir -p packages/mcp-utils/src

# Package.json
cat > packages/mcp-utils/package.json << 'EOF'
{
  "name": "@fiberplane/mcp-utils",
  "version": "0.0.0",
  "type": "module",
  "description": "Utilities for MCP Gateway",
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
  }
}
EOF

# TypeScript config
cat > packages/mcp-utils/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
EOF

# Source file
echo 'export const formatServerName = (name: string) => name.toLowerCase().replace(/[^a-z0-9-]/g, "-");' > packages/mcp-utils/src/index.ts

# Install and build
bun install
bun run --filter @fiberplane/mcp-utils build
```

## 🚢 Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for version management:

```bash
# Create a changeset
bun changeset

# Version packages (done by CI)
bun changeset version

# Publish packages (done by CI)
bun changeset publish
```

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Add a changeset: `bun changeset`
4. Commit and push
5. Create a pull request

## 📄 License

[MIT](./LICENSE)

---

**Note**: This is a Bun workspace monorepo. Always use `bun` commands and leverage `--filter` for package-specific operations.
