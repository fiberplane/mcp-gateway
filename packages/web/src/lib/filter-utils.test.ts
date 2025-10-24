/**
 * Unit tests for filter utilities
 *
 * Tests URL serialization, filter matching, and batch filtering logic.
 * Run with: bun test
 */

import { describe, expect, it } from "bun:test";
import type { ApiLogEntry } from "@fiberplane/mcp-gateway-types";
import { createFilter, type Filter } from "@fiberplane/mcp-gateway-types";
import {
  addOrReplaceFilter,
  applyFilterState,
  applyFiltersToLogs,
  areFiltersEqual,
  clearAllFilters,
  getFilterLabel,
  matchesFilter,
  matchesSearch,
  parseFilterStateFromUrl,
  parseFiltersFromUrl,
  removeFilter,
  serializeFilterStateToUrl,
  serializeFiltersToUrl,
} from "./filter-utils";

// ============================================================================
// Test Fixtures
// ============================================================================

const mockLog: ApiLogEntry = {
  id: "request-1",
  timestamp: "2024-01-01T00:00:00Z",
  method: "tools/call",
  direction: "request",
  metadata: {
    serverName: "everything-server",
    sessionId: "session-123",
    durationMs: 150,
    httpStatus: 200,
    client: { name: "claude-code", version: "1.0.0" },
    server: { name: "everything-server", version: "1.0.0" },
  },
  request: {
    jsonrpc: "2.0",
    id: "request-1",
    method: "tools/call",
    params: {},
  },
};

// ============================================================================
// URL Serialization Tests
// ============================================================================

describe("parseFiltersFromUrl", () => {
  it("should parse client filter", () => {
    const params = new URLSearchParams("client=is:claude-code");
    const filters = parseFiltersFromUrl(params);

    expect(filters).toHaveLength(1);
    expect(filters[0]?.field).toBe("client");
    expect(filters[0]?.operator).toBe("is");
    expect(filters[0]?.value).toBe("claude-code");
    expect(filters[0]?.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
  });

  it("should parse method filter", () => {
    const params = new URLSearchParams("method=contains:tools");
    const filters = parseFiltersFromUrl(params);

    expect(filters).toHaveLength(1);
    expect(filters[0]?.field).toBe("method");
    expect(filters[0]?.operator).toBe("contains");
    expect(filters[0]?.value).toBe("tools");
  });

  it("should parse duration filter with numeric value", () => {
    const params = new URLSearchParams("duration=gt:100");
    const filters = parseFiltersFromUrl(params);

    expect(filters).toHaveLength(1);
    expect(filters[0]?.field).toBe("duration");
    expect(filters[0]?.operator).toBe("gt");
    expect(filters[0]?.value).toBe(100);
  });

  it("should parse multiple filters", () => {
    const params = new URLSearchParams(
      "client=is:claude-code&method=contains:tools&duration=gt:100",
    );
    const filters = parseFiltersFromUrl(params);

    expect(filters).toHaveLength(3);
    expect(filters[0]?.field).toBe("client");
    expect(filters[1]?.field).toBe("method");
    expect(filters[2]?.field).toBe("duration");
  });

  it("should skip malformed filters", () => {
    const params = new URLSearchParams("client=invalid&method=contains:tools");
    const filters = parseFiltersFromUrl(params);

    expect(filters).toHaveLength(1);
    expect(filters[0]?.field).toBe("method");
  });

  it("should skip filters with invalid numeric values", () => {
    const params = new URLSearchParams("duration=gt:abc");
    const filters = parseFiltersFromUrl(params);

    expect(filters).toHaveLength(0);
  });

  it("should return empty array for empty params", () => {
    const params = new URLSearchParams();
    const filters = parseFiltersFromUrl(params);

    expect(filters).toEqual([]);
  });
});

describe("serializeFiltersToUrl", () => {
  it("should serialize client filter", () => {
    const filters: Filter[] = [
      createFilter({
        field: "client",
        operator: "is",
        value: "claude-code",
      }),
    ];
    const params = serializeFiltersToUrl(filters);

    expect(params.get("client")).toBe("is:claude-code");
  });

  it("should serialize duration filter", () => {
    const filters: Filter[] = [
      createFilter({
        field: "duration",
        operator: "gt",
        value: 100,
      }),
    ];
    const params = serializeFiltersToUrl(filters);

    expect(params.get("duration")).toBe("gt:100");
  });

  it("should serialize search query", () => {
    const params = serializeFiltersToUrl([], "echo");

    expect(params.get("q")).toBe("echo");
  });

  it("should serialize both filters and search", () => {
    const filters: Filter[] = [
      createFilter({
        field: "client",
        operator: "is",
        value: "claude-code",
      }),
    ];
    const params = serializeFiltersToUrl(filters, "echo");

    expect(params.get("client")).toBe("is:claude-code");
    expect(params.get("q")).toBe("echo");
  });

  it("should trim search query whitespace", () => {
    const params = serializeFiltersToUrl([], "  echo  ");

    expect(params.get("q")).toBe("echo");
  });

  it("should not add search param for empty string", () => {
    const params = serializeFiltersToUrl([], "");

    expect(params.has("q")).toBe(false);
  });

  it("should handle multiple filters", () => {
    const filters: Filter[] = [
      createFilter({
        field: "client",
        operator: "is",
        value: "claude-code",
      }),
      createFilter({
        field: "method",
        operator: "contains",
        value: "tools",
      }),
    ];
    const params = serializeFiltersToUrl(filters);

    expect(params.get("client")).toBe("is:claude-code");
    expect(params.get("method")).toBe("contains:tools");
  });
});

describe("URL serialization round-trip", () => {
  it("should maintain filters through serialization and parsing", () => {
    const original: Filter[] = [
      createFilter({
        field: "client",
        operator: "is",
        value: "claude-code",
      }),
      createFilter({
        field: "duration",
        operator: "gt",
        value: 100,
      }),
    ];

    const serialized = serializeFiltersToUrl(original);
    const parsed = parseFiltersFromUrl(serialized);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      field: "client",
      operator: "is",
      value: "claude-code",
    });
    expect(parsed[1]).toMatchObject({
      field: "duration",
      operator: "gt",
      value: 100,
    });
  });
});

