import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CaptureRecord } from "@fiberplane/mcp-gateway-types";
import { LocalStorageBackend } from "../capture/backends/local-backend.js";
import { resetMigrationState } from "./migrations.js";

// Test data factory
function createTestRecord(
  overrides: Partial<CaptureRecord> = {},
): CaptureRecord {
  return {
    timestamp: new Date().toISOString(),
    method: "test/method",
    id: "test-id",
    metadata: {
      serverName: "test-server",
      sessionId: "test-session",
      durationMs: 100,
      httpStatus: 200,
    },
    request: {
      jsonrpc: "2.0",
      id: "test-id",
      method: "test/method",
      params: {},
    },
    ...overrides,
  };
}

describe("Storage Functions", () => {
  let storageDir: string;
  let backend: LocalStorageBackend;

  beforeEach(async () => {
    // Reset migration state to allow fresh migrations for each test
    resetMigrationState();

    // Create temporary directory for each test
    storageDir = await mkdtemp(join(tmpdir(), "mcp-gateway-test-"));

    // Create backend (migrations run automatically)
    backend = await LocalStorageBackend.create(storageDir);
  });

  afterEach(async () => {
    // Close backend connection
    await backend?.close();

    // Clean up temporary directory
    await rm(storageDir, { recursive: true, force: true });

    // Reset migration state after cleanup
    resetMigrationState();
  });

  describe("insertLog", () => {
    test("should insert a valid log record", async () => {
      const record = createTestRecord();

      await backend.write(record);

      const result = await backend.queryLogs();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].method).toBe("test/method");
    });

    test("should insert multiple log records", async () => {
      for (let i = 0; i < 5; i++) {
        const record = createTestRecord({
          id: `test-id-${i}`,
          method: `test/method-${i}`,
        });
        await backend.write(record);
      }

      const result = await backend.queryLogs();
      expect(result.data).toHaveLength(5);
    });

    test("should handle null jsonrpc id", async () => {
      const record = createTestRecord({ id: null });

      await backend.write(record);

      const result = await backend.queryLogs();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBeNull();
    });
  });

  describe("queryLogs", () => {
    beforeEach(async () => {
      // Insert test data
      const records = [
        createTestRecord({
          timestamp: "2024-01-01T10:00:00Z",
          method: "initialize",
          metadata: {
            serverName: "server-a",
            sessionId: "session-1",
            durationMs: 100,
            httpStatus: 200,
          },
        }),
        createTestRecord({
          timestamp: "2024-01-01T11:00:00Z",
          method: "tools/list",
          metadata: {
            serverName: "server-a",
            sessionId: "session-1",
            durationMs: 50,
            httpStatus: 200,
          },
        }),
        createTestRecord({
          timestamp: "2024-01-01T12:00:00Z",
          method: "tools/call",
          metadata: {
            serverName: "server-b",
            sessionId: "session-2",
            durationMs: 200,
            httpStatus: 500,
          },
        }),
      ];

      for (const record of records) {
        await backend.write(record);
      }
    });

    test("should query all logs with no filters", async () => {
      const result = await backend.queryLogs();

      expect(result.data).toHaveLength(3);
      expect(result.pagination.count).toBe(3);
      expect(result.pagination.hasMore).toBe(false);
    });

    test("should filter by server name", async () => {
      const result = await backend.queryLogs({
        serverName: { operator: "is", value: "server-a" },
      });

      expect(result.data).toHaveLength(2);
      expect(
        result.data.every((r) => r.metadata.serverName === "server-a"),
      ).toBe(true);
    });

    test("should filter by session id", async () => {
      const result = await backend.queryLogs({
        sessionId: { operator: "is", value: "session-2" },
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].metadata.sessionId).toBe("session-2");
    });

    test("should filter by method with 'contains' operator (partial match)", async () => {
      const result = await backend.queryLogs({
        method: { operator: "contains", value: "tools" },
      });

      expect(result.data).toHaveLength(2);
      expect(result.data.every((r) => r.method.includes("tools"))).toBe(true);
    });

    test("should filter by method with 'is' operator (exact match)", async () => {
      const result = await backend.queryLogs({
        method: { operator: "is", value: "tools/list" },
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].method).toBe("tools/list");
    });

    test("should filter by client name with 'contains' operator", async () => {
      // Add test record with client metadata
      await backend.write(
        createTestRecord({
          timestamp: "2024-01-01T13:00:00Z",
          method: "test/method",
          metadata: {
            serverName: "server-a",
            sessionId: "session-3",
            durationMs: 100,
            httpStatus: 200,
            client: { name: "inspector-client", version: "0.17.2" },
          },
        }),
      );

      const result = await backend.queryLogs({
        clientName: { operator: "contains", value: "inspector" },
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect(
        result.data.every((r) => r.metadata.client?.name.includes("inspector")),
      ).toBe(true);
    });

    test("should filter by client name with 'is' operator (exact match)", async () => {
      // Add test records
      await backend.write(
        createTestRecord({
          timestamp: "2024-01-01T13:00:00Z",
          metadata: {
            serverName: "server-a",
            sessionId: "session-3",
            durationMs: 100,
            httpStatus: 200,
            client: { name: "inspector-client", version: "0.17.2" },
          },
        }),
      );
      await backend.write(
        createTestRecord({
          timestamp: "2024-01-01T14:00:00Z",
          metadata: {
            serverName: "server-a",
            sessionId: "session-4",
            durationMs: 100,
            httpStatus: 200,
            client: { name: "inspector", version: "1.0.0" },
          },
        }),
      );

      const result = await backend.queryLogs({
        clientName: { operator: "is", value: "inspector" },
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].metadata.client?.name).toBe("inspector");
    });

    test("should filter by session with 'contains' operator (partial match)", async () => {
      // Add test record with UUID session
      await backend.write(
        createTestRecord({
          timestamp: "2024-01-01T13:00:00Z",
          metadata: {
            serverName: "server-a",
            sessionId: "f4a3b2c1-1234-5678-9abc-def012345678",
            durationMs: 100,
            httpStatus: 200,
          },
        }),
      );

      const result = await backend.queryLogs({
        sessionId: { operator: "contains", value: "f4" },
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.some((r) => r.metadata.sessionId.includes("f4"))).toBe(
        true,
      );
    });

    test("should filter by server with 'contains' operator (partial match)", async () => {
      const result = await backend.queryLogs({
        serverName: { operator: "contains", value: "server" },
      });

      expect(result.data).toHaveLength(3);
      expect(
        result.data.every((r) => r.metadata.serverName.includes("server")),
      ).toBe(true);
    });

    test("should filter by server with 'is' operator (exact match)", async () => {
      const result = await backend.queryLogs({
        serverName: { operator: "is", value: "server-a" },
      });

      expect(result.data).toHaveLength(2);
      expect(
        result.data.every((r) => r.metadata.serverName === "server-a"),
      ).toBe(true);
    });

    test("should filter by multiple server names (OR logic)", async () => {
      const result = await backend.queryLogs({
        serverName: { operator: "is", value: ["server-a", "server-b"] },
      });

      expect(result.data).toHaveLength(3);
      expect(
        result.data.every((r) =>
          ["server-a", "server-b"].includes(r.metadata.serverName),
        ),
      ).toBe(true);
    });

    test("should filter by multiple session IDs (OR logic)", async () => {
      const result = await backend.queryLogs({
        sessionId: { operator: "is", value: ["session-1", "session-2"] },
      });

      expect(result.data).toHaveLength(3);
      expect(
        result.data.every((r) =>
          ["session-1", "session-2"].includes(r.metadata.sessionId),
        ),
      ).toBe(true);
    });

    test("should filter by single server name from array", async () => {
      const result = await backend.queryLogs({
        serverName: { operator: "is", value: ["server-a"] },
      });

      expect(result.data).toHaveLength(2);
      expect(
        result.data.every((r) => r.metadata.serverName === "server-a"),
      ).toBe(true);
    });

    test("should filter by multiple client names (OR logic)", async () => {
      // First, add records with client metadata
      await backend.write(
        createTestRecord({
          timestamp: "2024-01-01T13:00:00Z",
          method: "test/method-1",
          metadata: {
            serverName: "server-a",
            sessionId: "session-3",
            durationMs: 100,
            httpStatus: 200,
            client: { name: "client-1", version: "1.0" },
          },
        }),
      );
      await backend.write(
        createTestRecord({
          timestamp: "2024-01-01T14:00:00Z",
          method: "test/method-2",
          metadata: {
            serverName: "server-a",
            sessionId: "session-4",
            durationMs: 100,
            httpStatus: 200,
            client: { name: "client-2", version: "1.0" },
          },
        }),
      );
      await backend.write(
        createTestRecord({
          timestamp: "2024-01-01T15:00:00Z",
          method: "test/method-3",
          metadata: {
            serverName: "server-a",
            sessionId: "session-5",
            durationMs: 100,
            httpStatus: 200,
            client: { name: "client-3", version: "1.0" },
          },
        }),
      );

      const result = await backend.queryLogs({
        clientName: { operator: "is", value: ["client-1", "client-2"] },
      });

      expect(result.data).toHaveLength(2);
      expect(
        result.data.every((r) =>
          ["client-1", "client-2"].includes(r.metadata.client?.name ?? ""),
        ),
      ).toBe(true);
    });

    test("should filter by time range (after)", async () => {
      const result = await backend.queryLogs({ after: "2024-01-01T10:30:00Z" });

      expect(result.data).toHaveLength(2);
    });

    test("should filter by time range (before)", async () => {
      const result = await backend.queryLogs({
        before: "2024-01-01T11:30:00Z",
      });

      expect(result.data).toHaveLength(2);
    });

    test("should filter by time range (after and before)", async () => {
      const result = await backend.queryLogs({
        after: "2024-01-01T10:30:00Z",
        before: "2024-01-01T11:30:00Z",
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].method).toBe("tools/list");
    });

    test("should respect limit", async () => {
      const result = await backend.queryLogs({ limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.hasMore).toBe(true);
    });

    test("should order descending by default", async () => {
      const result = await backend.queryLogs();

      expect(result.data[0].timestamp).toBe("2024-01-01T12:00:00Z");
      expect(result.data[2].timestamp).toBe("2024-01-01T10:00:00Z");
    });

    test("should order ascending when specified", async () => {
      const result = await backend.queryLogs({ order: "asc" });

      expect(result.data[0].timestamp).toBe("2024-01-01T10:00:00Z");
      expect(result.data[2].timestamp).toBe("2024-01-01T12:00:00Z");
    });

    test("should calculate pagination metadata", async () => {
      const result = await backend.queryLogs({ limit: 2 });

      expect(result.pagination.count).toBe(2);
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.newestTimestamp).toBe("2024-01-01T12:00:00Z");
      expect(result.pagination.oldestTimestamp).toBe("2024-01-01T11:00:00Z");
    });
  });

  describe("getServers", () => {
    beforeEach(async () => {
      // Insert test data
      const records = [
        createTestRecord({
          metadata: {
            serverName: "server-a",
            sessionId: "session-1",
            durationMs: 100,
            httpStatus: 200,
          },
        }),
        createTestRecord({
          metadata: {
            serverName: "server-a",
            sessionId: "session-1",
            durationMs: 50,
            httpStatus: 200,
          },
        }),
        createTestRecord({
          metadata: {
            serverName: "server-a",
            sessionId: "session-2",
            durationMs: 75,
            httpStatus: 200,
          },
        }),
        createTestRecord({
          metadata: {
            serverName: "server-b",
            sessionId: "session-3",
            durationMs: 200,
            httpStatus: 500,
          },
        }),
      ];

      for (const record of records) {
        await backend.write(record);
      }
    });

    test("should aggregate by server name", async () => {
      const result = await backend.getServers();

      expect(result).toHaveLength(2);
    });

    test("should return distinct servers from logs", async () => {
      const result = await backend.getServers();

      expect(result).toHaveLength(2);
      expect(result.find((s) => s.name === "server-a")).toBeDefined();
      expect(result.find((s) => s.name === "server-b")).toBeDefined();
    });

    test("should default statuses to not-found when registry data is unavailable", async () => {
      const result = await backend.getServers();

      for (const server of result) {
        expect(server.status).toBe("not-found");
      }
    });

    test("should derive statuses using registry membership and health data", async () => {
      // Add servers to registry
      await backend.addServer({
        name: "server-a",
        type: "http",
        url: "http://localhost:3001/mcp",
        headers: {},
      });
      await backend.addServer({
        name: "server-c",
        type: "http",
        url: "http://localhost:3002/mcp",
        headers: {},
      });

      // Insert health records into database
      await backend.upsertServerHealth(
        "server-a",
        "down",
        new Date().toISOString(),
        "http://localhost:3001/mcp",
      );
      await backend.upsertServerHealth(
        "server-c",
        "up",
        new Date().toISOString(),
        "http://localhost:3002/mcp",
      );

      const result = await backend.getServers();

      const serverA = result.find((s) => s.name === "server-a");
      const serverB = result.find((s) => s.name === "server-b");
      const serverC = result.find((s) => s.name === "server-c");

      expect(serverA?.status).toBe("offline");
      expect(serverB?.status).toBe("not-found");
      expect(serverC).toMatchObject({
        name: "server-c",
        status: "online",
        url: "http://localhost:3002/mcp",
      });
    });
  });

  describe("getSessions", () => {
    beforeEach(async () => {
      // Insert test data
      const records = [
        createTestRecord({
          timestamp: "2024-01-01T10:00:00Z",
          metadata: {
            serverName: "server-a",
            sessionId: "session-1",
            durationMs: 100,
            httpStatus: 200,
          },
        }),
        createTestRecord({
          timestamp: "2024-01-01T11:00:00Z",
          metadata: {
            serverName: "server-a",
            sessionId: "session-1",
            durationMs: 50,
            httpStatus: 200,
          },
        }),
        createTestRecord({
          timestamp: "2024-01-01T12:00:00Z",
          metadata: {
            serverName: "server-b",
            sessionId: "session-2",
            durationMs: 200,
            httpStatus: 500,
          },
        }),
      ];

      for (const record of records) {
        await backend.write(record);
      }
    });

    test("should aggregate all sessions", async () => {
      const result = await backend.getSessions();

      expect(result).toHaveLength(2);
    });

    test("should filter sessions by server name", async () => {
      const result = await backend.getSessions("server-a");

      expect(result).toHaveLength(1);
      expect(result[0].serverName).toBe("server-a");
      expect(result[0].sessionId).toBe("session-1");
    });

    test("should track session time ranges", async () => {
      const result = await backend.getSessions();

      const session1 = result.find((s) => s.sessionId === "session-1");

      expect(session1?.startTime).toBe("2024-01-01T10:00:00Z");
      expect(session1?.endTime).toBe("2024-01-01T11:00:00Z");
    });

    test("should order sessions by start time descending", async () => {
      const result = await backend.getSessions();

      expect(result[0].sessionId).toBe("session-2");
      expect(result[1].sessionId).toBe("session-1");
    });
  });
});
