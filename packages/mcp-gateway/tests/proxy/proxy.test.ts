/** biome-ignore-all lint/suspicious/noConsole: tests */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import type { Registry } from "../../src/registry.js";
import { createApp } from "../../src/server/index.js";
import { saveRegistry } from "../../src/storage.js";

// JSON-RPC response type
interface JsonRpcResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Test harness for MCP server
interface TestServer {
  url: string;
  port: number;
  stop: () => Promise<void>;
}

// Create test MCP server
function createTestMcpServer(name: string, port: number): TestServer {
  const mcp = new McpServer({
    name,
    version: "1.0.0",
  });

  // Add test tools
  mcp.tool("echo", {
    description: "Echoes the input message",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      required: ["message"],
    },
    handler: (args: { message: string }) => ({
      content: [{ type: "text", text: args.message }],
    }),
  });

  mcp.tool("add", {
    description: "Adds two numbers",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "number" },
      },
      required: ["a", "b"],
    },
    handler: (args: { a: number; b: number }) => ({
      content: [{ type: "text", text: String(args.a + args.b) }],
    }),
  });

  const transport = new StreamableHttpTransport();
  const handler = transport.bind(mcp);

  // Start HTTP server
  const server = Bun.serve({
    port,
    fetch: handler,
  });

  return {
    url: `http://localhost:${port}`,
    port,
    stop: async () => {
      server.stop();
    },
  };
}

// Helper to make JSON-RPC requests
async function makeJsonRpcRequest(
  url: string,
  method: string,
  params?: unknown,
  sessionId?: string,
): Promise<JsonRpcResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "MCP-Protocol-Version": "2025-06-18",
  };

  if (sessionId) {
    headers["Mcp-Session-Id"] = sessionId;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Math.random().toString(36),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<JsonRpcResponse>;
}

