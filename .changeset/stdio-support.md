---
"@fiberplane/mcp-gateway": minor
---

Add stdio MCP server support with session isolation

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
