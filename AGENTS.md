# MCP Gateway Monorepo - Claude Code Instructions

## Project Overview

This is a Bun workspace monorepo containing the MCP Gateway project. The repository structure follows monorepo best practices while maintaining backward compatibility for the main `@fiberplane/mcp-gateway` package.

## Repository Structure

```
/Users/jaccoflenter/dev/fiberplane/mcp-gateway/
├── packages/
│   └── mcp-gateway/              # Main @fiberplane/mcp-gateway package
│       ├── src/                  # All source code
│       ├── bin/                  # CLI entry point  
│       ├── tests/               # Package tests
│       └── package.json         # Package configuration
├── playground/                   # Development playground
│   ├── *.ts                     # Test servers and examples
│   └── package.json             # Playground dependencies
├── .github/workflows/           # CI/CD workflows
├── package.json                 # Root workspace configuration
├── MIGRATION.md                 # Migration documentation
└── [config files]              # Root-level configurations
```

## Important Commands

### Development Commands
- `bun install` - Install all workspace dependencies
- `bun run dev` - Start development mode (filters to main package)
- `bun run build` - Build main package (filters to main package)
- `bun run typecheck` - Type check all packages
- `bun run lint` - Lint all files
- `bun run format` - Format all files

### Package-Specific Commands
- `bun run --filter @fiberplane/mcp-gateway build` - Build only main package
- `bun run --filter @fiberplane/mcp-gateway dev` - Dev mode for main package
- `bun run --filter playground dev` - Run playground development server

### Testing Commands
- `bun test` - Run all tests
- `bun run --filter @fiberplane/mcp-gateway test` - Test main package only

## Key Points for Claude Code

### 1. Workspace Structure
- This is a **Bun workspace** - always use `bun` commands, not npm/yarn
- The main package is in `packages/mcp-gateway/`
- Use `--filter` flags for package-specific operations
- Playground is a separate workspace for testing

### 2. Build System
- Each package has its own build script in `packages/*/scripts/build.ts`
- Package-specific build logic co-located with the package
- Always build with: `bun run --filter @fiberplane/mcp-gateway build`

### 3. TypeScript Configuration
- Root `tsconfig.json` uses project references
- Each package has its own `tsconfig.json` that extends the root
- Configuration preserves Hono JSX compatibility (`"module": "Preserve"`)
- Use `bun run typecheck` to check all packages

### 4. Package Management
- Root `package.json` defines workspace structure
- Main package maintains original name: `@fiberplane/mcp-gateway`
- Playground uses `workspace:*` dependency for main package
- All devDependencies consolidated at root level

### 5. CI/CD Integration
- GitHub Actions updated for monorepo structure
- CI builds with: `bun run --filter @fiberplane/mcp-gateway build`
- Changesets configured to ignore playground, track `packages/*`

### 6. Backward Compatibility
- ✅ Main package name unchanged: `@fiberplane/mcp-gateway`
- ✅ CLI command unchanged: `mcp-gateway`
- ✅ API surface identical
- ✅ Installation: `npm install -g @fiberplane/mcp-gateway`

## Common Tasks

### Adding New Dependencies

**To main package:**
```bash
cd packages/mcp-gateway
bun add <package-name>
```

**To playground:**
```bash
cd playground  
bun add <package-name>
```

**Dev dependencies (add to root):**
```bash
bun add -D <package-name>
```

### Running Tests
```bash
# All tests
bun test

# Main package only
bun run --filter @fiberplane/mcp-gateway test
```

### Building and Development
```bash
# Build main package
bun run build
# or explicitly:
bun run --filter @fiberplane/mcp-gateway build

# Development mode
bun run dev

# Playground development
bun run --filter playground dev
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
   - Playground should use `"@fiberplane/mcp-gateway": "workspace:*"`
   - Run `bun install` after making workspace changes

### Migration Notes

This repository was migrated from a single-package structure to a monorepo. See `MIGRATION.md` for detailed migration steps and rationale. The migration:

- Maintains 100% backward compatibility
- Improves development workflow
- Enables future package splitting
- Follows Fiberplane repository patterns

## Development Workflow

1. **Making changes**: Work in `packages/mcp-gateway/src/`
2. **Testing**: Use playground in `playground/` directory
3. **Building**: Always use filtered commands for production builds
4. **Committing**: Use conventional commit messages
5. **Releasing**: Use changesets workflow

## Future Enhancements

The monorepo structure enables:
- Package splitting (core, cli, ui components)
- Shared utilities packages
- Multiple distribution formats
- Enhanced testing strategies

---

**Remember**: This is a Bun workspace. Always use `bun` commands and leverage the `--filter` flag for package-specific operations.