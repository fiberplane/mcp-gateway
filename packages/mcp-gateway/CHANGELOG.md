# @fiberplane/mcp-gateway

## 0.6.0

### Minor Changes

- 64786e5: Add token-based authentication and refactor web UI architecture

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

- 0ef3447: Add stdio MCP server support with session isolation

  **New Features:**

  - **Stdio server support**: Run MCP servers as child processes (npx, node, python, etc.)
  - **Session modes**: Shared (default) or isolated mode with separate processes per session
  - **Process management**: Auto health checks, manual restart, hang detection
  - **UI improvements**: Process status banner, stderr logs viewer, session mode display
  - **Advanced features**: JSON-RPC id namespacing, session limit (100), stderr buffering (10MB)

  **Core Changes:**

  - Add subprocess management with StdioSessionManager
  - Implement session isolation with automatic session ID generation
  - Add health timestamp preservation across state changes
  - Support serverInfo persistence and backfilling for stdio servers
  - Proper shell-style argument parsing with quote and escape handling

  **UI/UX:**

  - New stdio process status banner with restart button
  - Stderr logs viewer with last 100 lines
  - Server form improvements for stdio configuration
  - Accessibility fixes (WCAG Level A compliance)
  - Health status indicators with timestamps

  **Documentation:**

  - Add stdio server usage guide
  - Document session isolation patterns
  - Add troubleshooting section for stdio servers
  - Document bun watch mode shutdown behavior

## 0.5.1

### Patch Changes

- 0487996: Improved server error state handling with health monitoring and better UX

  - Added server health banner showing error details when servers are offline
  - Fixed server health data sync between empty state and tabs (consolidated to single endpoint)
  - Fixed filter preservation - server selection now maintained when adding/removing filters
  - Added health check retry functionality with loading states
  - Improved error message formatting and display
  - Added timestamp validation for time-ago displays

## 0.5.0

### Minor Changes

- 424d3b6: Capture client and server identification metadata in all MCP traffic logs. The gateway now records client IP addresses, user agents, client info (name/version), and server info (name/version/title) for better observability and debugging. This metadata is captured from initialize handshakes and HTTP request headers, then attached to all subsequent request/response records in the session.
- 525ed85: **Breaking Changes:**

  - Removed Terminal UI (TUI) - CLI now runs in headless HTTP server mode only
  - Changed from bun:sqlite to libsql for cross-runtime compatibility (Bun + Node.js)
  - removed binary packages (no more bun requirements to run the packages). It is still required for development

  **Migration Guide:**

  - No action required for most users - CLI behavior remains the same
  - Server starts automatically on `mcp-gateway` command
  - Web UI available at http://localhost:3333/ui

- 398b235: Add server management UI and advanced filtering system

  **Server Management:**

  - Add/edit/delete MCP server configurations through web UI
  - Server management dropdown with modal interface
  - REST API endpoints for server configuration CRUD operations
  - URL validation and normalization with custom headers support

  **Filtering System:**

  - Type-safe filter system for log browsing
  - Filter by: search text, client, method, session, server, duration, tokens
  - Operator selection: "contains" and "is" (exact match) for strings
  - Comparison operators for numbers: equals, greater than, less than, etc.
  - Multi-select support with visual filter badges
  - URL-based filter state persistence

  **UI Improvements:**

  - Settings dropdown replaces top navigation
  - Fiberplane branding in header
  - Filter bar with intro animations
  - Improved responsive layout (max-width 1600px)
  - Error boundary for filter system

  **Testing Infrastructure:**

  - Workspace-specific test configurations (bunfig.toml)
  - Sentinel test to guide users to correct test command
  - Fixed React test environment issues

  **Bug Fixes:**

  - Filter operator backward compatibility
  - API string filter parsing with operator:value format
  - Test failures when running from root directory

