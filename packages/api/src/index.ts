/**
 * @fiberplane/mcp-gateway-api
 *
 * REST API for querying MCP Gateway logs.
 * Exposes HTTP endpoints for log queries, server aggregations, and session data.
 */

export { createApp } from "./app.js";
export { createApiRoutes, type QueryFunctions } from "./routes/index.js";
