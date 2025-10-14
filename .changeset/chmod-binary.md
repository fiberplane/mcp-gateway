---
"@fiberplane/mcp-gateway": patch
---

Make binary executable at runtime in wrapper

npm doesn't preserve execute permissions on binary files. The wrapper now runs chmod on the binary before executing it to ensure it has execute permissions.
