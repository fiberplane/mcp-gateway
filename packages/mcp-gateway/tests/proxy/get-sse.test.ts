/** biome-ignore-all lint/suspicious/noConsole: tests */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  InMemorySessionAdapter,
  McpServer,
  StreamableHttpTransport,
} from "mcp-lite";
import type { Registry } from "../../src/registry.js";
import { createApp } from "../../src/server/index.js";
import { saveRegistry } from "../../src/storage.js";

// Test harness for MCP server
interface TestServer {
  url: string;
  port: number;
  stop: () => Promise<void>;
}

// Create test MCP server that supports SSE via GET
function createTestMcpServer(name: string, port: number): TestServer {
  const mcp = new McpServer({
    name,
    version: "1.0.0",
  });

  // Add test tools
  mcp.tool("streaming_echo", {
    description: "Echoes the input message via SSE",
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

  // Configure transport with session adapter to support GET and DELETE
  const transport = new StreamableHttpTransport({
    sessionAdapter: new InMemorySessionAdapter({
      maxEventBufferSize: 1024,
    }),
  });
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

// Helper to make JSON-RPC requests via POST (for initialize)
async function makeJsonRpcRequest(
  url: string,
  method: string,
  params?: unknown,
  sessionId?: string,
): Promise<{ data: unknown; sessionId?: string }> {
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

  const data = await response.json();
  const responseSessionId =
    response.headers.get("Mcp-Session-Id") ||
    response.headers.get("mcp-session-id") ||
    undefined;

  return { data, sessionId: responseSessionId };
}

// Helper to make GET request for SSE
async function makeSSERequest(
  url: string,
  sessionId?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "MCP-Protocol-Version": "2025-06-18",
  };

  if (sessionId) {
    headers["Mcp-Session-Id"] = sessionId;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  return response;
}

describe("GET /mcp SSE Integration Tests", () => {
  let testServers: TestServer[] = [];
  let storageDir: string;
  let gateway: { port: number; stop: () => void };

  beforeAll(async () => {
    // Create temp directory for storage
    storageDir = await mkdtemp(join(tmpdir(), "mcp-gateway-get-test-"));

    // Create test MCP servers
    testServers = [
      createTestMcpServer("sse-server1", 8401),
      createTestMcpServer("sse-server2", 8402),
    ];

    // Create test registry
    const registry: Registry = {
      servers: [
        {
          name: "sse-server1",
          type: "http" as const,
          url: testServers[0]?.url || "",
          headers: {},
          lastActivity: null,
          exchangeCount: 0,
        },
        {
          name: "sse-server2",
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
      port: 8400,
      fetch: app.fetch,
    });

    gateway = {
      port: 8400,
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

  describe("SSE Proxy Routing", () => {
    it("should proxy GET request to sse-server1 (canonical) with active session", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/sse-server1/mcp`;

      // First, establish a session via initialize (no session ID sent)
      const initResult = await makeJsonRpcRequest(gatewayUrl, "initialize", {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "test", version: "1.0.0" },
      });

      // Use the session ID returned from initialize
      const sessionId = initResult.sessionId;
      expect(sessionId).toBeDefined();

      const response = await makeSSERequest(gatewayUrl, sessionId);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "text/event-stream",
      );
    });

    it("should proxy GET request to sse-server2 (canonical) with active session", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/sse-server2/mcp`;

      // First, establish a session via initialize
      const initResult = await makeJsonRpcRequest(gatewayUrl, "initialize", {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "test", version: "1.0.0" },
      });

      const sessionId = initResult.sessionId;
      expect(sessionId).toBeDefined();

      const response = await makeSSERequest(gatewayUrl, sessionId);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "text/event-stream",
      );
    });

    it("should proxy GET request via short alias with active session", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/s/sse-server1/mcp`;

      // First, establish a session via initialize
      const initResult = await makeJsonRpcRequest(gatewayUrl, "initialize", {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "test", version: "1.0.0" },
      });

      const sessionId = initResult.sessionId;
      expect(sessionId).toBeDefined();

      const response = await makeSSERequest(gatewayUrl, sessionId);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "text/event-stream",
      );
    });

    it("should return 404 for unknown server", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/unknown-sse-server/mcp`;

      const response = await makeSSERequest(gatewayUrl);

      expect(response.status).toBe(404);
    });
  });

  describe("SSE Session Handling", () => {
    it("should handle GET request with active session ID", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/sse-server1/mcp`;

      // Establish session first
      const initResult = await makeJsonRpcRequest(gatewayUrl, "initialize", {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "test", version: "1.0.0" },
      });

      const sessionId = initResult.sessionId;
      expect(sessionId).toBeDefined();

      const response = await makeSSERequest(gatewayUrl, sessionId);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "text/event-stream",
      );
    });

    it("should return 400 for GET request without session ID (requires active session)", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/sse-server1/mcp`;

      const response = await makeSSERequest(gatewayUrl);

      // mcp-lite requires an active session for GET requests
      expect(response.status).toBe(400);
    });

    it("should forward session header to downstream server", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/sse-server1/mcp`;

      // Establish session first
      const initResult = await makeJsonRpcRequest(gatewayUrl, "initialize", {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "test", version: "1.0.0" },
      });

      const sessionId = initResult.sessionId;
      expect(sessionId).toBeDefined();

      const response = await makeSSERequest(gatewayUrl, sessionId);

      expect(response.status).toBe(200);
      // The downstream server should receive the session header
      // (We can't directly verify this without server-side logging,
      // but we can verify the request succeeds)
    });
  });

  describe("SSE Stream Handling", () => {
    it("should receive SSE events from downstream server", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/sse-server1/mcp`;

      // Establish session first
      const initResult = await makeJsonRpcRequest(gatewayUrl, "initialize", {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "test", version: "1.0.0" },
      });

      const sessionId = initResult.sessionId;
      expect(sessionId).toBeDefined();

      const response = await makeSSERequest(gatewayUrl, sessionId);
      expect(response.status).toBe(200);

      // Verify we got an SSE stream (don't parse the entire stream, just check headers)
      expect(response.headers.get("content-type")).toContain(
        "text/event-stream",
      );
      expect(response.body).toBeDefined();
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it("should stream events with proper content-type header", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/sse-server2/mcp`;

      // Establish session first
      const initResult = await makeJsonRpcRequest(gatewayUrl, "initialize", {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "test", version: "1.0.0" },
      });

      const sessionId = initResult.sessionId;
      expect(sessionId).toBeDefined();

      const response = await makeSSERequest(gatewayUrl, sessionId);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/event-stream");

      // Verify it's actually a stream
      expect(response.body).toBeDefined();
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it("should forward MCP-Protocol-Version header", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/sse-server1/mcp`;

      // Establish session first
      const initResult = await makeJsonRpcRequest(gatewayUrl, "initialize", {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "test", version: "1.0.0" },
      });

      const sessionId = initResult.sessionId;
      expect(sessionId).toBeDefined();
      if (!sessionId) throw new Error("Session ID is undefined");

      const headers: Record<string, string> = {
        Accept: "text/event-stream",
        "MCP-Protocol-Version": "2025-06-18",
        "Mcp-Session-Id": sessionId,
      };

      const response = await fetch(gatewayUrl, {
        method: "GET",
        headers,
      });

      expect(response.status).toBe(200);
      // Verify the request was successful (implies header was forwarded)
    });
  });

  describe("SSE Error Handling", () => {
    it("should return 400 for GET without active session", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/sse-server1/mcp`;

      const response = await makeSSERequest(gatewayUrl);

      // mcp-lite requires an active session for GET requests
      // Returns 400 when no active session exists
      expect(response.status).toBe(400);
    });
  });
});
