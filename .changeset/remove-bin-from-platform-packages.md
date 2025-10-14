---
"@fiberplane/mcp-gateway": patch
"@fiberplane/mcp-gateway-darwin-arm64": patch
"@fiberplane/mcp-gateway-linux-x64": patch
---

Remove bin field from platform packages to fix npx execution

Platform packages should not have bin fields as this causes npx to try executing the binary directly instead of going through the wrapper script. Only the CLI wrapper package should declare the bin entry point.
