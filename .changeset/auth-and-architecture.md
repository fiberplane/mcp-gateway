---
"@fiberplane/mcp-gateway": minor
---

Add token-based authentication and refactor web UI architecture

**Authentication:**
- Auto-generate secure Bearer tokens (or use `MCP_GATEWAY_TOKEN` env var)
- Protect `/api/*` and `/gateway/mcp` endpoints with token auth
- Display token in web UI URL: `http://localhost:3333/ui?token=...`
- Security hardening: constant-time comparison, DoS protection, input validation

**Package Structure:**
- Extract `@fiberplane/mcp-gateway-management-mcp` package for gateway MCP server
- Cleaner separation: server handles proxy/OAuth, management-mcp handles gateway tools
- CLI orchestrates management MCP at `/gateway/mcp` with auth middleware

**Web UI Architecture:**
- Eliminate API prop drilling using React Context pattern
- Domain hooks (`useServers()`, `useHealthCheck()`) hide context internally
- `IApiClient` interface for type safety (zero type assertions)
- Fix critical bugs: ApiContext availability and shared auth state

**Documentation:**
- Comprehensive authentication docs (setup, security, troubleshooting)
- Updated web/API READMEs with architecture details
- Security guidelines in SECURITY.md
