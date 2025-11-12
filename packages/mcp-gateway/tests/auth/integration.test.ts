/**
 * Integration test for authentication
 *
 * Tests that:
 * 1. Protected endpoints (/api/*, /gateway/mcp, /g/mcp) require auth
 * 2. Unprotected endpoints (/s/:name/mcp proxy, /, /health) don't require auth
 * 3. Valid tokens grant access to protected endpoints
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp as createApiApp } from "@fiberplane/mcp-gateway-api";
import {
  createGateway,
  logger,
  resetMigrationState,
} from "@fiberplane/mcp-gateway-core";
import { createMcpApp } from "@fiberplane/mcp-gateway-management-mcp";
import type { Gateway } from "@fiberplane/mcp-gateway-types";
import { Hono } from "hono";
import { createAuthMiddleware } from "../../src/middleware/auth.js";

describe("Authentication Integration", () => {
  let storageDir: string;
  let gateway: Gateway;
  let app: Hono;
  const testToken = "test-auth-token-12345";

  beforeAll(async () => {
    // Create temp storage directory
    storageDir = await mkdtemp(join(tmpdir(), "mcp-gateway-auth-test-"));

    // Reset migrations
    resetMigrationState();

    // Initialize logger
    await logger.initialize(storageDir);

    // Create gateway
    gateway = await createGateway({ storageDir });

    // Create app with auth (simulating CLI setup)
    app = new Hono();

    // Protected API routes
    const protectedApi = new Hono();
    const authMiddleware = createAuthMiddleware(testToken);
    protectedApi.use("/*", authMiddleware);
    const apiApp = createApiApp({
      queries: {
        queryLogs: (options) => gateway.storage.query(options),
        getServers: async () => await gateway.storage.getServers(),
        getSessions: (serverName) => gateway.storage.getSessions(serverName),
        getClients: () => gateway.storage.getClients(),
        getMethods: (serverName) => gateway.storage.getMethods(serverName),
        clearSessions: async () => {
          await gateway.storage.clearAll();
        },
      },
      logger,
    });
    protectedApi.route("/", apiApp);
    app.route("/api", protectedApi);

    // Protected management MCP routes
    const managementMcpApp = createMcpApp(gateway);
    const protectedMcp = new Hono();
    protectedMcp.use("/*", authMiddleware);
    protectedMcp.route("/", managementMcpApp);
    app.route("/gateway", protectedMcp);
    app.route("/g", protectedMcp);

    // Unprotected routes (landing page, health)
    app.get("/", (c) => c.text("Landing page"));
    app.get("/health", (c) => c.json({ status: "ok" }));

    // Note: /s/:name/mcp proxy routes would be unprotected in real setup
    // but we don't test them here as they require full server setup
  });

  afterAll(async () => {
    await gateway?.close();
    await rm(storageDir, { recursive: true, force: true });
    resetMigrationState();
  });

  describe("Protected API endpoints", () => {
    test("rejects requests without auth", async () => {
      const response = await app.request("/api/logs");

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toHaveProperty("error");
      expect(json.error).toContain("Missing or invalid Authorization header");
    });

    test("rejects requests with invalid token", async () => {
      const response = await app.request("/api/logs", {
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toHaveProperty("error");
      expect(json.error).toBe("Invalid token");
    });

    test("allows requests with valid token", async () => {
      const response = await app.request("/api/logs", {
        headers: {
          Authorization: `Bearer ${testToken}`,
        },
      });

      // Should succeed (200 or other success status, not 401)
      expect(response.status).not.toBe(401);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe("Protected management MCP endpoints", () => {
    test("/gateway/mcp rejects requests without auth", async () => {
      const response = await app.request("/gateway/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        }),
      });

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toHaveProperty("error");
    });

    test("/g/mcp rejects requests without auth", async () => {
      const response = await app.request("/g/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        }),
      });

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toHaveProperty("error");
    });

    test("/gateway/mcp allows requests with valid token", async () => {
      const response = await app.request("/gateway/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        }),
      });

      // Should succeed (200 or other success status, not 401)
      expect(response.status).not.toBe(401);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe("Unprotected endpoints", () => {
    test("landing page accessible without auth", async () => {
      const response = await app.request("/");

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe("Landing page");
    });

    test("health endpoint accessible without auth", async () => {
      const response = await app.request("/health");

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ status: "ok" });
    });
  });
});
