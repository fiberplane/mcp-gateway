/**
 * Tests for GET /logs route
 * Verifies backward compatibility and operator defaults
 */

import { describe, expect, it } from "bun:test";
import type { QueryFunctions } from "@fiberplane/mcp-gateway-types";
import { createApiRoutes } from "./index.js";

/**
 * Create mock query functions that capture the options passed to queryLogs
 */
function createMockQueries() {
  let capturedOptions: Parameters<QueryFunctions["queryLogs"]>[0] | null = null;

  const queries: QueryFunctions = {
    queryLogs: async (options) => {
      capturedOptions = options;
      return {
        data: [],
        pagination: {
          count: 0,
          limit: 100,
          hasMore: false,
          oldestTimestamp: null,
          newestTimestamp: null,
        },
      };
    },
    getServers: async () => [],
    getSessions: async () => [],
    getClients: async () => [],
    getMethods: async () => [],
    clearSessions: async () => {},
  };

  return {
    queries,
    getCapturedOptions: () => capturedOptions,
  };
}

describe("GET /logs - backward compatibility", () => {
  it("should default server filter to exact match (is)", async () => {
    const { queries, getCapturedOptions } = createMockQueries();
    const app = createApiRoutes(queries);

    await app.request("/logs?server=my-server");

    const options = getCapturedOptions();
    expect(options?.serverName).toEqual({
      operator: "is",
      value: "my-server",
    });
  });

  it("should default session filter to exact match (is)", async () => {
    const { queries, getCapturedOptions } = createMockQueries();
    const app = createApiRoutes(queries);

    await app.request("/logs?session=session-123");

    const options = getCapturedOptions();
    expect(options?.sessionId).toEqual({
      operator: "is",
      value: "session-123",
    });
  });

  it("should default client filter to exact match (is)", async () => {
    const { queries, getCapturedOptions } = createMockQueries();
    const app = createApiRoutes(queries);

    await app.request("/logs?client=claude-code");

    const options = getCapturedOptions();
    expect(options?.clientName).toEqual({
      operator: "is",
      value: "claude-code",
    });
  });

  it("should default method filter to partial match (contains)", async () => {
    const { queries, getCapturedOptions } = createMockQueries();
    const app = createApiRoutes(queries);

    await app.request("/logs?method=tools/list");

    const options = getCapturedOptions();
    expect(options?.method).toEqual({
      operator: "contains",
      value: "tools/list",
    });
  });
});

describe("GET /logs - explicit operators", () => {
  it("should support explicit 'is' operator for server", async () => {
    const { queries, getCapturedOptions } = createMockQueries();
    const app = createApiRoutes(queries);

    await app.request("/logs?server=is:my-server");

    const options = getCapturedOptions();
    expect(options?.serverName).toEqual({
      operator: "is",
      value: "my-server",
    });
  });

  it("should support explicit 'contains' operator for server", async () => {
    const { queries, getCapturedOptions } = createMockQueries();
    const app = createApiRoutes(queries);

    await app.request("/logs?server=contains:my-server");

    const options = getCapturedOptions();
    expect(options?.serverName).toEqual({
      operator: "contains",
      value: "my-server",
    });
  });

  it("should support explicit 'is' operator for method", async () => {
    const { queries, getCapturedOptions } = createMockQueries();
    const app = createApiRoutes(queries);

    await app.request("/logs?method=is:tools/list");

    const options = getCapturedOptions();
    expect(options?.method).toEqual({
      operator: "is",
      value: "tools/list",
    });
  });

  it("should support explicit 'contains' operator for method", async () => {
    const { queries, getCapturedOptions } = createMockQueries();
    const app = createApiRoutes(queries);

    await app.request("/logs?method=contains:tools");

    const options = getCapturedOptions();
    expect(options?.method).toEqual({
      operator: "contains",
      value: "tools",
    });
  });
});

describe("GET /logs - multi-value filters", () => {
  it("should support multiple server values with default operator", async () => {
    const { queries, getCapturedOptions } = createMockQueries();
    const app = createApiRoutes(queries);

    await app.request("/logs?server=server1&server=server2");

    const options = getCapturedOptions();
    expect(options?.serverName).toEqual({
      operator: "is",
      value: ["server1", "server2"],
    });
  });

  it("should support multiple method values with default operator", async () => {
    const { queries, getCapturedOptions } = createMockQueries();
    const app = createApiRoutes(queries);

    await app.request("/logs?method=tools/list&method=prompts/get");

    const options = getCapturedOptions();
    expect(options?.method).toEqual({
      operator: "contains",
      value: ["tools/list", "prompts/get"],
    });
  });

  it("should support multiple values with explicit operator", async () => {
    const { queries, getCapturedOptions } = createMockQueries();
    const app = createApiRoutes(queries);

    await app.request("/logs?method=is:tools/list&method=is:prompts/get");

    const options = getCapturedOptions();
    expect(options?.method).toEqual({
      operator: "is",
      value: ["tools/list", "prompts/get"],
    });
  });
});
