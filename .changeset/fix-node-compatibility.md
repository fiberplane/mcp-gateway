---
"@fiberplane/mcp-gateway": patch
---

Fix Node.js compatibility by externalizing @opentui packages in build

The build was bundling @opentui/core which uses Bun-specific APIs (bun:ffi), making the package incompatible with Node.js. Now @opentui packages are treated as external dependencies.
