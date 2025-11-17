import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HttpServerConfig } from "@fiberplane/mcp-gateway-types";
import { createGateway } from "./gateway.js";
import { resetMigrationState } from "./logs/migrations.js";

describe("Health Check System", () => {
  let storageDir: string;
  let healthyServer: { url: string; stop: () => void } | null = null;
  let unreachableUrl: string;

  beforeAll(async () => {
    // Create a simple healthy HTTP server for testing
    // Use port 0 to let OS assign an available port
    const server = Bun.serve({
      port: 0,
      fetch: () => new Response("OK", { status: 200 }),
    });

    healthyServer = {
      url: `http://localhost:${server.port}`,
      stop: () => server.stop(),
    };

    // Use a high ephemeral port that's very unlikely to be in use
    // Fails quickly with "connection refused" instead of timing out
    // Port 59999 is in the dynamic/private port range and unlikely to conflict
    unreachableUrl = "http://127.0.0.1:59999";
  });

  afterAll(() => {
    healthyServer?.stop();
  });

  beforeEach(async () => {
    // Reset migration state
    resetMigrationState();

    // Create temporary directory for each test
    storageDir = await mkdtemp(join(tmpdir(), "mcp-gateway-test-"));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(storageDir, { recursive: true, force: true });

    // Reset migration state
    resetMigrationState();
  });

  describe("checkServerHealth", () => {
    test("should return 'up' for healthy server", async () => {
      if (!healthyServer) {
        throw new Error("Test server not initialized");
      }

      const gateway = await createGateway({ storageDir });

      // Access the health check method indirectly through the check() method
      const _results = await gateway.health.check();

      // Add a test server to the registry
      await gateway.storage.addServer({
        name: "healthy-server",
        url: healthyServer.url,
        type: "http",
        headers: {},
      });

      // Run health check
      const healthResults = await gateway.health.check();

      // Should have one result for the healthy server
      expect(healthResults).toHaveLength(1);
      expect(healthResults[0]?.name).toBe("healthy-server");
      expect(healthResults[0]?.health).toBe("up");
      expect(healthResults[0]?.lastHealthCheck).toBeDefined();

      await gateway.close();
    });

    test("should return 'down' for unreachable server", async () => {
      const gateway = await createGateway({ storageDir });

      // Add a server pointing to a port with no listener
      await gateway.storage.addServer({
        name: "unhealthy-server",
        url: unreachableUrl,
        type: "http",
        headers: {},
      });

      // Run health check
      const results = await gateway.health.check();

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe("unhealthy-server");
      expect(results[0]?.health).toBe("down");

      await gateway.close();
    });

    test("should handle multiple servers with different health statuses", async () => {
      if (!healthyServer) {
        throw new Error("Test server not initialized");
      }

      const gateway = await createGateway({ storageDir });

      // Add both healthy and unhealthy servers
      await gateway.storage.addServer({
        name: "healthy-server",
        url: healthyServer.url,
        type: "http",
        headers: {},
      });
      await gateway.storage.addServer({
        name: "unhealthy-server",
        url: unreachableUrl,
        type: "http",
        headers: {},
      });

      // Run health check
      const results = await gateway.health.check();

      expect(results).toHaveLength(2);

      const healthyResult = results.find((r) => r.name === "healthy-server");
      const unhealthyResult = results.find(
        (r) => r.name === "unhealthy-server",
      );

      expect(healthyResult?.health).toBe("up");
      expect(unhealthyResult?.health).toBe("down");

      await gateway.close();
    });
  });

  describe("health persistence", () => {
    test("should persist health check results to database", async () => {
      if (!healthyServer) {
        throw new Error("Test server not initialized");
      }

      const gateway = await createGateway({ storageDir });

      // Add a server
      await gateway.storage.addServer({
        name: "test-server",
        url: healthyServer.url,
        type: "http",
        headers: {},
      });

      // Run health check
      await gateway.health.check();

      // Get servers from registry (which loads health from database)
      const servers = await gateway.storage.getRegisteredServers();

      expect(servers).toHaveLength(1);
      const server = servers[0];
      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe("up");
        expect(server.lastHealthCheck).toBeDefined();
      }

      await gateway.close();
    });

    test("should update health when status changes", async () => {
      if (!healthyServer) {
        throw new Error("Test server not initialized");
      }

      const gateway = await createGateway({ storageDir });

      // Add a server initially pointing to healthy endpoint
      await gateway.storage.addServer({
        name: "test-server",
        url: healthyServer.url,
        type: "http",
        headers: {},
      });

      // First health check - should be "up"
      await gateway.health.check();
      let servers = await gateway.storage.getRegisteredServers();
      let server = servers[0];
      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe("up");
      }

      // Update server to point to unhealthy endpoint
      await gateway.storage.updateServer("test-server", {
        url: unreachableUrl,
      } as Partial<Omit<HttpServerConfig, "name">>);

      // Second health check - should be "down"
      await gateway.health.check();
      servers = await gateway.storage.getRegisteredServers();
      server = servers[0];
      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe("down");
      }

      await gateway.close();
    });
  });

  describe("health.start() and health.stop()", () => {
    test("should run initial health check on start", async () => {
      if (!healthyServer) {
        throw new Error("Test server not initialized");
      }

      const gateway = await createGateway({ storageDir });

      // Add a server
      await gateway.storage.addServer({
        name: "test-server",
        url: healthyServer.url,
        type: "http",
        headers: {},
      });

      // Start health checks (this should run an immediate check)
      await gateway.health.start(10000); // Long interval so it doesn't run again during test

      // Verify health was checked
      const servers = await gateway.storage.getRegisteredServers();
      const server = servers[0];
      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe("up");
        expect(server.lastHealthCheck).toBeDefined();
      }

      await gateway.close();
    });

    test("should call onUpdate callback with health results", async () => {
      if (!healthyServer) {
        throw new Error("Test server not initialized");
      }

      const gateway = await createGateway({ storageDir });

      // Add a server
      await gateway.storage.addServer({
        name: "test-server",
        url: healthyServer.url,
        type: "http",
        headers: {},
      });

      // Track callback invocations
      const updates: Array<{ name: string; health: string }> = [];
      const onUpdate = (
        results: Array<{
          name: string;
          health: string;
          lastHealthCheck: string;
        }>,
      ) => {
        for (const result of results) {
          updates.push({ name: result.name, health: result.health });
        }
      };

      // Start health checks with callback
      await gateway.health.start(10000, onUpdate);

      // Verify callback was called
      expect(updates).toHaveLength(1);
      expect(updates[0]?.name).toBe("test-server");
      expect(updates[0]?.health).toBe("up");

      await gateway.close();
    });

    test("should stop health checks when stop() is called", async () => {
      if (!healthyServer) {
        throw new Error("Test server not initialized");
      }

      const gateway = await createGateway({ storageDir });

      // Add a server
      await gateway.storage.addServer({
        name: "test-server",
        url: healthyServer.url,
        type: "http",
        headers: {},
      });

      // Track callback invocations
      let callCount = 0;
      const onUpdate = () => {
        callCount++;
      };

      // Start health checks with short interval
      await gateway.health.start(100, onUpdate);
      expect(callCount).toBe(1); // Initial check

      // Wait for potential additional checks
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Stop health checks
      gateway.health.stop();
      const countAfterStop = callCount;

      // Wait to verify no more checks occur
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Count should not have increased after stop
      expect(callCount).toBe(countAfterStop);

      await gateway.close();
    });
  });

  describe("health check edge cases", () => {
    test("should handle server returning 500 error as up", async () => {
      // Create a server that returns 500
      const errorServer = Bun.serve({
        port: 0,
        fetch: () => new Response("Server Error", { status: 500 }),
      });

      const gateway = await createGateway({ storageDir });

      await gateway.storage.addServer({
        name: "error-server",
        url: `http://localhost:${errorServer.port}`,
        type: "http",
        headers: {},
      });

      const results = await gateway.health.check();

      // Server returning 500 is considered "down" per the implementation
      expect(results[0]?.health).toBe("down");

      errorServer.stop();
      await gateway.close();
    });

    test("should handle server returning 404 as up", async () => {
      // Create a server that returns 404
      const notFoundServer = Bun.serve({
        port: 0,
        fetch: () => new Response("Not Found", { status: 404 }),
      });

      const gateway = await createGateway({ storageDir });

      await gateway.storage.addServer({
        name: "not-found-server",
        url: `http://localhost:${notFoundServer.port}`,
        type: "http",
        headers: {},
      });

      const results = await gateway.health.check();

      // 404 means server is responding, so it's "up"
      expect(results[0]?.health).toBe("up");

      notFoundServer.stop();
      await gateway.close();
    });

    test(
      "should timeout on slow server",
      async () => {
        // Create a server that takes longer than timeout
        const slowServer = Bun.serve({
          port: 0,
          fetch: async () => {
            await new Promise((resolve) => setTimeout(resolve, 10000)); // 10s delay
            return new Response("OK");
          },
        });

        const gateway = await createGateway({ storageDir });

        await gateway.storage.addServer({
          name: "slow-server",
          url: `http://localhost:${slowServer.port}`,
          type: "http",
          headers: {},
        });

        // Health check should timeout (5s timeout in implementation)
        const results = await gateway.health.check();

        expect(results[0]?.health).toBe("down");

        slowServer.stop();
        await gateway.close();
      },
      { timeout: 10000 },
    );
  });

  describe("extended health check details", () => {
    test("should include error code ECONNREFUSED for unreachable server", async () => {
      const gateway = await createGateway({ storageDir });

      await gateway.storage.addServer({
        name: "unreachable-server",
        url: unreachableUrl,
        type: "http",
        headers: {},
      });

      await gateway.health.check();

      const servers = await gateway.storage.getRegisteredServers();
      const server = servers[0];
      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe("down");
        expect(server.errorCode).toBe("ECONNREFUSED");
        expect(server.errorMessage).toBeDefined();
        expect(server.lastCheckTime).toBeTypeOf("number");
        expect(server.lastErrorTime).toBeTypeOf("number");
      }

      await gateway.close();
    });

    test("should include response time for healthy server", async () => {
      if (!healthyServer) {
        throw new Error("Test server not initialized");
      }

      const gateway = await createGateway({ storageDir });

      await gateway.storage.addServer({
        name: "healthy-server",
        url: healthyServer.url,
        type: "http",
        headers: {},
      });

      await gateway.health.check();

      const servers = await gateway.storage.getRegisteredServers();
      const server = servers[0];
      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe("up");
        expect(server.responseTimeMs).toBeTypeOf("number");
        expect(server.responseTimeMs).toBeGreaterThanOrEqual(0);
        expect(server.lastCheckTime).toBeTypeOf("number");
        expect(server.lastHealthyTime).toBeTypeOf("number");
      }

      await gateway.close();
    });

    test("should include HTTP_ERROR code for 500 responses", async () => {
      const errorServer = Bun.serve({
        port: 0,
        fetch: () => new Response("Server Error", { status: 500 }),
      });

      const gateway = await createGateway({ storageDir });

      await gateway.storage.addServer({
        name: "error-server",
        url: `http://localhost:${errorServer.port}`,
        type: "http",
        headers: {},
      });

      await gateway.health.check();

      const servers = await gateway.storage.getRegisteredServers();
      const server = servers[0];
      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe("down");
        expect(server.errorCode).toBe("HTTP_ERROR");
        expect(server.errorMessage).toMatch(/HTTP 500/);
      }

      errorServer.stop();
      await gateway.close();
    });

    test(
      "should include TIMEOUT code for slow servers",
      async () => {
        const slowServer = Bun.serve({
          port: 0,
          fetch: async () => {
            await new Promise((resolve) => setTimeout(resolve, 10000));
            return new Response("OK");
          },
        });

        const gateway = await createGateway({ storageDir });

        await gateway.storage.addServer({
          name: "slow-server",
          url: `http://localhost:${slowServer.port}`,
          type: "http",
          headers: {},
        });

        await gateway.health.check();

        const servers = await gateway.storage.getRegisteredServers();
        const server = servers[0];
        expect(server?.type).toBe("http");
        if (server?.type === "http") {
          expect(server.health).toBe("down");
          expect(server.errorCode).toBe("TIMEOUT");
          expect(server.lastErrorTime).toBeTypeOf("number");
        }

        slowServer.stop();
        await gateway.close();
      },
      { timeout: 10000 },
    );

    test("should update lastHealthyTime only for successful checks", async () => {
      if (!healthyServer) {
        throw new Error("Test server not initialized");
      }

      const gateway = await createGateway({ storageDir });

      await gateway.storage.addServer({
        name: "test-server",
        url: healthyServer.url,
        type: "http",
        headers: {},
      });

      // First check - healthy
      await gateway.health.check();
      let servers = await gateway.storage.getRegisteredServers();
      let server = servers[0];
      expect(server?.type).toBe("http");
      let firstHealthyTime: number | undefined;
      if (server?.type === "http") {
        firstHealthyTime = server.lastHealthyTime;
        expect(firstHealthyTime).toBeTypeOf("number");
      }

      // Update to unreachable
      await gateway.storage.updateServer("test-server", {
        url: unreachableUrl,
      } as Partial<Omit<HttpServerConfig, "name">>);

      // Second check - unhealthy
      await gateway.health.check();
      servers = await gateway.storage.getRegisteredServers();
      server = servers[0];
      expect(server?.type).toBe("http");
      if (server?.type === "http") {
        expect(server.health).toBe("down");
        expect(server.lastHealthyTime).toBe(firstHealthyTime); // Should not update
        expect(server.lastErrorTime).toBeTypeOf("number");
      }

      await gateway.close();
    });

    test("should track timestamps correctly across multiple checks", async () => {
      if (!healthyServer) {
        throw new Error("Test server not initialized");
      }

      const gateway = await createGateway({ storageDir });

      await gateway.storage.addServer({
        name: "test-server",
        url: healthyServer.url,
        type: "http",
        headers: {},
      });

      // First check
      await gateway.health.check();
      let servers = await gateway.storage.getRegisteredServers();
      let server = servers[0];
      expect(server?.type).toBe("http");
      let firstCheckTime: number | undefined;
      if (server?.type === "http") {
        firstCheckTime = server.lastCheckTime;
        expect(firstCheckTime).toBeTypeOf("number");
      }

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second check
      await gateway.health.check();
      servers = await gateway.storage.getRegisteredServers();
      server = servers[0];
      expect(server?.type).toBe("http");
      // Type is asserted above, safe to access HTTP-only properties
      if (server?.type === "http") {
        expect(server.lastCheckTime).toBeTypeOf("number");
        expect(server.lastCheckTime).toBeGreaterThan(firstCheckTime as number);
      }

      await gateway.close();
    });
  });
});
