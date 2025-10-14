# @fiberplane/mcp-gateway

## 0.4.0-next.1

### Patch Changes

- Fix bunx/npx execution by replacing postinstall with JavaScript wrapper

  The previous postinstall approach didn't work with bunx/npx because they don't run install scripts before executing binaries. Now using a CommonJS wrapper (bin/mcp-gateway.cjs) that dynamically finds and executes the platform-specific binary, matching the pattern used by esbuild and other binary packages.

## 0.4.0-next.0

### Minor Changes

- Binary Distribution Preview

  This preview release introduces binary distribution for the MCP Gateway CLI:

  - Pre-compiled binaries for macOS (ARM64/x64), Linux x64, and Windows x64
  - Platform-specific packages with automatic detection during installation
  - 61MB standalone executables with all dependencies bundled
  - Improved installation experience with npm/npx
