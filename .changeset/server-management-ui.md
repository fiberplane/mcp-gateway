---
"@fiberplane/mcp-gateway": minor
---

Add server management UI and advanced filtering system

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