describe("parseFilterStateFromUrl", () => {
  it("should parse search and filters", () => {
    const params = new URLSearchParams("q=echo&client=is:claude-code");
    const state = parseFilterStateFromUrl(params);

    expect(state.search).toBe("echo");
    expect(state.filters).toHaveLength(1);
    expect(state.filters[0]?.field).toBe("client");
  });

  it("should handle missing search param", () => {
    const params = new URLSearchParams("client=is:claude-code");
    const state = parseFilterStateFromUrl(params);

    expect(state.search).toBe("");
    expect(state.filters).toHaveLength(1);
  });
});

describe("serializeFilterStateToUrl", () => {
  it("should serialize state with search and filters", () => {
    const state = {
      search: "echo",
      filters: [
        createFilter({
          field: "client",
          operator: "is",
          value: "claude-code",
        }),
      ],
    };
    const params = serializeFilterStateToUrl(state);

    expect(params.get("q")).toBe("echo");
    expect(params.get("client")).toBe("is:claude-code");
  });
});

// ============================================================================
// Filter Matching Tests
// ============================================================================

describe("matchesFilter", () => {
  describe("client filter", () => {
    it("should match with 'is' operator", () => {
      const filter = createFilter({
        field: "client",
        operator: "is",
        value: "claude-code",
      });

      expect(matchesFilter(mockLog, filter)).toBe(true);
    });

    it("should not match with wrong value", () => {
      const filter = createFilter({
        field: "client",
        operator: "is",
        value: "other-client",
      });

      expect(matchesFilter(mockLog, filter)).toBe(false);
    });

    it("should match with 'contains' operator", () => {
      const filter = createFilter({
        field: "client",
        operator: "contains",
        value: "claude",
      });

      expect(matchesFilter(mockLog, filter)).toBe(true);
    });

    it("should be case-insensitive for 'contains'", () => {
      const filter = createFilter({
        field: "client",
        operator: "contains",
        value: "CLAUDE",
      });

      expect(matchesFilter(mockLog, filter)).toBe(true);
    });

    it("should not match when client is undefined", () => {
      const logWithoutClient = {
        ...mockLog,
        metadata: { ...mockLog.metadata, client: undefined },
      };
      const filter = createFilter({
        field: "client",
        operator: "is",
        value: "claude-code",
      });

      expect(matchesFilter(logWithoutClient, filter)).toBe(false);
    });
  });

  describe("method filter", () => {
    it("should match with 'is' operator", () => {
      const filter = createFilter({
        field: "method",
        operator: "is",
        value: "tools/call",
      });

      expect(matchesFilter(mockLog, filter)).toBe(true);
    });

    it("should match with 'contains' operator", () => {
      const filter = createFilter({
        field: "method",
        operator: "contains",
        value: "tools",
      });

      expect(matchesFilter(mockLog, filter)).toBe(true);
    });
  });

  describe("session filter", () => {
    it("should match with 'is' operator", () => {
      const filter = createFilter({
        field: "session",
        operator: "is",
        value: "session-123",
      });

      expect(matchesFilter(mockLog, filter)).toBe(true);
    });
  });

  describe("server filter", () => {
    it("should match with 'is' operator", () => {
      const filter = createFilter({
        field: "server",
        operator: "is",
        value: "everything-server",
      });

      expect(matchesFilter(mockLog, filter)).toBe(true);
    });
  });

  describe("duration filter", () => {
    it("should match with 'eq' operator", () => {
      const filter = createFilter({
        field: "duration",
        operator: "eq",
        value: 150,
      });

      expect(matchesFilter(mockLog, filter)).toBe(true);
    });

    it("should match with 'gt' operator", () => {
      const filter = createFilter({
        field: "duration",
        operator: "gt",
        value: 100,
      });

      expect(matchesFilter(mockLog, filter)).toBe(true);
    });

    it("should not match when value is not greater", () => {
      const filter = createFilter({
        field: "duration",
        operator: "gt",
        value: 200,
      });

      expect(matchesFilter(mockLog, filter)).toBe(false);
    });

    it("should match with 'lt' operator", () => {
      const filter = createFilter({
        field: "duration",
        operator: "lt",
        value: 200,
      });

      expect(matchesFilter(mockLog, filter)).toBe(true);
    });

    it("should match with 'gte' operator", () => {
      const filter = createFilter({
        field: "duration",
        operator: "gte",
        value: 150,
      });

      expect(matchesFilter(mockLog, filter)).toBe(true);
    });

    it("should match with 'lte' operator", () => {
      const filter = createFilter({
        field: "duration",
        operator: "lte",
        value: 150,
      });

      expect(matchesFilter(mockLog, filter)).toBe(true);
    });

    it("should not match when duration is undefined", () => {
      const logWithoutDuration: ApiLogEntry = {
        ...mockLog,
        metadata: {
          serverName: "everything-server",
          sessionId: "session-123",
          durationMs: 0, // Duration of 0 is technically defined, so this tests the matching logic
          httpStatus: 200,
        },
      };
      const filter = createFilter({
        field: "duration",
        operator: "gt",
        value: 100,
      });

      // Since we can't actually have undefined durationMs, test with 0
      expect(matchesFilter(logWithoutDuration, filter)).toBe(false);
    });
  });

  describe("tokens filter", () => {
    it("should return true (placeholder)", () => {
      const filter = createFilter({
        field: "tokens",
        operator: "gt",
        value: 100,
      });

      // Tokens not implemented yet, always returns true
      expect(matchesFilter(mockLog, filter)).toBe(true);
    });
  });
});

