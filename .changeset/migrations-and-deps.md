---
"@fiberplane/mcp-gateway": patch
---

**Migrations**: Include migrations in published package - server_health table and logs columns (input_tokens, output_tokens, method_detail)

**Dependencies**: Implement automated dependency management - CLI package.json now lists only direct dependencies, with merge-dependencies script collecting transitive deps from internal packages before publishing
