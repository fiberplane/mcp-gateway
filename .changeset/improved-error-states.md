---
"@fiberplane/mcp-gateway": patch
---

Improved server error state handling with health monitoring and better UX

- Added server health banner showing error details when servers are offline
- Fixed server health data sync between empty state and tabs (consolidated to single endpoint)
- Fixed filter preservation - server selection now maintained when adding/removing filters
- Added health check retry functionality with loading states
- Improved error message formatting and display
- Added timestamp validation for time-ago displays
