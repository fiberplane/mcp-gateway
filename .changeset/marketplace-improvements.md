---
"@fiberplane/mcp-gateway": minor
---

### Web UI Improvements
- Add TanStack Router with page-based navigation (Home, Marketplace, Servers)
- Add PageLayout component with consistent header and navigation
- Improve marketplace cards with pill-styled tags and gateway URL display
- Add status color indicators for server health (online/offline/error)
- Show gateway URL on server details page with copy button
- Improve accessibility with focus indicators and reduced motion support
- Fix URL query param sync using nuqs TanStack Router adapter

### Client/Server Info Display Fixes
- Fix client/server info showing for `initialize` requests but `-` for subsequent requests
- Add stateless fallback for client info lookup
- Persist client info under real session ID for HTTP servers
- Extract serverInfo from SSE initialize responses
- Use updated client/server info for stdio response records

### SSE Handling Improvements
- Add 5-second timeout to `extractServerInfoFromSSE` to prevent hanging on slow servers
- Consolidate duplicate SSE capture error handling into `logSSECaptureError` helper
- Add debug logging for JSON parse failures in SSE extraction

### CLI Improvements
- Add helpful welcome message with getting started tips for new users
- Show clear instructions on how to add servers and view logs
