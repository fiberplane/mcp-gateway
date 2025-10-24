# Development Workflow

This guide covers the day-to-day development workflow for the MCP Gateway monorepo.

## Quick Start

```bash
# Clone and setup
git clone <repo-url>
cd mcp-gateway
bun install

# Start development
bun run dev                    # Main package development mode
bun run --filter test-mcp-server dev  # Test server
```

## Common Development Tasks

### Starting Development Environment

#### Main Package Development
```bash
# Start the main MCP Gateway in development mode
bun run dev

# Alternative: explicit filter
bun run --filter @fiberplane/mcp-gateway dev
```

#### Test Server Development
```bash
# Start test MCP server
bun run --filter test-mcp-server dev

# Start comprehensive test server
bun run --filter test-mcp-server start:comprehensive
```

#### Full Stack Development
```bash
# Terminal 1: Main gateway
bun run dev

# Terminal 2: Test server
bun run --filter test-mcp-server dev

# Terminal 3: Watch tests
bun test --watch
```

### Code Quality Checks

#### Type Checking
```bash
# Check all packages
bun run typecheck

# Check specific package
bun run --filter @fiberplane/mcp-gateway typecheck
```

#### Linting and Formatting
```bash
# Check for issues
bun run lint

# Fix auto-fixable issues
bun run format

# Check specific files
biome check src/specific-file.ts
```

### Building and Testing

#### Building
```bash
# Build main package
bun run build

# Build specific package
bun run --filter @fiberplane/mcp-gateway build

# Clean build (remove dist first)
rm -rf packages/mcp-gateway/dist && bun run build
```

#### Testing
```bash
# Run all tests
bun test

# Run specific test file
bun test packages/mcp-gateway/tests/cli.test.ts

# Run tests with coverage
bun test --coverage

# Watch mode
bun test --watch
```

### Dependency Management

#### Adding Dependencies
```bash
# To main package
cd packages/mcp-gateway
bun add express @types/express

# To test server
cd test-mcp-server
bun add some-test-utility

# Dev dependencies to root
bun add -D @types/node
```

#### Updating Dependencies
```bash
# Update all dependencies
bun update

# Update specific dependency
bun update express

# Update to latest versions
bun update --latest
```

#### Workspace Dependencies
```bash
# Add workspace dependency
cd packages/new-package
bun add @fiberplane/mcp-gateway@workspace:*
```

## Git Workflow

### Branch Strategy
- `main` - Stable release branch
- `feature/description` - Feature branches
- `fix/description` - Bug fix branches

### Commit Guidelines
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

### Making Changes
```bash
# Create feature branch
git checkout -b feature/add-server-monitoring

# Make changes, commit regularly
git add .
git commit -m "feat: add basic server monitoring"

# Push and create PR
git push -u origin feature/add-server-monitoring
```

## Release Workflow

### Creating Changesets
```bash
# Create changeset for your changes
bun changeset

# Follow prompts to:
# 1. Select packages that changed
# 2. Choose semver bump (patch/minor/major)
# 3. Write changelog entry
```

### Changeset Examples
```bash
# Patch release (bug fix)
patch: Fix connection timeout in proxy

# Minor release (new feature)  
minor: Add health check endpoints

# Major release (breaking change)
major: Restructure configuration format
```

### Version Management
```bash
# Preview version bumps (dry run)
bun changeset version --snapshot

# Apply version bumps (done by CI)
bun changeset version

# Publish packages (done by CI)
bun changeset publish
```

## Debugging

### Development Debugging
```bash
# Enable debug logging
DEBUG=mcp-gateway:* bun run dev

# Run with Node.js debugger
bun --inspect run src/index.ts

# Verbose output
bun run dev --verbose
```

### Build Debugging
```bash
# Check TypeScript compilation
bun tsc --noEmit --project packages/mcp-gateway/tsconfig.json

# Check build output
ls -la packages/mcp-gateway/dist/
```

### Test Debugging
```bash
# Run specific test with output
bun test packages/mcp-gateway/tests/cli.test.ts --verbose

# Debug test failures
bun test --reporter=verbose

# Run single test
bun test -t "specific test name"
```

## IDE Setup

### VS Code Configuration
Create `.vscode/settings.json`:
```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome"
}
```

### Recommended Extensions
- Biome (biomejs.biome)
- TypeScript and JavaScript Language Features
- Bun for Visual Studio Code

## Performance Tips

### Build Performance
```bash
# Use incremental builds
bun tsc --build --incremental

# Parallel type checking
bun run typecheck

# Skip type checking during development
bun --no-check src/index.ts
```

### Development Performance
```bash
# Use watch mode efficiently
bun --watch src/index.ts

# Limit file watching
bun --watch --ignore node_modules src/index.ts
```

## Troubleshooting

### Common Issues

#### "Package not found" errors
```bash
# Reinstall dependencies
rm -rf node_modules bun.lockb
bun install
```

#### TypeScript errors after adding packages
```bash
# Check project references
bun tsc --showConfig

# Rebuild TypeScript references
bun tsc --build --clean
bun tsc --build
```

#### Build failures
```bash
# Clean and rebuild
rm -rf packages/*/dist
bun run build
```

#### Test failures
```bash
# Check test setup
bun test --reporter=verbose

# Clear test cache
rm -rf .bun-test-cache
```

### Getting Help
1. Check existing issues in GitHub
2. Review documentation in `/docs`
3. Look at similar implementations in codebase
4. Ask team members for guidance

## Environment Variables

### Development
```bash
# .env.local
DEBUG=mcp-gateway:*
MCP_STORAGE_DIR=./dev-storage
NODE_ENV=development
```

### Testing
```bash
# Test environment
NODE_ENV=test
MCP_STORAGE_DIR=./test-storage
```

This workflow ensures efficient development while maintaining code quality and consistency across the monorepo.