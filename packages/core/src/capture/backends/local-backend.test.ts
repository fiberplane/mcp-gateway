import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { McpServerConfig } from "@fiberplane/mcp-gateway-types";
import { resetMigrationState } from "../../logs/migrations.js";
import { LocalStorageBackend } from "./local-backend.js";

describe("LocalStorageBackend - Health Status Loading", () => {
  let storageDir: string;
  let backend: LocalStorageBackend;

  beforeEach(async () => {
    // Reset migration state to allow fresh migrations for each test
    resetMigrationState();

    // Create temporary directory for each test
    storageDir = await mkdtemp(join(tmpdir(), "mcp-gateway-test-"));

    // Create backend instance
    backend = await LocalStorageBackend.create(storageDir);
  });

  afterEach(async () => {
    // Close backend connection
    await backend.close();

    // Clean up temporary directory
    await rm(storageDir, { recursive: true, force: true });

    // Reset migration state after cleanup
    resetMigrationState();
  });

  describe("getRegisteredServers", () => {
    test("should return empty array when no servers registered", async () => {
      const servers = await backend.getRegisteredServers();

      expect(servers).toHaveLength(0);
    });

    test("should return server with undefined health when no health check exists", async () => {
      // Add a server
      const serverConfig: McpServerConfig = {
        name: "test-server",
        url: "http://localhost:3001/mcp",
        type: "http",
        headers: {},
      };
      await backend.addServer(serverConfig);

      // Get registered servers
      const servers = await backend.getRegisteredServers();

      expect(servers).toHaveLength(1);
      expect(servers[0]?.name).toBe("test-server");
      const server = servers[0];
      expect(server.type).toEqual("http");
      if (server?.type === "http") {
        expect(server.url).toBe("http://localhost:3001/mcp");
        expect(server.health).toBeUndefined();
        expect(server.lastHealthCheck).toBeUndefined();
      }
    });

    test("should return server with health='up' when health check exists", async () => {
      // Add a server
      const serverConfig: McpServerConfig = {
        name: "test-server",
        url: "http://localhost:3001/mcp",
        type: "http",
        headers: {},
      };
      await backend.addServer(serverConfig);

      // Upsert health status
      const lastCheck = new Date().toISOString();
      await backend.upsertServerHealth(
        "test-server",
        "up",
        lastCheck,
        "http://localhost:3001/mcp",
      );

      // Get registered servers
      const servers = await backend.getRegisteredServers();

      expect(servers).toHaveLength(1);
      const server = servers[0];
      expect(server?.name).toBe("test-server");
      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe("up");
        expect(server.lastHealthCheck).toBe(lastCheck);
      }
    });

    test("should return server with health='down' when health check shows down", async () => {
      // Add a server
      const serverConfig: McpServerConfig = {
        name: "test-server",
        url: "http://localhost:3001/mcp",
        type: "http",
        headers: {},
      };
      await backend.addServer(serverConfig);

      // Upsert health status as down
      const lastCheck = new Date().toISOString();
      await backend.upsertServerHealth(
        "test-server",
        "down",
        lastCheck,
        "http://localhost:3001/mcp",
      );

      // Get registered servers
      const servers = await backend.getRegisteredServers();

      expect(servers).toHaveLength(1);
      const server = servers[0];
      expect(server?.name).toBe("test-server");
      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe("down");
        expect(server.lastHealthCheck).toBe(lastCheck);
      }
    });

    test("should return multiple servers with different health statuses", async () => {
      // Add multiple servers
      await backend.addServer({
        name: "server-up",
        url: "http://localhost:3001/mcp",
        type: "http",
        headers: {},
      });
      await backend.addServer({
        name: "server-down",
        url: "http://localhost:3002/mcp",
        type: "http",
        headers: {},
      });
      await backend.addServer({
        name: "server-unknown",
        url: "http://localhost:3003/mcp",
        type: "http",
        headers: {},
      });

      // Set health for two servers
      const now = new Date().toISOString();
      await backend.upsertServerHealth(
        "server-up",
        "up",
        now,
        "http://localhost:3001/mcp",
      );
      await backend.upsertServerHealth(
        "server-down",
        "down",
        now,
        "http://localhost:3002/mcp",
      );

      // Get registered servers
      const servers = await backend.getRegisteredServers();

      expect(servers).toHaveLength(3);

      const serverUp = servers.find((s) => s.name === "server-up");
      const serverDown = servers.find((s) => s.name === "server-down");
      const serverUnknown = servers.find((s) => s.name === "server-unknown");

      expect(serverUp?.type).toBe("http");
      expect(serverDown?.type).toBe("http");
      expect(serverUnknown?.type).toBe("http");

      if (serverUp?.type === "http") {
        expect(serverUp.health).toBe("up");
      }
      if (serverDown?.type === "http") {
        expect(serverDown.health).toBe("down");
      }
      if (serverUnknown?.type === "http") {
        expect(serverUnknown.health).toBeUndefined();
      }
    });

    test("should include server metrics (lastActivity, exchangeCount) along with health", async () => {
      // Add a server
      await backend.addServer({
        name: "test-server",
        url: "http://localhost:3001/mcp",
        type: "http",
        headers: {},
      });

      // Set health
      await backend.upsertServerHealth(
        "test-server",
        "up",
        new Date().toISOString(),
        "http://localhost:3001/mcp",
      );

      // Get registered servers
      const servers = await backend.getRegisteredServers();

      expect(servers).toHaveLength(1);
      const server = servers[0];
      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe("up");
      }
      expect(server?.lastActivity).toBeDefined();
      expect(server?.exchangeCount).toBeDefined();
    });

    test("should update health when upserted multiple times", async () => {
      // Add a server
      await backend.addServer({
        name: "test-server",
        url: "http://localhost:3001/mcp",
        type: "http",
        headers: {},
      });

      // Initial health: up
      const firstCheck = new Date().toISOString();
      await backend.upsertServerHealth(
        "test-server",
        "up",
        firstCheck,
        "http://localhost:3001/mcp",
      );

      let servers = await backend.getRegisteredServers();
      let server = servers[0];
      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe("up");
        expect(server.lastHealthCheck).toBe(firstCheck);
      }

      // Update health: down
      const secondCheck = new Date().toISOString();
      await backend.upsertServerHealth(
        "test-server",
        "down",
        secondCheck,
        "http://localhost:3001/mcp",
      );

      servers = await backend.getRegisteredServers();
      server = servers[0];
      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe("down");
        expect(server.lastHealthCheck).toBe(secondCheck);
      }
    });
  });

  describe("upsertServerHealth", () => {
    test("should persist health data to database", async () => {
      const serverName = "test-server";
      const health = "up";
      const lastCheck = new Date().toISOString();
      const url = "http://localhost:3001/mcp";

      await backend.upsertServerHealth(serverName, health, lastCheck, url);

      // Verify by getting server (assuming it would be in registry)
      await backend.addServer({
        name: serverName,
        url,
        type: "http",
        headers: {},
      });

      const servers = await backend.getRegisteredServers();
      const server = servers.find((s) => s.name === serverName);

      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe(health);
        expect(server.lastHealthCheck).toBe(lastCheck);
      }
    });

    test("should handle health='down' status", async () => {
      const serverName = "test-server";
      const health = "down";
      const lastCheck = new Date().toISOString();
      const url = "http://localhost:3001/mcp";

      await backend.upsertServerHealth(serverName, health, lastCheck, url);

      await backend.addServer({
        name: serverName,
        url,
        type: "http",
        headers: {},
      });

      const servers = await backend.getRegisteredServers();
      const server = servers.find((s) => s.name === serverName);

      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe("down");
      }
    });
  });
});
