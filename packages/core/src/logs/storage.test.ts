import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CaptureRecord } from "@fiberplane/mcp-gateway-types";
import { getDb } from "./db.js";
import { ensureMigrations, resetMigrationState } from "./migrations.js";
import {
  getServers,
  getSessions,
  insertLog,
  queryLogs,
  upsertServerHealth,
} from "./storage.js";

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

  beforeEach(async () => {
    // Reset migration state to allow fresh migrations for each test
    resetMigrationState();

    // Create temporary directory for each test
    storageDir = await mkdtemp(join(tmpdir(), "mcp-gateway-test-"));
    const db = getDb(storageDir);
    await ensureMigrations(db);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(storageDir, { recursive: true, force: true });

    // Reset migration state after cleanup
    resetMigrationState();
  });

  describe("insertLog", () => {
    test("should insert a valid log record", async () => {
      const db = getDb(storageDir);
      const record = createTestRecord();

      await insertLog(db, record);

      const result = await queryLogs(db);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].method).toBe("test/method");
    });

    test("should insert multiple log records", async () => {
      const db = getDb(storageDir);

      for (let i = 0; i < 5; i++) {
        const record = createTestRecord({
          id: `test-id-${i}`,
          method: `test/method-${i}`,
        });
        await insertLog(db, record);
      }

      const result = await queryLogs(db);
      expect(result.data).toHaveLength(5);
    });

    test("should handle null jsonrpc id", async () => {
      const db = getDb(storageDir);
      const record = createTestRecord({ id: null });

      await insertLog(db, record);

      const result = await queryLogs(db);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBeNull();
    });
  });

  describe("queryLogs", () => {
    beforeEach(async () => {
      const db = getDb(storageDir);

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
        await insertLog(db, record);
      }
    });

    test("should query all logs with no filters", async () => {
      const db = getDb(storageDir);
      const result = await queryLogs(db);

      expect(result.data).toHaveLength(3);
      expect(result.pagination.count).toBe(3);
      expect(result.pagination.hasMore).toBe(false);
    });

    test("should filter by server name", async () => {
      const db = getDb(storageDir);
      const result = await queryLogs(db, { serverName: "server-a" });

      expect(result.data).toHaveLength(2);
      expect(
        result.data.every((r) => r.metadata.serverName === "server-a"),
      ).toBe(true);
    });

    test("should filter by session id", async () => {
      const db = getDb(storageDir);
      const result = await queryLogs(db, { sessionId: "session-2" });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].metadata.sessionId).toBe("session-2");
    });

    test("should filter by method (partial match)", async () => {
      const db = getDb(storageDir);
      const result = await queryLogs(db, { method: "tools" });

      expect(result.data).toHaveLength(2);
      expect(result.data.every((r) => r.method.includes("tools"))).toBe(true);
    });

    test("should filter by multiple server names (OR logic)", async () => {
      const db = getDb(storageDir);
      const result = await queryLogs(db, {
        serverName: ["server-a", "server-b"],
      });

      expect(result.data).toHaveLength(3);
      expect(
        result.data.every((r) =>
          ["server-a", "server-b"].includes(r.metadata.serverName),
        ),
      ).toBe(true);
    });

    test("should filter by multiple session IDs (OR logic)", async () => {
      const db = getDb(storageDir);
      const result = await queryLogs(db, {
        sessionId: ["session-1", "session-2"],
      });

      expect(result.data).toHaveLength(3);
      expect(
        result.data.every((r) =>
          ["session-1", "session-2"].includes(r.metadata.sessionId),
        ),
      ).toBe(true);
    });

    test("should filter by single server name from array", async () => {
      const db = getDb(storageDir);
      const result = await queryLogs(db, { serverName: ["server-a"] });

      expect(result.data).toHaveLength(2);
      expect(
        result.data.every((r) => r.metadata.serverName === "server-a"),
      ).toBe(true);
    });

    test("should filter by multiple client names (OR logic)", async () => {
      const db = getDb(storageDir);

      // First, add records with client metadata
      await insertLog(
        db,
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
      await insertLog(
        db,
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
      await insertLog(
        db,
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

      const result = await queryLogs(db, {
        clientName: ["client-1", "client-2"],
      });

      expect(result.data).toHaveLength(2);
      expect(
        result.data.every((r) =>
          ["client-1", "client-2"].includes(r.metadata.client?.name ?? ""),
        ),
      ).toBe(true);
    });

    test("should filter by time range (after)", async () => {
      const db = getDb(storageDir);
      const result = await queryLogs(db, { after: "2024-01-01T10:30:00Z" });

      expect(result.data).toHaveLength(2);
    });

    test("should filter by time range (before)", async () => {
      const db = getDb(storageDir);
      const result = await queryLogs(db, { before: "2024-01-01T11:30:00Z" });

      expect(result.data).toHaveLength(2);
    });

    test("should filter by time range (after and before)", async () => {
      const db = getDb(storageDir);
      const result = await queryLogs(db, {
        after: "2024-01-01T10:30:00Z",
        before: "2024-01-01T11:30:00Z",
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].method).toBe("tools/list");
    });

    test("should respect limit", async () => {
      const db = getDb(storageDir);
      const result = await queryLogs(db, { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.hasMore).toBe(true);
    });

    test("should order descending by default", async () => {
      const db = getDb(storageDir);
      const result = await queryLogs(db);

      expect(result.data[0].timestamp).toBe("2024-01-01T12:00:00Z");
      expect(result.data[2].timestamp).toBe("2024-01-01T10:00:00Z");
    });

    test("should order ascending when specified", async () => {
      const db = getDb(storageDir);
      const result = await queryLogs(db, { order: "asc" });

      expect(result.data[0].timestamp).toBe("2024-01-01T10:00:00Z");
      expect(result.data[2].timestamp).toBe("2024-01-01T12:00:00Z");
    });

    test("should calculate pagination metadata", async () => {
      const db = getDb(storageDir);
      const result = await queryLogs(db, { limit: 2 });

      expect(result.pagination.count).toBe(2);
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.newestTimestamp).toBe("2024-01-01T12:00:00Z");
      expect(result.pagination.oldestTimestamp).toBe("2024-01-01T11:00:00Z");
    });
  });

  describe("getServers", () => {
    beforeEach(async () => {
      const db = getDb(storageDir);

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
        await insertLog(db, record);
      }
    });

    test("should aggregate by server name", async () => {
      const db = getDb(storageDir);
      const result = await getServers(db);

      expect(result).toHaveLength(2);
    });

    test("should return distinct servers from logs", async () => {
      const db = getDb(storageDir);
      const result = await getServers(db);

      expect(result).toHaveLength(2);
      expect(result.find((s) => s.name === "server-a")).toBeDefined();
      expect(result.find((s) => s.name === "server-b")).toBeDefined();
    });

    test("should default statuses to not-found when registry data is unavailable", async () => {
      const db = getDb(storageDir);
      const result = await getServers(db);

      for (const server of result) {
        expect(server.status).toBe("not-found");
      }
    });

    test("should derive statuses using registry membership and health data", async () => {
      const db = getDb(storageDir);
      const registryServers = ["server-a", "server-c"];

      // Insert health records into database
      await upsertServerHealth(db, {
        serverName: "server-a",
        health: "down",
        lastCheck: new Date().toISOString(),
        url: "http://localhost:3001/mcp",
      });
      await upsertServerHealth(db, {
        serverName: "server-c",
        health: "up",
        lastCheck: new Date().toISOString(),
        url: "http://localhost:3002/mcp",
      });

      const result = await getServers(db, registryServers);

      const serverA = result.find((s) => s.name === "server-a");
      const serverB = result.find((s) => s.name === "server-b");
      const serverC = result.find((s) => s.name === "server-c");

      expect(serverA?.status).toBe("offline");
      expect(serverB?.status).toBe("not-found");
      expect(serverC).toEqual({
        name: "server-c",
        status: "online",
      });
    });
  });

  describe("getSessions", () => {
    beforeEach(async () => {
      const db = getDb(storageDir);

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
        await insertLog(db, record);
      }
    });

    test("should aggregate all sessions", async () => {
      const db = getDb(storageDir);
      const result = await getSessions(db);

      expect(result).toHaveLength(2);
    });

    test("should filter sessions by server name", async () => {
      const db = getDb(storageDir);
      const result = await getSessions(db, "server-a");

      expect(result).toHaveLength(1);
      expect(result[0].serverName).toBe("server-a");
      expect(result[0].sessionId).toBe("session-1");
    });

    test("should track session time ranges", async () => {
      const db = getDb(storageDir);
      const result = await getSessions(db);

      const session1 = result.find((s) => s.sessionId === "session-1");

      expect(session1?.startTime).toBe("2024-01-01T10:00:00Z");
      expect(session1?.endTime).toBe("2024-01-01T11:00:00Z");
    });

    test("should order sessions by start time descending", async () => {
      const db = getDb(storageDir);
      const result = await getSessions(db);

      expect(result[0].sessionId).toBe("session-2");
      expect(result[1].sessionId).toBe("session-1");
    });
  });
});
