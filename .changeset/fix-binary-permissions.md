---
"@fiberplane/mcp-gateway": patch
"@fiberplane/mcp-gateway-darwin-arm64": patch
"@fiberplane/mcp-gateway-linux-x64": patch
---

Fix binary execute permissions in published packages

Add bin field to platform packages so npm preserves execute permissions on binary files. Also improve error handling to show EACCES errors when binary is not executable.
