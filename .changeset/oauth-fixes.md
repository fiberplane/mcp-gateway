---
"@fiberplane/mcp-gateway": patch
---

Fix OAuth discovery and preserve upstream cookies on 401 responses

- Restore missing oauth-rewriting module lost during rebase
- Use path-based URL manipulation for robust base URL extraction
- Fix Transfer-Encoding/Content-Encoding mismatches in OAuth proxy responses
- Add CORS support for browser-based OAuth clients
- Preserve upstream OAuth cookies when adding gateway cookie
- Use scoped cookie path to minimize conflicts
- Improve cookie parsing to handle edge cases
- Add server name validation for cookie safety
- Log JSON parse errors in OAuth discovery for better debugging