describe("matchesSearch", () => {
  it("should match method", () => {
    expect(matchesSearch(mockLog, "tools")).toBe(true);
  });

  it("should match client name", () => {
    expect(matchesSearch(mockLog, "claude")).toBe(true);
  });

  it("should match server name", () => {
    expect(matchesSearch(mockLog, "everything")).toBe(true);
  });

  it("should match session ID", () => {
    expect(matchesSearch(mockLog, "session-123")).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(matchesSearch(mockLog, "CLAUDE")).toBe(true);
  });

  it("should not match when no fields contain query", () => {
    expect(matchesSearch(mockLog, "xyz")).toBe(false);
  });

  it("should return true for empty search", () => {
    expect(matchesSearch(mockLog, "")).toBe(true);
  });

  it("should return true for whitespace-only search", () => {
    expect(matchesSearch(mockLog, "   ")).toBe(true);
  });
});

// ============================================================================
// Batch Filtering Tests
// ============================================================================

describe("applyFiltersToLogs", () => {
  const logs: ApiLogEntry[] = [
    mockLog,
    {
      ...mockLog,
      id: "log-2",
      metadata: {
        ...mockLog.metadata,
        client: { name: "other-client", version: "1.0.0" },
        durationMs: 50,
      },
    },
    {
      ...mockLog,
      id: "log-3",
      method: "resources/list",
      metadata: {
        ...mockLog.metadata,
        durationMs: 200,
      },
    },
  ];

  it("should return all logs when no filters", () => {
    const result = applyFiltersToLogs(logs, []);

    expect(result).toHaveLength(3);
  });

  it("should filter by client", () => {
    const filters = [
      createFilter({
        field: "client",
        operator: "is",
        value: "claude-code",
      }),
    ];
    const result = applyFiltersToLogs(logs, filters);

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("request-1"); // mockLog has id "request-1"
    expect(result[1]?.id).toBe("log-3");
  });

  it("should filter by method", () => {
    const filters = [
      createFilter({
        field: "method",
        operator: "contains",
        value: "tools",
      }),
    ];
    const result = applyFiltersToLogs(logs, filters);

    expect(result).toHaveLength(2);
    expect(result.every((log) => log.method.includes("tools"))).toBe(true);
  });

  it("should apply multiple filters (AND logic)", () => {
    const filters = [
      createFilter({
        field: "client",
        operator: "is",
        value: "claude-code",
      }),
      createFilter({
        field: "duration",
        operator: "gt",
        value: 100,
      }),
    ];
    const result = applyFiltersToLogs(logs, filters);

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("request-1"); // mockLog has id "request-1"
    expect(result[1]?.id).toBe("log-3");
  });

  it("should filter by search query", () => {
    const result = applyFiltersToLogs(logs, [], "resources");

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("log-3");
  });

  it("should apply both filters and search", () => {
    const filters = [
      createFilter({
        field: "client",
        operator: "is",
        value: "claude-code",
      }),
    ];
    const result = applyFiltersToLogs(logs, filters, "tools");

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("request-1"); // mockLog has id "request-1"
  });

  it("should return empty array when no matches", () => {
    const filters = [
      createFilter({
        field: "client",
        operator: "is",
        value: "nonexistent",
      }),
    ];
    const result = applyFiltersToLogs(logs, filters);

    expect(result).toHaveLength(0);
  });
});

