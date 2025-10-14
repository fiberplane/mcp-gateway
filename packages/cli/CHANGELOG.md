# @fiberplane/mcp-gateway

## 0.4.0-next.4

### Patch Changes

- Fix binary execute permissions in published packages

  Add bin field to platform packages so npm preserves execute permissions on binary files. Also improve error handling to show EACCES errors when binary is not executable.

## 0.4.0-next.3

### Patch Changes

- Add debug output to wrapper when binary not found

  Show searched paths and existence checks to help diagnose installation issues.

## 0.4.0-next.2

### Patch Changes

- Fix optionalDependencies using workspace: protocol in published package

  Changesets doesn't replace workspace:\* in optionalDependencies, causing npm/bunx to fail. Now using explicit version numbers that will be kept in sync during releases.

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
