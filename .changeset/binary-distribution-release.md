---
"@fiberplane/mcp-gateway": minor
"@fiberplane/mcp-gateway-types": minor
"@fiberplane/mcp-gateway-core": minor
"@fiberplane/mcp-gateway-server": minor
"@fiberplane/mcp-gateway-darwin-arm64": minor
"@fiberplane/mcp-gateway-linux-x64": minor
---

Binary distribution release

This release introduces pre-compiled binaries for the MCP Gateway CLI, making installation and execution significantly faster and more reliable:

**Binary Distribution:**
- Pre-compiled standalone binaries for macOS (ARM64/x64), Linux x64, and Windows x64
- 61MB executables with all dependencies bundled (no separate installation needed)
- Platform-specific packages with automatic detection during installation

**Installation Improvements:**
- Full npx/bunx compatibility using require.resolve() pattern (matching esbuild/biome)
- Runtime chmod to ensure binary execute permissions
- Improved error handling with clear diagnostics for missing binaries
- JavaScript wrapper for cross-platform compatibility

**Package Structure:**
- Monorepo split into types, core, server, and CLI packages
- Better separation of concerns and independent versioning
- Platform binary packages as optional dependencies

