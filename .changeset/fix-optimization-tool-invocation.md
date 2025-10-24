---
"@fiberplane/mcp-gateway-core": patch
"@fiberplane/mcp-gateway-cli": patch
---

Fix tool invocation in optimization evaluations

The optimization evaluation system was failing to invoke tools during subprocess Claude sessions, resulting in 0% success on direct/indirect prompts and 100% on negative prompts (because no tools were available to invoke).

This fix:
- Creates temporary server entries in the registry for each candidate being evaluated
- Generates temporary .mcp.json configs that connect subprocess Claude to the gateway
- Connects temp servers to clientManager to preserve authentication (OAuth, headers, etc.)
- Properly cleans up temp servers and config files after evaluation

Evaluations now work correctly with `--enable-mcp-client` flag, allowing Claude to actually invoke the tools with candidate descriptions and measure success rates accurately.
