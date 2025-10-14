---
"@fiberplane/mcp-gateway": patch
"@fiberplane/mcp-gateway-darwin-arm64": patch
"@fiberplane/mcp-gateway-linux-x64": patch
---

Fix npx compatibility by following Biome's binary distribution pattern

Refactored the wrapper script to use `require.resolve()` and `spawnSync()` instead of manual path resolution, following the industry-standard pattern used by Biome and other binary distribution packages. Platform packages no longer declare bin entries, which was causing npx to fail. The build script ensures binaries have correct execute permissions.