- 8a1640c: Adds support for proxying GET and DELETE routes, as well as support for client-to-server resposes (sampling, elicitation)
- 46c3f35: Add token estimation and method detail display

  - Token tracking with input/output breakdown
  - Method details showing function calls and response previews

- f347d0e: Add web UI MVP with SQLite storage, query API, and interactive log viewer

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
  - Beautiful landing page at root (/) with web design system styling
  - Landing page includes version badge, welcome message, "Open Web UI" button, and API endpoints reference

  **Code Quality:**

  - Removed JSONL storage backend and references for SQLite-only architecture
  - Fixed Biome linter warnings for optional chaining and unused parameters
  - Cleaned up unused imports and deprecated functions

  **Developer Experience:**

  - Comprehensive documentation for web UI architecture and implementation
  - API specification and design tokens documented
  - Planning documents for real-time updates and future enhancements

### Patch Changes

- 3a0ffa7: Improved empty state UX with dedicated screens and enhanced server management modals
- 525ed85: **Migrations**: Include migrations in published package - server_health table and logs columns (input_tokens, output_tokens, method_detail)

  **Dependencies**: Implement automated dependency management - CLI package.json now lists only direct dependencies, with merge-dependencies script collecting transitive deps from internal packages before publishing

- 3c90498: Fix OAuth discovery and preserve upstream cookies on 401 responses

  - Restore missing oauth-rewriting module lost during rebase
  - Use path-based URL manipulation for robust base URL extraction
  - Fix Transfer-Encoding/Content-Encoding mismatches in OAuth proxy responses
  - Add CORS support for browser-based OAuth clients
  - Preserve upstream OAuth cookies when adding gateway cookie
  - Use scoped cookie path to minimize conflicts
  - Improve cookie parsing to handle edge cases
  - Add server name validation for cookie safety
  - Log JSON parse errors in OAuth discovery for better debugging
  - Avoid duplicate fetch when JSON parsing fails in protected resource proxy
  - Fix server cookie not reaching client by appending to proxied responses
  - Set server cookie on all server-specific well-known paths for consistency
  - Synthesize oauth-protected-resource from oauth-authorization-server when 404

- 30a3a05: Persist server tab selection in URL query string, add dev setup instructions to README, and add GitHub/Discord links to navbar
- af2b7dc: Polish log table UI and improve accessibility with better focus indicators, solid color system, and improved keyboard navigation support for row expansion.
- d92b315: Refactored web UI: extracted 10 reusable components and removed 6 unused components for improved maintainability

## 0.4.1-next.0

### Patch Changes

- Updated dependencies
  - @fiberplane/mcp-gateway-types@0.2.0-next.0
  - @fiberplane/mcp-gateway-core@0.2.0-next.0
  - @fiberplane/mcp-gateway-server@0.2.0-next.0

## 0.4.0

### Minor Changes

- 6dd9560: Add new (terminal) UI experience

## 0.3.3

### Patch Changes

- 14eed22: Fix the same content-length issue in response headers.

## 0.3.2

### Patch Changes

- c386ee7: Fix a duplicate content-length header issue.

## 0.3.1

### Patch Changes

- 6be35bc: Fix publishing flow.

## 0.3.0

### Minor Changes

- d4fc826: TUI has been reworked, supports adding/removing server connections, shows live activity (and health status). MCP features of the gateway itself are more optimized. The README has been improved.

## 0.2.3

### Patch Changes

- 5c64a14: VERY GOOD UI

## 0.2.2

### Patch Changes

- 4131a5a: Fix the binary releases.

## 0.2.1

### Patch Changes

- 5dd5193: Replace Bun-APIs with Node ones for now.

## 0.2.0

### Minor Changes

- 5d6e93e: Initial MCP traffic interception logic + CLI flow

### Patch Changes

- 23a855e: Add simple ui routing (no real ui yet)
- a3c3d24: Fix type errors.

## 0.1.1

### Patch Changes

- f479f5f: Initial CLI flow.
