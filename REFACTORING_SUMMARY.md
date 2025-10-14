# Package Refactoring - Quick Reference

> 📄 Full details in [REFACTORING_PLAN.md](./REFACTORING_PLAN.md)

## What We're Doing

**Splitting** `@fiberplane/mcp-gateway` into 4 focused packages:

```
types  →  core  →  server
                    ↓
                   cli
```

## New Packages

| Package | Purpose | Dependencies |
|---------|---------|--------------|
| `@fiberplane/mcp-gateway-types` | Types & schemas | zod |
| `@fiberplane/mcp-gateway-core` | Business logic | types |
| `@fiberplane/mcp-gateway-server` | HTTP API | core, types |
| `@fiberplane/mcp-gateway` | CLI & TUI | all |

## Key Changes

### For Users
- ✅ **NO breaking changes**
- ✅ Package name stays `@fiberplane/mcp-gateway`
- ✅ CLI command stays `mcp-gateway`
- ✅ Everything works identically

### For Developers
- 📦 Clear package boundaries
- 🧪 Better testability
- 🚀 Enables web UI development
- 📚 Easier to understand/maintain

## Migration Phases

1. **Setup** - Create package structure
2. **Types** - Extract types/schemas
3. **Core** - Move business logic
4. **Server** - Extract HTTP layer
5. **CLI** - Finalize CLI package
6. **Cleanup** - Remove old files
7. **CI/CD** - Update workflows
8. **Testing** - Verify everything works

## Quick Commands (After Refactoring)

```bash
# Build all
bun run build

# Dev mode
bun run dev

# Type check all packages
bun run typecheck

# Check for circular dependencies
bun run check-circular

# Test
bun test

# Build specific package
bun run --filter @fiberplane/mcp-gateway-core build

# Generate dependency graph (optional)
bun run deps-graph
```

## Timeline

~8-12 hours of focused work

## All Questions Resolved ✅

- ✅ **Independent versioning** - Each package gets proper semantic versions
- ✅ **All packages published** to npm (types, core, server, cli)
- ✅ Logger stays in core as singleton
- ✅ Keep registry mutation pattern (works fine)
- ✅ No need for shared build script package
- ✅ test-mcp-server stays as-is (out of scope)
- ✅ Add madge for circular dependency checking in CI

## Next Steps After This PR

Add web UI package with:
- React + zustand + tailwind
- Tanstack Router + Query
- REST API endpoints
- Static file serving

---

**Status:** 📋 Planning complete, ready to implement