describe("applyFilterState", () => {
  it("should apply state with filters and search", () => {
    const logs: ApiLogEntry[] = [mockLog];
    const state = {
      search: "claude",
      filters: [
        createFilter({
          field: "method",
          operator: "contains",
          value: "tools",
        }),
      ],
    };

    const result = applyFilterState(logs, state);

    expect(result).toHaveLength(1);
  });
});

// ============================================================================
// Filter Helper Tests
// ============================================================================

describe("getFilterLabel", () => {
  it("should format client filter", () => {
    const filter = createFilter({
      field: "client",
      operator: "is",
      value: "claude-code",
    });

    expect(getFilterLabel(filter)).toBe("Client is claude-code");
  });

  it("should format method filter with contains", () => {
    const filter = createFilter({
      field: "method",
      operator: "contains",
      value: "tools",
    });

    expect(getFilterLabel(filter)).toBe("Method contains tools");
  });

  it("should format duration filter with units", () => {
    const filter = createFilter({
      field: "duration",
      operator: "gt",
      value: 100,
    });

    expect(getFilterLabel(filter)).toBe("Duration greater than 100ms");
  });

  it("should format numeric operators", () => {
    const filter = createFilter({
      field: "duration",
      operator: "gte",
      value: 50,
    });

    expect(getFilterLabel(filter)).toBe("Duration ≥ 50ms");
  });
});

