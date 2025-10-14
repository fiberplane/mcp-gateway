# @fiberplane/mcp-gateway-linux-x64

## 0.4.0-next.2

### Patch Changes

- Fix binary execute permissions in published packages

  Add bin field to platform packages so npm preserves execute permissions on binary files. Also improve error handling to show EACCES errors when binary is not executable.

## 0.4.0-next.1

### Patch Changes

- Fix bunx/npx execution by replacing postinstall with JavaScript wrapper

  The previous postinstall approach didn't work with bunx/npx because they don't run install scripts before executing binaries. Now using a CommonJS wrapper (bin/mcp-gateway.cjs) that dynamically finds and executes the platform-specific binary, matching the pattern used by esbuild and other binary packages.
