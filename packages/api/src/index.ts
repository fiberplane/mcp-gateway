/**
 * @fiberplane/mcp-gateway-api
 *
 * REST API for querying MCP Gateway logs and managing servers.
 * Exposes HTTP endpoints for log queries, server aggregations, session data, and server CRUD operations.
 */

export type { QueryFunctions } from "@fiberplane/mcp-gateway-types";
export type { CreateAppOptions } from "./app.js";
export { createApp } from "./app.js";
export { createApiRoutes } from "./routes/index.js";
export type { ServerManagementFunctions } from "./routes/server-management.js";
