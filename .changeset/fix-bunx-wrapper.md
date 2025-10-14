---
"@fiberplane/mcp-gateway": patch
"@fiberplane/mcp-gateway-darwin-arm64": patch
"@fiberplane/mcp-gateway-linux-x64": patch
---

Fix bunx/npx execution by replacing postinstall with JavaScript wrapper

The previous postinstall approach didn't work with bunx/npx because they don't run install scripts before executing binaries. Now using a CommonJS wrapper (bin/mcp-gateway.cjs) that dynamically finds and executes the platform-specific binary, matching the pattern used by esbuild and other binary packages.
