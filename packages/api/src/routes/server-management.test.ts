import { describe, expect, test } from "bun:test";
import type {
  Logger,
  McpServer,
  McpServerConfig,
} from "@fiberplane/mcp-gateway-types";
import { Hono } from "hono";
import {
  type ServerManagementFunctions,
  createServerManagementRoutes,
} from "./server-management.js";

// Mock logger for testing
const mockLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
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
      };

      const app = new Hono();
      const routes = createServerManagementRoutes(serverManagement, mockLogger);
      app.route("/", routes);

      const response = await app.request("/servers/test-server/health-check", {
        method: "POST",
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as { server: McpServer };
      expect(data.server).toEqual(mockServer);
      expect(data.server.health).toBe("up");
    });

    test("should return 404 when server not found", async () => {
      const serverManagement: ServerManagementFunctions = {
        getRegisteredServers: async () => [],
        addServer: async () => {},
        updateServer: async () => {},
        removeServer: async () => {},
        checkServerHealth: async () => undefined,
      };

      const app = new Hono();
      const routes = createServerManagementRoutes(serverManagement, mockLogger);
      app.route("/", routes);

      const response = await app.request(
        "/servers/non-existent-server/health-check",
        {
          method: "POST",
        },
      );

      expect(response.status).toBe(404);

      const data = (await response.json()) as { error: string; message: string };
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
      };

      const app = new Hono();
      const routes = createServerManagementRoutes(serverManagement, mockLogger);
      app.route("/", routes);

      const response = await app.request("/servers/test-server/health-check", {
        method: "POST",
      });

      expect(response.status).toBe(500);

      const data = (await response.json()) as { error: string; message: string };
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
      };

      const serverManagement: ServerManagementFunctions = {
        getRegisteredServers: async () => [offlineServer],
        addServer: async () => {},
        updateServer: async () => {},
        removeServer: async () => {},
        checkServerHealth: async () => offlineServer,
      };

      const app = new Hono();
      const routes = createServerManagementRoutes(serverManagement, mockLogger);
      app.route("/", routes);

      const response = await app.request(
        "/servers/offline-server/health-check",
        {
          method: "POST",
        },
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as { server: McpServer };
      expect(data.server.health).toBe("down");
      expect(data.server.errorCode).toBe("ECONNREFUSED");
      expect(data.server.errorMessage).toBe("Connection refused");
    });

    test("should validate server name parameter", async () => {
      const serverManagement: ServerManagementFunctions = {
        getRegisteredServers: async () => [],
        addServer: async () => {},
        updateServer: async () => {},
        removeServer: async () => {},
        checkServerHealth: async () => undefined,
      };

      const app = new Hono();
      const routes = createServerManagementRoutes(serverManagement, mockLogger);
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
