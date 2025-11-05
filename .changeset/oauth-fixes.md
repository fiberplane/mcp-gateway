---
"@fiberplane/mcp-gateway": patch
---

Fix OAuth discovery for SSE endpoints and preserve upstream cookies on 401 responses

- Restore missing oauth-rewriting module lost during rebase
- Support both /mcp and /sse endpoints in OAuth discovery base URL detection
- Use path-based URL manipulation instead of regex for robust base URL extraction
- Fix Transfer-Encoding/Content-Encoding mismatches in OAuth proxy responses
- Add CORS support for browser-based OAuth clients (MCP Inspector)
- Preserve upstream OAuth cookies (CSRF/state tokens) when adding gateway cookie
- Use scoped cookie path (/.well-known) to minimize conflicts
- Improve cookie parsing to handle edge cases (values with =, malformed URIs)
- Add server name validation for cookie safety
- Log JSON parse errors in OAuth discovery for better debugging
