import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addServer, isValidUrl, removeServer } from "../src/registry.js";
import { loadRegistry, saveRegistry } from "../src/storage.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "mcp-test-"));
});

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true });
  }
});

// Unit tests for registry functions
test("addServer creates new server entry", () => {
  const registry = { servers: [] };
  const newRegistry = addServer(registry, {
    name: "test-server",
    url: "https://api.example.com/mcp",
    type: "http",
    headers: {},
  });

  expect(newRegistry.servers).toHaveLength(1);
  expect(newRegistry.servers[0]?.name).toBe("test-server");
  expect(newRegistry.servers[0]?.url).toBe("https://api.example.com/mcp");
  expect(newRegistry.servers[0]?.lastActivity).toBe(null);
  expect(newRegistry.servers[0]?.exchangeCount).toBe(0);
});

test("addServer normalizes server names to lowercase", () => {
  const registry = { servers: [] };
  const newRegistry = addServer(registry, {
    name: "Test-Server",
    url: "https://api.example.com/mcp",
    type: "http",
    headers: {},
  });

  expect(newRegistry.servers[0]?.name).toBe("test-server");
});

test("addServer prevents duplicate server names", () => {
  const registry = {
    servers: [
      {
        name: "existing-server",
        url: "https://existing.com/mcp",
        type: "http" as const,
        headers: {},
        lastActivity: null,
        exchangeCount: 0,
      },
    ],
  };

  expect(() => {
    addServer(registry, {
      name: "Existing-Server", // Case insensitive
      url: "https://new.com/mcp",
      type: "http",
      headers: {},
    });
  }).toThrow("already exists");
});

test("removeServer removes existing server", () => {
  const registry = {
    servers: [
      {
        name: "server1",
        url: "https://api1.example.com/mcp",
        type: "http" as const,
        headers: {},
        lastActivity: null,
        exchangeCount: 0,
      },
      {
        name: "server2",
        url: "https://api2.example.com/mcp",
        type: "http" as const,
        headers: {},
        lastActivity: null,
        exchangeCount: 0,
      },
    ],
  };

  const newRegistry = removeServer(registry, "server1");

  expect(newRegistry.servers).toHaveLength(1);
  expect(newRegistry.servers[0]?.name).toBe("server2");
});

test("removeServer throws error for non-existent server", () => {
  const registry = { servers: [] };

  expect(() => {
    removeServer(registry, "non-existent");
  }).toThrow("not found");
});

test("isValidUrl validates HTTP/HTTPS URLs", () => {
  expect(isValidUrl("https://api.example.com/mcp")).toBe(true);
  expect(isValidUrl("http://localhost:8080/mcp")).toBe(true);
  expect(isValidUrl("ftp://example.com")).toBe(false);
  expect(isValidUrl("invalid-url")).toBe(false);
  expect(isValidUrl("")).toBe(false);
});

// Storage tests
test("loadRegistry returns empty registry for non-existent file", async () => {
  const registry = await loadRegistry(tempDir);
  expect(registry.servers).toHaveLength(0);
});

test("saveRegistry and loadRegistry persist data correctly", async () => {
  const originalRegistry = {
    servers: [
      {
        name: "test-server",
        url: "https://api.example.com/mcp",
        type: "http" as const,
        headers: { Authorization: "Bearer token" },
        lastActivity: null,
        exchangeCount: 0,
      },
    ],
  };

  await saveRegistry(tempDir, originalRegistry);
  const loadedRegistry = await loadRegistry(tempDir);

  expect(loadedRegistry.servers).toHaveLength(1);
  expect(loadedRegistry.servers[0]?.name).toBe("test-server");
  expect(loadedRegistry.servers[0]?.url).toBe("https://api.example.com/mcp");
  expect(loadedRegistry.servers[0]?.headers.Authorization).toBe("Bearer token");
});

test("loadRegistry handles invalid JSON gracefully", async () => {
  const mcpPath = join(tempDir, "mcp.json");
  await Bun.write(mcpPath, "invalid json");

  // Should warn and return empty registry
  const registry = await loadRegistry(tempDir);
  expect(registry.servers).toHaveLength(0);
});

// Simple integration tests using command line flags only
test("CLI shows help when --help flag is used", async () => {
  const proc = Bun.spawn(["bun", "run", "src/run.ts", "--help"], {
    stdout: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  expect(output).toContain("Usage: mcp-gateway");
  expect(output).toContain("--storage-dir");
  expect(output).toContain("Interactive CLI for managing MCP servers");
  expect(proc.exitCode).toBe(0);
});

test("CLI shows version when --version flag is used", async () => {
  const proc = Bun.spawn(["bun", "run", "src/run.ts", "--version"], {
    stdout: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  expect(output).toContain("mcp-gateway v");
  expect(proc.exitCode).toBe(0);
});

test("CLI exits gracefully when given 'q' input", async () => {
  const proc = Bun.spawn(
    ["bun", "run", "src/run.ts", "--storage-dir", tempDir],
    {
      stdin: "pipe",
      stdout: "pipe",
    },
  );

  // Send quit command
  await proc.stdin.write("q");
  proc.stdin.end();

  await proc.exited;
  expect(proc.exitCode).toBe(0);
});

test("CLI menu renders without errors in non-interactive mode", async () => {
  const proc = Bun.spawn(
    ["bun", "run", "src/run.ts", "--storage-dir", tempDir],
    {
      stdin: "pipe",
      stdout: "pipe",
    },
  );

  // Send quit command immediately
  setTimeout(() => {
    proc.stdin.write("q");
    proc.stdin.end();
  }, 100);

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  expect(output).toContain("MCP Gateway v0.1.0");
  expect(output).toContain("No servers registered");
  expect(output).toContain("Add server");
  expect(output).toContain("Quit");
  expect(proc.exitCode).toBe(0);
}, 5000);
