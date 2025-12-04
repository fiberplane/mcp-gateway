/**
 * Shared mock components for testing
 *
 * IMPORTANT: Be careful when adding mock.module() calls here.
 * Bun's mocks are global and persist across test files, which can cause
 * flaky tests when execution order varies. Only mock what's truly necessary
 * (like API hooks) and prefer using real components when possible.
 */

import { mock } from "bun:test";
import type { McpServerConfig } from "@fiberplane/mcp-gateway-types";
import type { IApiClient } from "../lib/api";

/**
 * Mock for AddFilterDropdown component
 * Used by: filter-bar.test.tsx
 *
 * This mock is safe because AddFilterDropdown has complex internal state
 * and we only need to verify it renders in the filter bar.
 */
export const mockAddFilterDropdown = () => {
  mock.module("@/components/add-filter-dropdown", () => ({
    AddFilterDropdown: () => (
      <button type="button" data-testid="add-filter-dropdown">
        Add Filter
      </button>
    ),
  }));
};

/**
 * Mock for use-available-filters hooks
 * Used by: command-filter-input.test.tsx, filter-bar.test.tsx
 *
 * This mock is necessary to avoid actual API calls during tests.
 * These hooks fetch data from the API, so we need to provide fake data.
 */
export const mockUseAvailableFilters = () => {
  mock.module("@/lib/use-available-filters", () => ({
    useAvailableServers: () => ({
      data: { servers: [{ name: "test-server" }] },
    }),
    useAvailableClients: () => ({
      data: { clients: [{ clientName: "claude-code" }] },
    }),
    useAvailableMethods: () => ({
      data: { methods: [{ method: "tools/call" }] },
    }),
    useAvailableSessions: () => ({
      data: { sessions: [{ sessionId: "session-123" }] },
    }),
  }));
};

/**
 * Create a mock API client for tests
 * Returns an object that implements IApiClient interface
 */
export const createMockApiClient = (): IApiClient => ({
  getLogs: mock(async () => ({
    data: [],
    pagination: {
      count: 0,
      limit: 100,
      hasMore: false,
      oldestTimestamp: null,
      newestTimestamp: null,
    },
  })),
  getServers: mock(async () => ({ servers: [] })),
  getServerConfigs: mock(async () => ({ servers: [] })),
  addServer: mock(async () => ({
    success: true,
    server: {} as McpServerConfig,
  })),
  updateServer: mock(async () => ({ success: true, message: "Updated" })),
  deleteServer: mock(async () => ({ success: true, message: "Deleted" })),
  checkServerHealth: mock(async () => ({
    server: {
      name: "test",
      url: "http://localhost",
      type: "http" as const,
      headers: {},
      health: "up" as const,
      lastActivity: null,
      exchangeCount: 0,
    },
  })),
  getClients: mock(async () => ({ clients: [] })),
  getMethods: mock(async () => ({ methods: [] })),
  getSessions: mock(async () => ({ sessions: [] })),
  clearSessions: mock(async () => ({ success: true })),
  restartStdioServer: mock(async () => ({
    success: true,
    message: "Restarted",
  })),
});
