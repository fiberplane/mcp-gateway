/** biome-ignore-all lint/suspicious/noConsole: tests */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Gateway } from "@fiberplane/mcp-gateway-core";
import type { McpServer } from "@fiberplane/mcp-gateway-types";
import { McpServer as McpServerLib, StreamableHttpTransport } from "mcp-lite";
import { createApp } from "../helpers/test-app.js";

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
  const mcp = new McpServerLib({
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
  let gateway: {
    port: number;
    stop: () => void;
    instance: Gateway;
  };

  beforeAll(async () => {
    // Use temporary directory for tests (reliable with libsql)
    // Note: In-memory databases (":memory:") don't work reliably with libsql
    // because each connection creates a separate database
    storageDir = `/tmp/mcp-gateway-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Create temporary directory for database
    await import("node:fs/promises").then((fs) =>
      fs.mkdir(storageDir, { recursive: true }),
    );

    // Create test MCP servers
    testServers = [
      createTestMcpServer("server1", 8001),
      createTestMcpServer("server2", 8002),
    ];

    // Create test servers
    const servers: McpServer[] = [
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
    ];

    // Create and start gateway app (createApp will add servers to storage)
    const { app, gateway: gatewayInstance } = await createApp(
      servers,
      storageDir,
    );
    const server = Bun.serve({
      port: 8100, // Changed from 8000 to avoid conflicts with auth-401s.test.ts
      fetch: app.fetch,
    });

    gateway = {
      port: 8100,
      stop: () => server.stop(),
      instance: gatewayInstance,
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
    // Close gateway to ensure clean shutdown
    try {
      await gateway?.instance?.close();
    } catch (err) {
      console.warn("Failed to close gateway:", err);
    }

    // Stop all servers with error handling
    try {
      gateway?.stop();
    } catch (err) {
      console.warn("Failed to stop gateway:", err);
    }

    for (const server of testServers) {
      try {
        await server.stop();
      } catch (err) {
        console.warn("Failed to stop test server:", err);
      }
    }

    // Clean up temporary directory
    try {
      await import("node:fs/promises").then((fs) =>
        fs.rm(storageDir, { recursive: true, force: true }),
      );
    } catch (err) {
      console.warn("Failed to clean up test directory:", err);
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
    it("should capture logs to database", async () => {
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

      // Wait for async capture to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Query logs from database
      const queryResult = await gateway.instance.storage.query({
        serverName: { operator: "is", value: "server1" },
        sessionId: { operator: "is", value: sessionId },
      });

      // Should have captured the request and response
      expect(queryResult.data.length).toBeGreaterThan(0);
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

      // Wait for async capture to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Query logs from database
      const queryResult = await gateway.instance.storage.query({
        serverName: { operator: "is", value: "server2" },
        sessionId: { operator: "is", value: sessionId },
        order: "asc",
      });

      // Should have two records: request and response
      expect(queryResult.data).toHaveLength(2);

      const requestRecord = queryResult.data[0];
      const responseRecord = queryResult.data[1];

      // Validate request record
      expect(requestRecord.timestamp).toBeDefined();
      expect(requestRecord.method).toBe("tools/call");
      expect(requestRecord.id).toBeDefined();
      expect(requestRecord.metadata.serverName).toBe("server2");
      expect(requestRecord.metadata.sessionId).toBe(sessionId);
      expect(requestRecord.request?.method).toBe("tools/call");
      expect(requestRecord.response).toBeUndefined();

      // Validate response record
      expect(responseRecord.timestamp).toBeDefined();
      expect(responseRecord.method).toBe("tools/call");
      expect(responseRecord.id).toBe(requestRecord.id);
      expect(responseRecord.metadata.serverName).toBe("server2");
      expect(responseRecord.metadata.sessionId).toBe(sessionId);
      expect(responseRecord.request).toBeUndefined();
      expect(responseRecord.response?.result?.content?.[0]?.text).toBe("30");
    });
  });
});
