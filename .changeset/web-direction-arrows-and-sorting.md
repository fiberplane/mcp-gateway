---
"@fiberplane/mcp-gateway": minor
"@fiberplane/mcp-gateway-cli": minor
"@fiberplane/mcp-gateway-server": minor
"@fiberplane/mcp-gateway-api": minor
"@fiberplane/mcp-gateway-core": minor
"@fiberplane/mcp-gateway-types": minor
---

Add web UI MVP with SQLite storage, query API, and interactive log viewer

This release introduces a comprehensive web-based user interface for viewing and analyzing MCP Gateway traffic, along with supporting backend infrastructure.

**New Packages:**
- `@fiberplane/mcp-gateway-api` - REST API for querying logs with filtering and pagination
- `@fiberplane/mcp-gateway-web` - React-based web UI for viewing logs

**Storage & Query Infrastructure:**
- SQLite storage backend with composable architecture for MCP traffic capture
- Database schema with Drizzle ORM for efficient log queries
- Query API with filtering by server, session, method, and time range
- Support for both SQLite and JSONL storage backends

**Web UI Features:**
- Interactive log table with expandable request/response details
- Column sorting (timestamp, server, session, method, duration)
- Direction indicators showing request (↓) vs response (↑) traffic
- Checkbox selection and client-side JSONL export
- Server and session filtering
- Method badges with color coding
- Copy-to-clipboard for request/response payloads

**Server Enhancements:**
- Dependency injection with flat options object pattern
- Optional web UI serving via `publicDir` parameter
- Integrated web UI at `/ui` endpoint in CLI
- `--no-tui` flag for running without terminal UI

**CLI Improvements:**
- Serve web UI at `http://localhost:3333/ui` by default
- Mount query API at `/api` endpoint
- Fixed session and server filtering parameter names

**Developer Experience:**
- Comprehensive documentation for web UI architecture and implementation
- API specification and design tokens documented
- Planning documents for real-time updates and future enhancements
