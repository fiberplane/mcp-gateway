---
"@fiberplane/mcp-gateway": minor
---

**Breaking Changes:**
- Removed Terminal UI (TUI) - CLI now runs in headless HTTP server mode only
- Changed from bun:sqlite to libsql for cross-runtime compatibility (Bun + Node.js)

**Migration Guide:**
- No action required for most users - CLI behavior remains the same
- Server starts automatically on `mcp-gateway` command
- Web UI available at http://localhost:3333/ui
