import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addServer,
  isValidUrl,
  removeServer,
} from "@fiberplane/mcp-gateway-core";
import type { McpServer } from "@fiberplane/mcp-gateway-types";
import { loadRegistry, saveRegistry } from "./helpers/test-app.js";

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
  const servers: McpServer[] = [];
  const newServers = addServer(servers, {
    name: "test-server",
    url: "https://api.example.com/mcp",
    type: "http",
    headers: {},
  });

  expect(newServers).toHaveLength(1);
  expect(newServers[0]?.name).toBe("test-server");
  expect(newServers[0]?.url).toBe("https://api.example.com/mcp");
  expect(newServers[0]?.lastActivity).toBe(null);
  expect(newServers[0]?.exchangeCount).toBe(0);
});

test("addServer normalizes server names to lowercase", () => {
  const servers: McpServer[] = [];
  const newServers = addServer(servers, {
    name: "Test-Server",
    url: "https://api.example.com/mcp",
    type: "http",
    headers: {},
  });

  expect(newServers[0]?.name).toBe("test-server");
});

test("addServer prevents duplicate server names", () => {
  const servers = [
    {
      name: "existing-server",
      url: "https://existing.com/mcp",
      type: "http" as const,
      headers: {},
      lastActivity: null,
      exchangeCount: 0,
    },
  ];

  expect(() => {
    addServer(servers, {
      name: "Existing-Server", // Case insensitive
      url: "https://new.com/mcp",
      type: "http",
      headers: {},
    });
  }).toThrow("already exists");
});

test("removeServer removes existing server", () => {
  const servers = [
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
  ];

  const newServers = removeServer(servers, "server1");

  expect(newServers).toHaveLength(1);
  expect(newServers[0]?.name).toBe("server2");
});

test("removeServer throws error for non-existent server", () => {
  const servers: McpServer[] = [];

  expect(() => {
    removeServer(servers, "non-existent");
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
test("loadRegistry returns empty server list for non-existent file", async () => {
  const servers = await loadRegistry(tempDir);
  expect(servers).toHaveLength(0);
});

test("saveRegistry and loadRegistry persist data correctly", async () => {
  const originalServers = [
    {
      name: "test-server",
      url: "https://api.example.com/mcp",
      type: "http" as const,
      headers: { Authorization: "Bearer token" },
      lastActivity: null,
      exchangeCount: 0,
    },
  ];

  await saveRegistry(tempDir, originalServers);
  const loadedServers = await loadRegistry(tempDir);

  expect(loadedServers).toHaveLength(1);
  expect(loadedServers[0]?.name).toBe("test-server");
  expect(loadedServers[0]?.url).toBe("https://api.example.com/mcp");
  expect(loadedServers[0]?.headers.Authorization).toBe("Bearer token");
});

test("loadRegistry handles invalid JSON gracefully", async () => {
  const mcpPath = join(tempDir, "mcp.json");
  await Bun.write(mcpPath, "invalid json");

  // Should warn and return empty server list
  const servers = await loadRegistry(tempDir);
  expect(servers).toHaveLength(0);
});

// CLI integration tests
test("CLI shows help when --help flag is used", async () => {
  const proc = Bun.spawn(["bun", "run", "./src/cli.ts", "--help"], {
    stdout: "pipe",
    cwd: `${import.meta.dir}/..`,
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  expect(output).toContain("Usage: mcp-gateway");
  expect(output).toContain("--storage-dir");
  expect(output).toContain("Interactive CLI for managing MCP servers");
  expect(proc.exitCode).toBe(0);
});

test("CLI shows version when --version flag is used", async () => {
  const proc = Bun.spawn(["bun", "run", "./src/cli.ts", "--version"], {
    stdout: "pipe",
    cwd: `${import.meta.dir}/..`,
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  expect(output).toContain("mcp-gateway v");
  expect(proc.exitCode).toBe(0);
});

// Headless mode tests (non-TTY environment)
test("Headless mode: CLI runs without TUI when stdin is not a TTY", async () => {
  const proc = Bun.spawn(
    ["bun", "run", "./src/cli.ts", "--storage-dir", tempDir, "--port", "8100"],
    {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      cwd: `${import.meta.dir}/..`,
    },
  );

  // Collect output as it comes in
  let output = "";
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();

  // Read output until we see both expected messages
  const checkOutput = async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      output += decoder.decode(value, { stream: true });

      if (
        output.includes("MCP Gateway server started") &&
        output.includes("Running in headless mode")
      ) {
        break;
      }
    }
  };

  // Wait for expected output with timeout
  await Promise.race([
    checkOutput(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout waiting for output")), 3000),
    ),
  ]).finally(() => {
    proc.kill();
  });

  expect(output).toContain(
    "MCP Gateway server started at http://localhost:8100",
  );
  expect(output).toContain("Running in headless mode (no TTY detected)");

  await proc.exited;
});

test("Headless mode: CLI server responds to SIGTERM gracefully", async () => {
  const proc = Bun.spawn(
    ["bun", "run", "./src/cli.ts", "--storage-dir", tempDir, "--port", "8200"],
    {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      cwd: `${import.meta.dir}/..`,
    },
  );

  // Continuously read stdout in background to capture all output
  let stdoutData = "";
  const stdoutReader = proc.stdout.getReader();
  const decoder = new TextDecoder();

  const collectOutput = async () => {
    try {
      while (true) {
        const { value, done } = await stdoutReader.read();
        if (done) break;
        stdoutData += decoder.decode(value, { stream: true });
      }
    } catch {
      // Stream closed, that's fine
    }
  };

  // Start collecting output in background
  const outputCollector = collectOutput();

  // Wait until we see both "server started" and "headless mode" messages
  await Promise.race([
    (async () => {
      while (
        !(stdoutData.includes("MCP Gateway server started") &&
          stdoutData.includes("Running in headless mode"))
      ) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    })(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout waiting for server start")), 3000),
    ),
  ]);

  // Now send SIGTERM
  proc.kill("SIGTERM");

  // Give the process a moment to handle SIGTERM and write output
  await new Promise(resolve => setTimeout(resolve, 100));

  // Wait for process to exit and output collection to complete
  await Promise.all([proc.exited, outputCollector]);

  const fullOutput = stdoutData;

  // Verify headless mode message appears
  expect(fullOutput).toContain("Running in headless mode (no TTY detected)");

  // Verify graceful shutdown via exit code
  // Note: The "Received SIGTERM, shutting down..." message may not always be
  // captured due to stdout buffering when process.exit() is called immediately
  // after console.log(). The exit code of 0 confirms the handler ran successfully.
  expect(proc.exitCode).toBe(0);
});