describe("areFiltersEqual", () => {
  it("should return true for identical filters", () => {
    const filter1 = createFilter({
      field: "client",
      operator: "is",
      value: "claude-code",
    });
    const filter2 = { ...filter1 };

    expect(areFiltersEqual(filter1, filter2)).toBe(true);
  });

  it("should return false for different values", () => {
    const filter1 = createFilter({
      field: "client",
      operator: "is",
      value: "claude-code",
    });
    const filter2 = createFilter({
      field: "client",
      operator: "is",
      value: "other-client",
    });

    expect(areFiltersEqual(filter1, filter2)).toBe(false);
  });

  it("should return false for different IDs", () => {
    const filter1 = createFilter({
      field: "client",
      operator: "is",
      value: "claude-code",
    });
    const filter2 = createFilter({
      field: "client",
      operator: "is",
      value: "claude-code",
    });

    expect(areFiltersEqual(filter1, filter2)).toBe(false);
  });
});

describe("removeFilter", () => {
  it("should remove filter by ID", () => {
    const filter1 = createFilter({
      field: "client",
      operator: "is",
      value: "claude-code",
    });
    const filter2 = createFilter({
      field: "method",
      operator: "contains",
      value: "tools",
    });
    const filters = [filter1, filter2];

    const result = removeFilter(filters, filter1.id);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(filter2.id);
  });

  it("should return original array if ID not found", () => {
    const filter = createFilter({
      field: "client",
      operator: "is",
      value: "claude-code",
    });
    const filters = [filter];

    const result = removeFilter(filters, "nonexistent-id");

    expect(result).toHaveLength(1);
  });
});

describe("addOrReplaceFilter", () => {
  it("should add new filter", () => {
    const existing = [
      createFilter({
        field: "client",
        operator: "is",
        value: "claude-code",
      }),
    ];
    const newFilter = createFilter({
      field: "method",
      operator: "contains",
      value: "tools",
    });

    const result = addOrReplaceFilter(existing, newFilter);

    expect(result).toHaveLength(2);
    expect(result[1]?.id).toBe(newFilter.id);
  });

  it("should replace existing filter with same field", () => {
    const existing = [
      createFilter({
        field: "client",
        operator: "is",
        value: "claude-code",
      }),
    ];
    const replacement = createFilter({
      field: "client",
      operator: "is",
      value: "other-client",
    });

    const result = addOrReplaceFilter(existing, replacement);

    expect(result).toHaveLength(1);
    expect(result[0]?.value).toBe("other-client");
  });

  it("should preserve order when replacing", () => {
    const filter1 = createFilter({
      field: "client",
      operator: "is",
      value: "claude-code",
    });
    const filter2 = createFilter({
      field: "method",
      operator: "contains",
      value: "tools",
    });
    const existing = [filter1, filter2];
    const replacement = createFilter({
      field: "client",
      operator: "is",
      value: "other-client",
    });

    const result = addOrReplaceFilter(existing, replacement);

    expect(result).toHaveLength(2);
    expect(result[0]?.field).toBe("client");
    expect(result[1]?.field).toBe("method");
  });
});

describe("clearAllFilters", () => {
  it("should return empty array", () => {
    const result = clearAllFilters();

    expect(result).toEqual([]);
  });
});
