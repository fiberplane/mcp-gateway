/**
 * Integration test for health check → storage → API flow
 *
 * This test verifies the complete health check system works end-to-end:
 * 1. Health checks run and persist to database
 * 2. Storage loads health data correctly
 * 3. API endpoint returns correct status
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
import type { Gateway, ServerInfo } from "@fiberplane/mcp-gateway-types";

// Response type for /servers endpoint
type ServersResponse = {
  servers: ServerInfo[];
};

describe("Health Check → API Integration", () => {
  let storageDir: string;
  let gateway: Gateway;
  let testServer: { url: string; stop: () => void } | null = null;

  beforeAll(async () => {
    // Create temp storage directory
    storageDir = await mkdtemp(join(tmpdir(), "mcp-gateway-test-"));

    // Reset migrations
    resetMigrationState();

    // Initialize logger
    await logger.initialize(storageDir);

    // Create a test HTTP server
    // Use port 0 to let OS assign an available port
    const server = Bun.serve({
      port: 0,
      fetch: () => new Response("OK", { status: 200 }),
    });

    testServer = {
      url: `http://localhost:${server.port}`,
      stop: () => server.stop(),
    };

    // Create gateway
    gateway = await createGateway({ storageDir });
  });

  afterAll(async () => {
    // Cleanup
    await gateway?.close();
    testServer?.stop();
    await rm(storageDir, { recursive: true, force: true });
    resetMigrationState();
  });

  test("servers show correct initial status on startup", async () => {
    if (!testServer) {
      throw new Error("Test server not found");
    }

    // Add a server
    await gateway.storage.addServer({
      name: "test-server",
      url: testServer.url,
      type: "http",
      headers: {},
    });

    // Run initial health check (simulating startup)
    await gateway.health.check();

    // Get servers from storage (this is what TUI does)
    const servers = await gateway.storage.getRegisteredServers();

    expect(servers).toHaveLength(1);
    expect(servers[0]?.name).toBe("test-server");
    expect(servers[0]?.health).toBe("up");
    expect(servers[0]?.lastHealthCheck).toBeDefined();
  });

  test("API endpoint returns servers with correct status", async () => {
    // Create API app with gateway's storage
    const apiApp = createApiApp(
      {
        queryLogs: (options) => gateway.storage.query(options),
        getServers: async () => await gateway.storage.getServers(),
        getSessions: (serverName) => gateway.storage.getSessions(serverName),
        getClients: () => gateway.storage.getClients(),
        clearSessions: async () => {
          await gateway.storage.clearAll();
        },
      },
      logger,
    );

    // Query API endpoint
    const response = await apiApp.request("/servers");
    const data = (await response.json()) as ServersResponse;

    expect(response.status).toBe(200);
    expect(data.servers).toHaveLength(1);
    expect(data.servers[0]?.name).toBe("test-server");
    expect(data.servers[0]?.status).toBe("online"); // health='up' maps to status='online'
  });

  test("health status updates when server goes down", async () => {
    // Update server to point to unreachable address
    // Use a high ephemeral port that's very unlikely to be in use
    await gateway.storage.updateServer("test-server", {
      url: "http://127.0.0.1:59999",
    });

    // Run health check again
    await gateway.health.check();

    // Verify storage shows server as down
    const servers = await gateway.storage.getRegisteredServers();
    expect(servers[0]?.health).toBe("down");

    // Verify API shows offline
    const apiApp = createApiApp(
      {
        queryLogs: (options) => gateway.storage.query(options),
        getServers: async () => await gateway.storage.getServers(),
        getSessions: (serverName) => gateway.storage.getSessions(serverName),
        getClients: () => gateway.storage.getClients(),
        clearSessions: async () => {
          await gateway.storage.clearAll();
        },
      },
      logger,
    );

    const response = await apiApp.request("/servers");
    const data = (await response.json()) as ServersResponse;

    expect(data.servers[0]?.status).toBe("offline"); // health='down' maps to status='offline'
  });

  test("multiple servers show different statuses correctly", async () => {
    // Start a second test server
    const server2 = Bun.serve({
      port: 0,
      fetch: () => new Response("OK", { status: 200 }),
    });

    // Add both servers
    await gateway.storage.addServer({
      name: "server-up",
      url: `http://localhost:${server2.port}`,
      type: "http",
      headers: {},
    });

    // Run health checks
    await gateway.health.check();

    // Create API
    const apiApp = createApiApp(
      {
        queryLogs: (options) => gateway.storage.query(options),
        getServers: async () => await gateway.storage.getServers(),
        getSessions: (serverName) => gateway.storage.getSessions(serverName),
        getClients: () => gateway.storage.getClients(),
        clearSessions: async () => {
          await gateway.storage.clearAll();
        },
      },
      logger,
    );

    // Query API
    const response = await apiApp.request("/servers");
    const data = (await response.json()) as ServersResponse;

    expect(data.servers).toHaveLength(2);

    const serverDown = data.servers.find((s) => s.name === "test-server");
    const serverUp = data.servers.find((s) => s.name === "server-up");

    expect(serverDown?.status).toBe("offline"); // First server is still down
    expect(serverUp?.status).toBe("online"); // Second server is up

    // Cleanup
    server2.stop();
  });

  test("servers without logs show correct status from health checks", async () => {
    // Add a new server that has no logs
    const server3 = Bun.serve({
      port: 0,
      fetch: () => new Response("OK", { status: 200 }),
    });

    await gateway.storage.addServer({
      name: "new-server-no-logs",
      url: `http://localhost:${server3.port}`,
      type: "http",
      headers: {},
    });

    // Run health check
    await gateway.health.check();

    // Get from storage
    const servers = await gateway.storage.getRegisteredServers();
    const newServer = servers.find((s) => s.name === "new-server-no-logs");

    expect(newServer?.health).toBe("up");
    expect(newServer?.lastActivity).toBeNull(); // No logs yet
    expect(newServer?.exchangeCount).toBe(0); // No logs yet

    // Verify in API
    const apiApp = createApiApp(
      {
        queryLogs: (options) => gateway.storage.query(options),
        getServers: async () => await gateway.storage.getServers(),
        getSessions: (serverName) => gateway.storage.getSessions(serverName),
        getClients: () => gateway.storage.getClients(),
        clearSessions: async () => {
          await gateway.storage.clearAll();
        },
      },
      logger,
    );

    const response = await apiApp.request("/servers");
    const data = (await response.json()) as ServersResponse;

    const apiServer = data.servers.find((s) => s.name === "new-server-no-logs");
    expect(apiServer?.status).toBe("online");

    // Cleanup
    server3.stop();
  });
});
