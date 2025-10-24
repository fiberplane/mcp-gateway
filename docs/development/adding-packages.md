# Adding New Packages to MCP Gateway Monorepo

This guide covers how to add new packages to the MCP Gateway monorepo using Bun workspaces.

## Quick Reference

### Package Structure
```
packages/your-package-name/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Required Files

#### package.json Template
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

#### tsconfig.json Template
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

## Step-by-Step Process

### 1. Create Package Structure
```bash
mkdir -p packages/your-package-name/src
cd packages/your-package-name
```

### 2. Initialize Package Files
Create the package.json and tsconfig.json files using the templates above.

### 3. Create Source Files
```bash
echo 'export const hello = () => "Hello from your-package-name";' > src/index.ts
```

### 4. Update Root Configuration

#### Add TypeScript Project Reference
Add your package to the root `tsconfig.json` references section:
```json
{
  "references": [
    // Published packages
    { "path": "./packages/mcp-gateway" },
    { "path": "./packages/your-package-name" },  // <- Add your package here
    
    // Development packages
    { "path": "./test-mcp-server" }
  ]
}
```

**Why Project References?**
- **Incremental builds**: Only rebuild changed packages
- **Type checking**: Cross-package type safety and imports  
- **IDE support**: Go-to-definition across packages
- **Build coordination**: `bun run typecheck` works efficiently

**Important**: Each package must be explicitly listed - TypeScript doesn't support wildcards like `./packages/*`

### 5. Install and Build
```bash
# From root directory
bun install
bun run --filter @fiberplane/your-package-name build
bun run typecheck
```

## Configuration Requirements

### Workspace Dependencies
- Use `"workspace:*"` for internal dependencies
- Add external dependencies normally with `bun add`

### Build System Integration
- All packages use shared build script: `"build": "bun run ../../scripts/build.ts"`
- Build outputs go to `dist/` directory
- TypeScript declarations are generated automatically

### Publishing Configuration
- Packages are automatically discovered by changesets
- GitHub workflows build and publish all packages in `packages/*`
- Use `bun changeset` to create version bumps

## Package Types

### Library Packages
Standard TypeScript libraries that export functions/classes:
- Use ES modules (`"type": "module"`)
- Export from `src/index.ts`
- Build to `dist/` with types

### CLI Packages
Command-line tools:
- Add `bin` field in package.json
- Create executable in `src/cli.ts`
- Use `#!/usr/bin/env node` shebang

### Internal Packages
Packages only used within the monorepo:
- Set `"private": true`
- Don't need publishing configuration
- Can be utilities, shared configs, etc.

## Testing New Packages

### Basic Validation
```bash
# Type check
bun run typecheck

# Build
bun run --filter @fiberplane/your-package-name build
```

### Integration Testing
```bash
# Add to another package
cd packages/mcp-gateway
bun add @fiberplane/your-package-name@workspace:*

# Use in code
import { hello } from '@fiberplane/your-package-name';
```

## Common Patterns

### Shared Utilities Package
```bash
mkdir -p packages/utils/src
# Add utility functions, shared types, constants
```

### Plugin Package
```bash
mkdir -p packages/plugin-name/src
# Add MCP gateway extensions, middleware
```

### CLI Extensions
```bash
mkdir -p packages/cli-tools/src
# Add command-line utilities, scripts
```

## Troubleshooting

### Common Issues

1. **TypeScript can't find package**
   - Check root tsconfig.json has project reference
   - Run `bun install` to update workspace links

2. **Build fails**
   - Verify build script path in package.json
   - Check TypeScript configuration extends root config

3. **Import errors**
   - Ensure package.json has correct exports
   - Check that built files exist in dist/

4. **Publishing fails**
   - Verify publishConfig in package.json
   - Check that package isn't marked private

### Debugging Commands
```bash
# Check workspace structure
bun pm ls

# Verify package links
ls -la node_modules/@fiberplane/

# Check TypeScript project references
bun tsc --showConfig
```

## Examples

See the existing packages for reference:
- `packages/mcp-gateway/` - Main library package
- `test-mcp-server/` - Development/testing package (not published)

For complete examples and more details, see the main README.md file.