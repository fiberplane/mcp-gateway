#!/usr/bin/env bun
/**
 * Development server for API package
 *
 * Starts the API server on http://localhost:3000
 * Uses ~/.mcp-gateway/captures as the default storage directory
 */
import { homedir } from "node:os";
import { join } from "node:path";
import {
  getServers,
  getSessions,
  queryLogs,
} from "@fiberplane/mcp-gateway-core";
import { Hono } from "hono";
import { createApp } from "./app.js";

// Get storage directory from environment or use default
const storageDir =
  process.env.STORAGE_DIR || join(homedir(), ".mcp-gateway", "captures");

// Get port from environment or use default
const port = Number.parseInt(process.env.PORT || "3000", 10);

// Create app with dependency injection
const apiApp = await createApp(storageDir, {
  queryLogs,
  getServers,
  getSessions,
});

// Create main app and mount API routes at /api
const app = new Hono();
app.route("/api", apiApp);

// Start server
const server = Bun.serve({
  port,
  fetch: app.fetch,
});

// biome-ignore lint/suspicious/noConsole: Console output is appropriate for dev server
console.log(`🚀 API server running at http://localhost:${server.port}`);
// biome-ignore lint/suspicious/noConsole: Console output is appropriate for dev server
console.log(`📁 Storage directory: ${storageDir}`);
// biome-ignore lint/suspicious/noConsole: Console output is appropriate for dev server
console.log("");
// biome-ignore lint/suspicious/noConsole: Console output is appropriate for dev server
console.log("API endpoints:");
// biome-ignore lint/suspicious/noConsole: Console output is appropriate for dev server
console.log(`  GET  http://localhost:${server.port}/api/logs`);
// biome-ignore lint/suspicious/noConsole: Console output is appropriate for dev server
console.log(`  GET  http://localhost:${server.port}/api/servers`);
// biome-ignore lint/suspicious/noConsole: Console output is appropriate for dev server
console.log(`  GET  http://localhost:${server.port}/api/sessions`);
