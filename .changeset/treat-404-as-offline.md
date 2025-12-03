---
"@fiberplane/mcp-gateway": patch
---

Treat HTTP 404 as offline in health checks - a 404 without a session ID indicates the MCP endpoint doesn't exist
