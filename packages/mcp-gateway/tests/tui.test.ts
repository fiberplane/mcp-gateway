import { expect, test } from "bun:test";
import type { Registry } from "../src/registry.js";
import { renderMenu } from "../src/tui/components/menu.js";
import { renderModal } from "../src/tui/components/modal.js";
import type { LogEntry } from "../src/tui/state.js";

// TUI Snapshot Tests
//
// These test the pure rendering functions (renderMenu, renderModal) without needing a TTY.
// Snapshots capture the exact output including ANSI escape codes for colors and formatting.
//
// Benefits:
// - Fast: No need to spawn processes or allocate PTYs
// - Reliable: Pure functions with deterministic output
// - Comprehensive: Can test all UI states easily
// - Regression detection: Catches unintended visual changes
//
// To update snapshots after intentional UI changes: bun test --update-snapshots
// For interactive testing with real TTY, run: bun run ./src/run.ts in tmux

test("TUI snapshot: empty menu with no servers", () => {
  const registry: Registry = { servers: [] };
  const logs: LogEntry[] = [];

  const output = renderMenu(registry, logs);

  expect(output).toMatchSnapshot();
});

test("TUI snapshot: menu with single HTTP server", () => {
  const registry: Registry = {
    servers: [
      {
        name: "test-server",
        url: "https://api.example.com/mcp",
        type: "http",
        headers: {},
        lastActivity: null,
        exchangeCount: 0,
      },
    ],
  };
  const logs: LogEntry[] = [];

  const output = renderMenu(registry, logs);

  expect(output).toMatchSnapshot();
});

test("TUI snapshot: menu with multiple servers and health status", () => {
  const registry: Registry = {
    servers: [
      {
        name: "healthy-server",
        url: "https://api1.example.com/mcp",
        type: "http",
        headers: {},
        lastActivity: new Date("2025-09-30T12:00:00Z").toISOString(),
        exchangeCount: 42,
        health: "up",
        lastHealthCheck: new Date("2025-09-30T12:00:00Z").toISOString(),
      },
      {
        name: "unhealthy-server",
        url: "https://api2.example.com/mcp",
        type: "http",
        headers: {},
        lastActivity: null,
        exchangeCount: 0,
        health: "down",
        lastHealthCheck: new Date("2025-09-30T12:00:00Z").toISOString(),
      },
      {
        name: "unknown-server",
        url: "https://api3.example.com/mcp",
        type: "http",
        headers: {},
        lastActivity: new Date("2025-09-30T11:30:00Z").toISOString(),
        exchangeCount: 15,
        health: "unknown",
      },
    ],
  };
  const logs: LogEntry[] = [];

  const output = renderMenu(registry, logs);

  expect(output).toMatchSnapshot();
});

test("TUI snapshot: menu with logs", () => {
  const registry: Registry = { servers: [] };
  const logs = [
    {
      timestamp: "2025-09-30T12:00:00.000Z",
      serverName: "test-server",
      sessionId: "abc12345-6789",
      method: "tools/list",
      httpStatus: 200,
      duration: 42,
      direction: "request" as const,
    },
    {
      timestamp: "2025-09-30T12:00:00.050Z",
      serverName: "test-server",
      sessionId: "abc12345-6789",
      method: "tools/list",
      httpStatus: 200,
      duration: 50,
      direction: "response" as const,
    },
    {
      timestamp: "2025-09-30T12:00:01.000Z",
      serverName: "test-server",
      sessionId: "def98765-4321",
      method: "tools/call",
      httpStatus: 500,
      duration: 100,
      direction: "response" as const,
      errorMessage: "Internal server error",
    },
  ];

  const output = renderMenu(registry, logs);

  expect(output).toMatchSnapshot();
});

test("TUI snapshot: add server form with empty fields", () => {
  const formState = {
    fields: [
      {
        name: "name",
        label: "Server Name",
        value: "",
        placeholder: "my-server",
      },
      {
        name: "url",
        label: "URL",
        value: "",
        placeholder: "https://api.example.com/mcp",
      },
    ],
    focusedFieldIndex: 0,
  };

  const output = renderModal("add_server_form", formState, undefined, {
    servers: [],
  });

  expect(output).toMatchSnapshot();
});

test("TUI snapshot: add server form with partial input", () => {
  const formState = {
    fields: [
      {
        name: "name",
        label: "Server Name",
        value: "my-api",
      },
      {
        name: "url",
        label: "URL",
        value: "https://api.example.com",
        error: "Invalid URL format",
      },
    ],
    focusedFieldIndex: 1,
  };

  const output = renderModal("add_server_form", formState, undefined, {
    servers: [],
  });

  expect(output).toMatchSnapshot();
});

test("TUI snapshot: delete server selection list", () => {
  const registry: Registry = {
    servers: [
      {
        name: "server1",
        url: "https://api1.example.com/mcp",
        type: "http",
        headers: {},
        lastActivity: null,
        exchangeCount: 0,
        health: "up",
      },
      {
        name: "server2",
        url: "https://api2.example.com/mcp",
        type: "http",
        headers: {},
        lastActivity: null,
        exchangeCount: 0,
        health: "down",
      },
    ],
  };

  const deleteServerState = {
    selectedIndex: 1,
    showConfirm: false,
  };

  const output = renderModal(
    "delete_server_form",
    undefined,
    deleteServerState,
    registry,
  );

  expect(output).toMatchSnapshot();
});

test("TUI snapshot: delete server confirmation", () => {
  const registry: Registry = {
    servers: [
      {
        name: "production-api",
        url: "https://prod.example.com/mcp",
        type: "http",
        headers: {},
        lastActivity: null,
        exchangeCount: 0,
        health: "down",
      },
    ],
  };

  const deleteServerState = {
    selectedIndex: 0,
    showConfirm: true,
  };

  const output = renderModal(
    "delete_server_form",
    undefined,
    deleteServerState,
    registry,
  );

  expect(output).toMatchSnapshot();
});

test("TUI snapshot: MCP instructions modal", () => {
  const output = renderModal("mcp_instructions", undefined, undefined, {
    servers: [],
  });

  expect(output).toMatchSnapshot();
});
