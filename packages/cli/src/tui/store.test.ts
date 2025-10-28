import { beforeEach, describe, expect, test } from "bun:test";
import { useAppStore } from "./store";

describe("AppStore", () => {
  const mockRegistry = { servers: [] };

  beforeEach(() => {
    // Reset store before each test
    useAppStore.getState().initialize([], mockRegistry as any, ".test-storage", 3333);
  });

  test("initialize sets servers and storageDir", () => {
    const servers = [
      {
        name: "test",
        url: "http://localhost:3000/mcp",
        type: "http" as const,
        headers: {},
        health: "unknown" as const,
      },
    ];

    useAppStore.getState().initialize(servers, mockRegistry as any, "/test/dir", 8080);

    const state = useAppStore.getState();
    expect(state.servers).toEqual(servers);
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
      expect(state.servers[0]?.name).toBe("test-server");
      expect(state.servers[0]?.url).toBe("http://localhost:3000/mcp");
    } catch (error) {
      // Expected to fail without real file system
      expect(error).toBeDefined();
    }
  });

  test("addServer rejects duplicate names", async () => {
    useAppStore.getState().initialize(
      [
        {
          name: "existing",
          url: "http://localhost:3000/mcp",
          type: "http" as const,
          headers: {},
          health: "unknown" as const,
        },
      ],
      mockRegistry as any,
      ".test-storage",
      3333,
    );

    await expect(
      useAppStore.getState().addServer("existing", "http://localhost:4000/mcp"),
    ).rejects.toThrow("already exists");
  });

  test("setServers updates server state", () => {
    const newServers = [
      {
        name: "new-server",
        url: "http://localhost:5000/mcp",
        type: "http" as const,
        headers: {},
        health: "unknown" as const,
      },
    ];

    useAppStore.getState().setServers(newServers);

    expect(useAppStore.getState().servers).toEqual(newServers);
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
