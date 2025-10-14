---
"@fiberplane/mcp-gateway": patch
---

Fix npx/bunx compatibility using require.resolve() and runtime chmod

Refactored the wrapper script to use `require.resolve()` and `spawnSync()` instead of manual path resolution, following the pattern used by Biome. Added runtime `chmod +x` to ensure binaries are executable since npm may strip execute permissions during publishing. Platform packages no longer declare bin entries.
