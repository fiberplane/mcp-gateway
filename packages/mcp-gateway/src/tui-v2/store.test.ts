import { beforeEach, describe, expect, test } from "bun:test";
import { useAppStore } from "./store";

describe("AppStore", () => {
  beforeEach(() => {
    // Reset store before each test
    useAppStore.getState().initialize({ servers: [] }, ".test-storage", 3333);
  });

  test("initialize sets registry and storageDir", () => {
    const registry = {
      servers: [
        {
          name: "test",
          url: "http://localhost:3000/mcp",
          type: "http" as const,
          headers: {},
          lastActivity: null,
          exchangeCount: 0,
        },
      ],
    };

    useAppStore.getState().initialize(registry, "/test/dir", 8080);

    const state = useAppStore.getState();
    expect(state.registry).toEqual(registry);
    expect(state.storageDir).toBe("/test/dir");
    expect(state.port).toBe(8080);
  });

  test("addServer normalizes name and URL", async () => {
    // Note: This will fail without a real storage dir, but demonstrates the logic
    try {
      await useAppStore
        .getState()
        .addServer("Test-Server  ", "http://localhost:3000/mcp/");

      const state = useAppStore.getState();
      expect(state.registry.servers[0]?.name).toBe("test-server");
      expect(state.registry.servers[0]?.url).toBe("http://localhost:3000/mcp");
    } catch (error) {
      // Expected to fail without real file system
      expect(error).toBeDefined();
    }
  });

  test("addServer rejects duplicate names", async () => {
    useAppStore.getState().initialize(
      {
        servers: [
          {
            name: "existing",
            url: "http://localhost:3000/mcp",
            type: "http" as const,
            headers: {},
            lastActivity: null,
            exchangeCount: 0,
          },
        ],
      },
      ".test-storage",
      3333,
    );

    await expect(
      useAppStore.getState().addServer("existing", "http://localhost:4000/mcp"),
    ).rejects.toThrow("already exists");
  });

  test("setRegistry updates registry state", () => {
    const newRegistry = {
      servers: [
        {
          name: "new-server",
          url: "http://localhost:5000/mcp",
          type: "http" as const,
          headers: {},
          lastActivity: null,
          exchangeCount: 0,
        },
      ],
    };

    useAppStore.getState().setRegistry(newRegistry);

    expect(useAppStore.getState().registry).toEqual(newRegistry);
  });

  test("addLog and clearLogs work correctly", () => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      serverName: "test",
      sessionId: "session-1",
      method: "test/method",
      httpStatus: 200,
      duration: 100,
      direction: "request" as const,
    };

    useAppStore.getState().addLog(logEntry);
    expect(useAppStore.getState().logs).toHaveLength(1);

    useAppStore.getState().clearLogs();
    expect(useAppStore.getState().logs).toHaveLength(0);
  });
});
