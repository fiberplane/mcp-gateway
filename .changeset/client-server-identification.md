---
"@fiberplane/mcp-gateway": minor
---

Capture client and server identification metadata in all MCP traffic logs. The gateway now records client IP addresses, user agents, client info (name/version), and server info (name/version/title) for better observability and debugging. This metadata is captured from initialize handshakes and HTTP request headers, then attached to all subsequent request/response records in the session.
