import { describe, expect, test } from "bun:test";
import { ServerNotFoundError } from "@fiberplane/mcp-gateway-core";
import type { Logger, McpServer } from "@fiberplane/mcp-gateway-types";
import { Hono } from "hono";
import {
  createServerManagementRoutes,
  type ServerManagementFunctions,
} from "./server-management.js";

// Mock logger for testing
const _mockLogger: Logger = {
  debug: (_message: string, _context?: Record<string, unknown>) => {},
  info: (_message: string, _context?: Record<string, unknown>) => {},
  warn: (_message: string, _context?: Record<string, unknown>) => {},
  error: (_message: string, _context?: Record<string, unknown>) => {},
};

describe("Server Management API", () => {
  describe("POST /servers/:name/health-check", () => {
    test("should trigger health check and return updated server", async () => {
      const mockServer: McpServer = {
        name: "test-server",
        url: "http://localhost:3000",
        type: "http",
        headers: {},
        health: "up",
        lastHealthCheck: new Date().toISOString(),
        lastCheckTime: Date.now(),
        lastHealthyTime: Date.now(),
        responseTimeMs: 123,
        lastActivity: null,
        exchangeCount: 0,
      };

      const serverManagement: ServerManagementFunctions = {
        getRegisteredServers: async () => [mockServer],
        addServer: async () => {},
        updateServer: async () => {},
        removeServer: async () => {},
        checkServerHealth: async (name) => {
          expect(name).toBe("test-server");
          return mockServer;
        },
        restartStdioServer: async () => {},
      };

      const app = new Hono();
      const routes = createServerManagementRoutes(serverManagement);
      app.route("/", routes);

      const response = await app.request("/servers/test-server/health-check", {
        method: "POST",
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as { server: McpServer };
      expect(data.server).toEqual(mockServer);
      if (data.server.type === "http") {
        expect(data.server.health).toBe("up");
      }
    });

    test("should return 404 when server not found", async () => {
      const serverManagement: ServerManagementFunctions = {
        getRegisteredServers: async () => [],
        addServer: async () => {},
        updateServer: async () => {},
        removeServer: async () => {},
        checkServerHealth: async (name) => {
          throw new ServerNotFoundError(name);
        },
        restartStdioServer: async () => {},
      };

      const app = new Hono();
      const routes = createServerManagementRoutes(serverManagement);
      app.route("/", routes);

      const response = await app.request(
        "/servers/non-existent-server/health-check",
        {
          method: "POST",
        },
      );

      expect(response.status).toBe(404);

      const data = (await response.json()) as {
        error: string;
        message: string;
      };
      expect(data.error).toBe("Server not found");
      expect(data.message).toContain("non-existent-server");
    });

    test("should return 500 when health check fails", async () => {
      const serverManagement: ServerManagementFunctions = {
        getRegisteredServers: async () => [],
        addServer: async () => {},
        updateServer: async () => {},
        removeServer: async () => {},
        checkServerHealth: async () => {
          throw new Error("Health check failed");
        },
        restartStdioServer: async () => {},
      };

      const app = new Hono();
      const routes = createServerManagementRoutes(serverManagement);
      app.route("/", routes);

      const response = await app.request("/servers/test-server/health-check", {
        method: "POST",
      });

      expect(response.status).toBe(500);

      const data = (await response.json()) as {
        error: string;
        message: string;
      };
      expect(data.error).toBe("Health check failed");
      expect(data.message).toBe("Health check failed");
    });

    test("should handle server with offline status", async () => {
      const offlineServer: McpServer = {
        name: "offline-server",
        url: "http://localhost:9999",
        type: "http",
        headers: {},
        health: "down",
        lastHealthCheck: new Date().toISOString(),
        lastCheckTime: Date.now(),
        lastErrorTime: Date.now(),
        errorCode: "ECONNREFUSED",
        errorMessage: "Connection refused",
        lastActivity: null,
        exchangeCount: 0,
      };

      const serverManagement: ServerManagementFunctions = {
        getRegisteredServers: async () => [offlineServer],
        addServer: async () => {},
        updateServer: async () => {},
        removeServer: async () => {},
        checkServerHealth: async () => offlineServer,
        restartStdioServer: async () => {},
      };

      const app = new Hono();
      const routes = createServerManagementRoutes(serverManagement);
      app.route("/", routes);

      const response = await app.request(
        "/servers/offline-server/health-check",
        {
          method: "POST",
        },
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as { server: McpServer };
      if (data.server.type === "http") {
        expect(data.server.health).toBe("down");
        expect(data.server.errorCode).toBe("ECONNREFUSED");
        expect(data.server.errorMessage).toBe("Connection refused");
      }
    });

    test("should validate server name parameter", async () => {
      const serverManagement: ServerManagementFunctions = {
        getRegisteredServers: async () => [],
        addServer: async () => {},
        updateServer: async () => {},
        removeServer: async () => {},
        checkServerHealth: async (name) => {
          throw new ServerNotFoundError(name);
        },
        restartStdioServer: async () => {},
      };

      const app = new Hono();
      const routes = createServerManagementRoutes(serverManagement);
      app.route("/", routes);

      // Empty server name should fail validation
      const response = await app.request("/servers//health-check", {
        method: "POST",
      });

      // Hono will likely return 404 for malformed path
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
