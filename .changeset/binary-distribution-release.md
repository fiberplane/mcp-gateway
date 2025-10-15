---
"@fiberplane/mcp-gateway": minor
"@fiberplane/mcp-gateway-darwin-arm64": minor
"@fiberplane/mcp-gateway-linux-x64": minor
---

Binary distribution release

This release introduces pre-compiled binaries for the MCP Gateway CLI, making installation and execution significantly faster and more reliable.

**Binary Distribution:**
- Pre-compiled standalone binaries for macOS ARM64 and Linux x64
- 61MB executables with all dependencies bundled (no separate installation needed)
- Platform-specific packages with automatic detection during installation
- Binary-only distribution model: internal library packages are private and not published

**Installation Improvements:**
- Full npx/bunx compatibility using require.resolve() pattern (matching esbuild/biome)
- Runtime chmod to ensure binary execute permissions
- Improved error handling with clear diagnostics for missing binaries
- JavaScript wrapper for cross-platform compatibility

**Package Structure:**
- Monorepo split into types, core, server, and CLI packages for better separation of concerns
- Binary-only distribution model: types, core, and server packages are now private and not published to npm
- Only wrapper and platform-specific binaries are published to npm
- Platform binary packages as optional dependencies