describe("Proxy Integration Tests", () => {
  let testServers: TestServer[] = [];
  let storageDir: string;
  let gateway: { port: number; stop: () => void };

  beforeAll(async () => {
    // Create temp directory for storage
    storageDir = await mkdtemp(join(tmpdir(), "mcp-gateway-test-"));

    // Create test MCP servers
    testServers = [
      createTestMcpServer("server1", 8001),
      createTestMcpServer("server2", 8002),
    ];

    // Create test registry
    const registry: Registry = {
      servers: [
        {
          name: "server1",
          type: "http" as const,
          url: testServers[0]?.url || "",
          headers: {},
          lastActivity: null,
          exchangeCount: 0,
        },
        {
          name: "server2",
          type: "http" as const,
          url: testServers[1]?.url || "",
          headers: {},
          lastActivity: null,
          exchangeCount: 0,
        },
      ],
    };

    // Save registry to storage
    await saveRegistry(storageDir, registry);

    // Create and start gateway app
    const { app } = await createApp(registry, storageDir);
    const server = Bun.serve({
      port: 8000,
      fetch: app.fetch,
    });

    gateway = {
      port: 8000,
      stop: () => server.stop(),
    };

    // Initialize both test servers
    for (const testServer of testServers) {
      await makeJsonRpcRequest(testServer.url, "initialize", {
        protocolVersion: "2025-06-18",
        clientInfo: {
          name: "test-client",
          version: "1.0.0",
        },
      });
    }
  });

  afterAll(async () => {
    // Stop all servers
    gateway?.stop();
    for (const server of testServers) {
      await server.stop();
    }

    // Clean up temp directory
    try {
      await rm(storageDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("Failed to clean up temp directory:", error);
    }
  });

  describe("Proxy Routing", () => {
    it("should route requests to server1 (canonical)", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/server1/mcp`;

      const response = await makeJsonRpcRequest(gatewayUrl, "tools/call", {
        name: "echo",
        arguments: { message: "hello from server1" },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toEqual({
        content: [{ type: "text", text: "hello from server1" }],
      });
    });

    it("should route requests to server2 (canonical)", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/server2/mcp`;

      const response = await makeJsonRpcRequest(gatewayUrl, "tools/call", {
        name: "add",
        arguments: { a: 5, b: 3 },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toEqual({
        content: [{ type: "text", text: "8" }],
      });
    });

    it("should route requests via short alias", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/s/server1/mcp`;

      const response = await makeJsonRpcRequest(gatewayUrl, "tools/call", {
        name: "echo",
        arguments: { message: "hello via alias" },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toEqual({
        content: [{ type: "text", text: "hello via alias" }],
      });
    });

    it("should return 404 for unknown server", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/unknown-server/mcp`;

      try {
        await makeJsonRpcRequest(gatewayUrl, "tools/call", {
          name: "echo",
          arguments: { message: "test" },
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(String(error)).toContain("404");
      }
    });
  });

  describe("Session Handling", () => {
    it("should handle requests with session ID", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/server1/mcp`;
      const sessionId = "test-session-123";

      const response = await makeJsonRpcRequest(
        gatewayUrl,
        "tools/call",
        {
          name: "echo",
          arguments: { message: "session test" },
        },
        sessionId,
      );

      expect(response.error).toBeUndefined();
      expect(response.result).toEqual({
        content: [{ type: "text", text: "session test" }],
      });
    });

    it("should handle stateless requests", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/server1/mcp`;

      const response = await makeJsonRpcRequest(gatewayUrl, "tools/call", {
        name: "echo",
        arguments: { message: "stateless test" },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toEqual({
        content: [{ type: "text", text: "stateless test" }],
      });
    });
  });

  describe("Capture Storage", () => {
    it("should create capture files", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/server1/mcp`;
      const sessionId = "capture-test-session";

      await makeJsonRpcRequest(
        gatewayUrl,
        "tools/call",
        {
          name: "echo",
          arguments: { message: "capture test" },
        },
        sessionId,
      );

      // Check if capture file exists
      const serverDir = join(storageDir, "server1");
      const files = await Bun.$`find ${serverDir} -name "*.jsonl"`.text();

      expect(files.trim()).not.toBe("");
      expect(files).toContain("-server1-capture_test_session.jsonl");
    });

    it("should capture request and response data", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/server2/mcp`;
      const sessionId = "data-capture-test";

      await makeJsonRpcRequest(
        gatewayUrl,
        "tools/call",
        {
          name: "add",
          arguments: { a: 10, b: 20 },
        },
        sessionId,
      );

      // Read the capture file
      const serverDir = join(storageDir, "server2");
      const sanitizedSessionId = sessionId.replace(/[^a-zA-Z0-9]/g, "_");
      const files =
        await Bun.$`find ${serverDir} -name "*${sanitizedSessionId}*.jsonl"`.text();
      const captureFile = files.trim().split("\n")[0];

      expect(captureFile).toBeTruthy();

      if (!captureFile) {
        throw new Error("Capture file not found");
      }

      const content = await Bun.file(captureFile).text();
      const lines = content.trim().split("\n");

      // Should have two lines: request and response
      expect(lines).toHaveLength(2);

      const requestRecord = JSON.parse(lines[0] ?? "");
      const responseRecord = JSON.parse(lines[1] ?? "");

      // Validate request record
      expect(requestRecord.timestamp).toBeDefined();
      expect(requestRecord.method).toBe("tools/call");
      expect(requestRecord.id).toBeDefined();
      expect(requestRecord.metadata.serverName).toBe("server2");
      expect(requestRecord.metadata.sessionId).toBe(sessionId);
      expect(requestRecord.request.method).toBe("tools/call");
      expect(requestRecord.response).toBeUndefined();

      // Validate response record
      expect(responseRecord.timestamp).toBeDefined();
      expect(responseRecord.method).toBe("tools/call");
      expect(responseRecord.id).toBe(requestRecord.id);
      expect(responseRecord.metadata.serverName).toBe("server2");
      expect(responseRecord.metadata.sessionId).toBe(sessionId);
      expect(responseRecord.request).toBeUndefined();
      expect(responseRecord.response.result.content[0].text).toBe("30");
    });
  });
});
