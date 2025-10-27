---
"@fiberplane/mcp-gateway": patch
---

Consolidate method detail formatting and fix Windows path detection

**Method Detail Consolidation**
- Compute methodDetail once in proxy layer, use everywhere (TUI events + database)
- Unified formatting between TUI and Web UI for consistent experience
- Deleted TUI formatters.ts (131 lines) - single source of truth in core package
- Enhanced response previews to match TUI output (e.g., "19 tools: echo, add, multiply, +7")

**Smart URI Truncation**
- Implemented smart URI truncation preserving protocol and filename
- Example: `file:///very/long/path/to/file.txt` → `file://.../file.txt`
- Applied to resources/read URIs and tool arguments

**Windows Path Fix (Critical)**
- Fixed URI regex to require `://` instead of `:/?/?`
- Prevents Windows paths like `C:\Users\...` from being incorrectly treated as URIs
- Windows paths now handled as regular strings without truncation

**Type Safety Improvements**
- Added `as const` type annotations for direction literals (5 locations)
- Improved type narrowing for better compile-time safety

**Architecture**
- Added methodDetail field to LogEntry type for TUI events
- Updated ProxyDependencies interface to pass methodDetail
- Updated capture functions to accept pre-computed methodDetail
- TUI now uses pre-computed methodDetail from events instead of computing client-side

