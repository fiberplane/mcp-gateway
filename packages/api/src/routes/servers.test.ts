import { describe, expect, test } from "bun:test";
import type {
  ApiError,
  Logger,
  QueryFunctions,
  ServerInfo,
} from "@fiberplane/mcp-gateway-types";
import { createApp } from "../app.js";

// Response type for /servers endpoint
type ServersResponse = {
  servers: ServerInfo[];
};

// Mock logger for testing
const mockLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe("API /servers endpoint", () => {
  describe("GET /servers", () => {
    test("should return servers with status field", async () => {
      // Mock query functions
      const queries: QueryFunctions = {
        queryLogs: async () => ({
          data: [],
          pagination: {
            count: 0,
            limit: 100,
            hasMore: false,
            oldestTimestamp: null,
            newestTimestamp: null,
          },
        }),
        getServers: async (): Promise<ServerInfo[]> => [
          {
            name: "test-server",
            status: "online",
          },
        ],
        getSessions: async () => [],
        getClients: async () => [],
        getMethods: async () => [],
        clearSessions: async () => {},
        getConversations: async () => [],
        getConversationTimeline: async () => [],
      };

      const app = createApp({ queries, logger: mockLogger });

      const response = await app.request("/servers");
      const data = (await response.json()) as ServersResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("servers");
      expect(data.servers).toHaveLength(1);
      expect(data.servers[0]).toEqual({
        name: "test-server",
        status: "online",
      });
    });

    test("should return status='online' for servers with health='up'", async () => {
      const queries: QueryFunctions = {
        queryLogs: async () => ({
          data: [],
          pagination: {
            count: 0,
            limit: 100,
            hasMore: false,
            oldestTimestamp: null,
            newestTimestamp: null,
          },
        }),
        getServers: async (): Promise<ServerInfo[]> => [
          {
            name: "healthy-server",
            status: "online",
          },
        ],
        getSessions: async () => [],
        getClients: async () => [],
        getMethods: async () => [],
        clearSessions: async () => {},
        getConversations: async () => [],
        getConversationTimeline: async () => [],
      };

      const app = createApp({ queries, logger: mockLogger });

      const response = await app.request("/servers");
      const data = (await response.json()) as ServersResponse;

      expect(data.servers[0]?.status).toBe("online");
    });

    test("should return status='offline' for servers with health='down'", async () => {
      const queries: QueryFunctions = {
        queryLogs: async () => ({
          data: [],
          pagination: {
            count: 0,
            limit: 100,
            hasMore: false,
            oldestTimestamp: null,
            newestTimestamp: null,
          },
        }),
        getServers: async (): Promise<ServerInfo[]> => [
          {
            name: "unhealthy-server",
            status: "offline",
          },
        ],
        getSessions: async () => [],
        getClients: async () => [],
        getMethods: async () => [],
        clearSessions: async () => {},
        getConversations: async () => [],
        getConversationTimeline: async () => [],
      };

      const app = createApp({ queries, logger: mockLogger });

      const response = await app.request("/servers");
      const data = (await response.json()) as ServersResponse;

      expect(data.servers[0]?.status).toBe("offline");
    });

    test("should return status='not-found' when health is unknown", async () => {
      const queries: QueryFunctions = {
        queryLogs: async () => ({
          data: [],
          pagination: {
            count: 0,
            limit: 100,
            hasMore: false,
            oldestTimestamp: null,
            newestTimestamp: null,
          },
        }),
        getServers: async (): Promise<ServerInfo[]> => [
          {
            name: "unknown-server",
            status: "not-found",
          },
        ],
        getSessions: async () => [],
        getClients: async () => [],
        getMethods: async () => [],
        clearSessions: async () => {},
        getConversations: async () => [],
        getConversationTimeline: async () => [],
      };

      const app = createApp({ queries, logger: mockLogger });

      const response = await app.request("/servers");
      const data = (await response.json()) as ServersResponse;

      expect(data.servers[0]?.status).toBe("not-found");
    });

    test("should handle multiple servers with different statuses", async () => {
      const queries: QueryFunctions = {
        queryLogs: async () => ({
          data: [],
          pagination: {
            count: 0,
            limit: 100,
            hasMore: false,
            oldestTimestamp: null,
            newestTimestamp: null,
          },
        }),
        getServers: async (): Promise<ServerInfo[]> => [
          {
            name: "server-online",
            status: "online",
          },
          {
            name: "server-offline",
            status: "offline",
          },
          {
            name: "server-not-found",
            status: "not-found",
          },
        ],
        getSessions: async () => [],
        getClients: async () => [],
        getMethods: async () => [],
        clearSessions: async () => {},
        getConversations: async () => [],
        getConversationTimeline: async () => [],
      };

      const app = createApp({ queries, logger: mockLogger });

      const response = await app.request("/servers");
      const data = (await response.json()) as ServersResponse;

      expect(data.servers).toHaveLength(3);

      const onlineServer = data.servers.find(
        (s: ServerInfo) => s.name === "server-online",
      );
      const offlineServer = data.servers.find(
        (s: ServerInfo) => s.name === "server-offline",
      );
      const notFoundServer = data.servers.find(
        (s: ServerInfo) => s.name === "server-not-found",
      );

      expect(onlineServer?.status).toBe("online");
      expect(offlineServer?.status).toBe("offline");
      expect(notFoundServer?.status).toBe("not-found");
    });

    test("should return empty array when no servers exist", async () => {
      const queries: QueryFunctions = {
        queryLogs: async () => ({
          data: [],
          pagination: {
            count: 0,
            limit: 100,
            hasMore: false,
            oldestTimestamp: null,
            newestTimestamp: null,
          },
        }),
        getServers: async (): Promise<ServerInfo[]> => [],
        getSessions: async () => [],
        getClients: async () => [],
        getMethods: async () => [],
        clearSessions: async () => {},
        getConversations: async () => [],
        getConversationTimeline: async () => [],
      };

      const app = createApp({ queries, logger: mockLogger });

      const response = await app.request("/servers");
      const data = (await response.json()) as ServersResponse;

      expect(response.status).toBe(200);
      expect(data.servers).toHaveLength(0);
    });

    test("should handle errors gracefully", async () => {
      const queries: QueryFunctions = {
        queryLogs: async () => ({
          data: [],
          pagination: {
            count: 0,
            limit: 100,
            hasMore: false,
            oldestTimestamp: null,
            newestTimestamp: null,
          },
        }),
        getServers: async (): Promise<ServerInfo[]> => {
          throw new Error("Database error");
        },
        getSessions: async () => [],
        getClients: async () => [],
        getMethods: async () => [],
        clearSessions: async () => {},
        getConversations: async () => [],
        getConversationTimeline: async () => [],
      };

      const app = createApp({ queries, logger: mockLogger });

      const response = await app.request("/servers");

      expect(response.status).toBe(500);

      const data = (await response.json()) as ApiError;
      expect(data).toHaveProperty("error");
      expect(data.error.code).toBe("INTERNAL_ERROR");
    });
  });
});
