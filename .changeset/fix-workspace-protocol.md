---
"@fiberplane/mcp-gateway": patch
"@fiberplane/mcp-gateway-darwin-arm64": patch
"@fiberplane/mcp-gateway-linux-x64": patch
---

Fix optionalDependencies using workspace: protocol in published package

Changesets doesn't replace workspace:* in optionalDependencies, causing npm/bunx to fail. Now using explicit version numbers that will be kept in sync during releases.
