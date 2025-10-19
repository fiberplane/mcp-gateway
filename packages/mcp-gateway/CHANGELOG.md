# @fiberplane/mcp-gateway

## 0.4.2

### Patch Changes

- c8c1709: Small patch bump to ensure the correct version is reflected.

## 0.4.1

### Patch Changes

- dc6585c: Patch bump to ensure all fixes are included.

## 0.4.0

### Minor Changes

- daf5a26: Binary distribution release

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

### Patch Changes

- 0c76ba1: Fix CI publishing: ignore compiled binaries.

## 0.4.0-next.6

### Patch Changes

- Remove bin field from platform packages to fix npx execution

  Platform packages should not have bin fields as this causes npx to try executing the binary directly instead of going through the wrapper script. Only the CLI wrapper package should declare the bin entry point.

## 0.4.0-next.5

### Patch Changes

- Make binary executable at runtime in wrapper

  npm doesn't preserve execute permissions on binary files. The wrapper now runs chmod on the binary before executing it to ensure it has execute permissions.

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
