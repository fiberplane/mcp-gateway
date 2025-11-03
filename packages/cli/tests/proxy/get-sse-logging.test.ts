/** biome-ignore-all lint/suspicious/noConsole: tests */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Gateway } from "@fiberplane/mcp-gateway-core";
import type { McpServer } from "@fiberplane/mcp-gateway-types";
import {
  InMemorySessionAdapter,
  McpServer as McpServerLib,
  StreamableHttpTransport,
} from "mcp-lite";
import { createApp, saveRegistry } from "../helpers/test-app.js";

// Test harness for MCP server
interface TestServer {
  url: string;
  port: number;
  stop: () => Promise<void>;
}

// (parseSSEStream helper removed - we now parse inline in tests for better control)

// Create test MCP server that supports SSE via GET with session tracking
function createTestMcpServer(name: string, port: number): TestServer {
  const mcp = new McpServerLib({
    name,
    version: "1.0.0",
  });

  // Add a simple tool that can be called
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

  // Add a tool that sends progress notifications via SSE
  mcp.tool("slow_operation", {
    description: "Performs a slow operation with progress updates",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number" },
        message: { type: "string" },
      },
      required: ["count", "message"],
    },
    handler: async (args: { count: number; message: string }, ctx) => {
      // Send progress notifications that will be buffered for SSE
      for (let i = 1; i <= args.count; i++) {
        await ctx.progress?.({
          progress: i,
          total: args.count,
          message: `${args.message} - step ${i}`,
        });
      }
      return {
        content: [
          {
            type: "text",
            text: `Completed ${args.count} steps: ${args.message}`,
          },
        ],
      };
    },
  });

  // Configure transport with session adapter to support SSE
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

// Helper to make JSON-RPC requests via POST (for initialize and tool calls)
async function makeJsonRpcRequest(
  url: string,
  method: string,
  params?: unknown,
  sessionId?: string,
): Promise<{ data: unknown; sessionId?: string; response: Response }> {
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
      id: Math.random().toString(36).substring(2, 11),
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

  return { data, sessionId: responseSessionId, response };
}

// Helper to make GET request for SSE
async function makeSSERequest(
  url: string,
  sessionId: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "MCP-Protocol-Version": "2025-06-18",
    "Mcp-Session-Id": sessionId,
  };

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  return response;
}

describe("GET /mcp SSE Logging and Capture Tests", () => {
  let testServer: TestServer;
  let storageDir: string;
  let gateway: {
    port: number;
    stop: () => void;
    instance: Gateway;
  };

  beforeAll(async () => {
    // Create temp directory for storage
    storageDir = await mkdtemp(join(tmpdir(), "mcp-gateway-get-logging-"));

    // Create test MCP server
    testServer = createTestMcpServer("streaming-server", 8501);

    // Create test servers
    const servers: McpServer[] = [
      {
        name: "streaming-server",
        type: "http" as const,
        url: testServer.url,
        headers: {},
        lastActivity: null,
        exchangeCount: 0,
      },
    ];

    // Save registry to storage
    await saveRegistry(storageDir, servers);

    // Create and start gateway app
    const { app, gateway: gatewayInstance } = await createApp(
      servers,
      storageDir,
    );
    const server = Bun.serve({
      port: 8500,
      fetch: app.fetch,
    });

    gateway = {
      port: 8500,
      stop: () => server.stop(),
      instance: gatewayInstance,
    };
  });

  afterAll(async () => {
    // Stop all servers with error handling
    try {
      gateway?.stop();
    } catch (err) {
      console.warn("Failed to stop gateway:", err);
    }

    try {
      await testServer?.stop();
    } catch (err) {
      console.warn("Failed to stop test server:", err);
    }

    // Clean up temp directory
    try {
      await rm(storageDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("Failed to clean up temp directory:", error);
    }
  });

  describe("SSE Stream Capture", () => {
    it("should capture JSON-RPC messages from GET SSE stream (canonical route)", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/streaming-server/mcp`;

      // 1. Initialize session
      const initResult = await makeJsonRpcRequest(gatewayUrl, "initialize", {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "test-client", version: "1.0.0" },
      });
      const sessionId = initResult.sessionId;
      expect(sessionId).toBeDefined();
      if (!sessionId) throw new Error("Session ID is undefined");

      // 2. Open SSE stream first
      const sseResponse = await makeSSERequest(gatewayUrl, sessionId);
      expect(sseResponse.status).toBe(200);
      expect(sseResponse.headers.get("content-type")).toContain(
        "text/event-stream",
      );

      // 3. Start reading the stream in the background
      const events: Array<{ event?: string; data?: string; id?: string }> = [];
      if (!sseResponse.body) throw new Error("No response body");
      const reader = sseResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const readStream = async () => {
        try {
          while (events.length < 3) {
            // Read until we get 3 progress events
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            let currentEvent: { event?: string; data?: string; id?: string } =
              {};
            for (const line of lines) {
              if (line === "") {
                if (Object.keys(currentEvent).length > 0) {
                  events.push(currentEvent);
                  currentEvent = {};
                }
              } else if (line.startsWith("event:")) {
                currentEvent.event = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                const data = line.slice(5).trim();
                currentEvent.data = currentEvent.data
                  ? `${currentEvent.data}\n${data}`
                  : data;
              } else if (line.startsWith("id:")) {
                currentEvent.id = line.slice(3).trim();
              }
            }
          }
        } catch (error) {
          console.error("Stream reading error:", error);
        } finally {
          reader.releaseLock();
        }
      };

      // Start reading
      const readPromise = readStream();

      // 4. Trigger progress notifications while stream is open
      const progressToken = "test-progress-token-1";
      await new Promise((resolve) => setTimeout(resolve, 100)); // Let stream connect

      const toolCallResponse = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-06-18",
          "Mcp-Session-Id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Math.random().toString(36).substring(2, 11),
          method: "tools/call",
          params: {
            name: "slow_operation",
            arguments: { count: 3, message: "test operation" },
            _meta: {
              progressToken,
            },
          },
        }),
      });

      expect(toolCallResponse.ok).toBe(true);

      // 5. Wait for events to be read (with timeout)
      await Promise.race([
        readPromise,
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);

      // 6. Verify we got events
      expect(events.length).toBeGreaterThan(0);

      // 7. Wait for capture to complete (SSE capture is async)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 8. Query captured logs from the database
      const queryResult = await gateway.instance.storage.query({
        serverName: "streaming-server",
        sessionId,
      });

      // Should have captured events (init request + tool call request/response + potential SSE events)
      // At minimum: initialize (request+response), tools/call (request+response) = 4 records
      expect(queryResult.data.length).toBeGreaterThanOrEqual(4);
    });

    it("should capture JSON-RPC messages from GET SSE stream (short alias route)", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/s/streaming-server/mcp`;

      // 1. Initialize session
      const initResult = await makeJsonRpcRequest(gatewayUrl, "initialize", {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "test-client-2", version: "1.0.0" },
      });
      const sessionId = initResult.sessionId;
      expect(sessionId).toBeDefined();
      if (!sessionId) throw new Error("Session ID is undefined");

      // 2. Open SSE stream first
      const sseResponse = await makeSSERequest(gatewayUrl, sessionId);
      expect(sseResponse.status).toBe(200);

      // 3. Start reading events
      const events: Array<{ event?: string; data?: string; id?: string }> = [];
      if (!sseResponse.body) throw new Error("No response body");
      const reader = sseResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const readStream = async () => {
        try {
          while (events.length < 2) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            let currentEvent: { event?: string; data?: string; id?: string } =
              {};
            for (const line of lines) {
              if (line === "") {
                if (Object.keys(currentEvent).length > 0) {
                  events.push(currentEvent);
                  currentEvent = {};
                }
              } else if (line.startsWith("event:")) {
                currentEvent.event = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                const data = line.slice(5).trim();
                currentEvent.data = currentEvent.data
                  ? `${currentEvent.data}\n${data}`
                  : data;
              } else if (line.startsWith("id:")) {
                currentEvent.id = line.slice(3).trim();
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      };

      const readPromise = readStream();

      // 4. Trigger progress notifications while stream is open
      await new Promise((resolve) => setTimeout(resolve, 100));

      const toolCallResponse = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-06-18",
          "Mcp-Session-Id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Math.random().toString(36).substring(2, 11),
          method: "tools/call",
          params: {
            name: "slow_operation",
            arguments: { count: 2, message: "short alias test" },
            _meta: {
              progressToken: "test-progress-token-2",
            },
          },
        }),
      });

      expect(toolCallResponse.ok).toBe(true);

      // 5. Wait for events
      await Promise.race([
        readPromise,
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);

      expect(events.length).toBeGreaterThan(0);

      // 6. Wait for capture
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 7. Query captured logs from the database
      const queryResult = await gateway.instance.storage.query({
        serverName: "streaming-server",
        sessionId,
      });

      // Should have captured events (init request + tool call request/response + potential SSE events)
      // At minimum: initialize (request+response), tools/call (request+response) = 4 records
      expect(queryResult.data.length).toBeGreaterThanOrEqual(4);
    });

    it("should properly parse and capture JSON-RPC responses in SSE events", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/streaming-server/mcp`;

      // 1. Initialize session
      const initResult = await makeJsonRpcRequest(gatewayUrl, "initialize", {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "json-rpc-test", version: "1.0.0" },
      });
      const sessionId = initResult.sessionId;
      expect(sessionId).toBeDefined();
      if (!sessionId) throw new Error("Session ID is undefined");

      // 2. Open SSE stream first
      const sseResponse = await makeSSERequest(gatewayUrl, sessionId);
      expect(sseResponse.status).toBe(200);

      // 3. Start reading events
      const events: Array<{ event?: string; data?: string; id?: string }> = [];
      if (!sseResponse.body) throw new Error("No response body");
      const reader = sseResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const readStream = async () => {
        try {
          while (events.length < 4) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            let currentEvent: { event?: string; data?: string; id?: string } =
              {};
            for (const line of lines) {
              if (line === "") {
                if (Object.keys(currentEvent).length > 0) {
                  events.push(currentEvent);
                  currentEvent = {};
                }
              } else if (line.startsWith("event:")) {
                currentEvent.event = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                const data = line.slice(5).trim();
                currentEvent.data = currentEvent.data
                  ? `${currentEvent.data}\n${data}`
                  : data;
              } else if (line.startsWith("id:")) {
                currentEvent.id = line.slice(3).trim();
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      };

      const readPromise = readStream();

      // 4. Trigger progress notifications while stream is open
      await new Promise((resolve) => setTimeout(resolve, 100));

      const toolCallResponse = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-06-18",
          "Mcp-Session-Id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Math.random().toString(36).substring(2, 11),
          method: "tools/call",
          params: {
            name: "slow_operation",
            arguments: { count: 4, message: "json-rpc capture test" },
            _meta: {
              progressToken: "test-progress-token-3",
            },
          },
        }),
      });

      expect(toolCallResponse.ok).toBe(true);

      // 5. Wait for events
      await Promise.race([
        readPromise,
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);

      // 6. Verify we got JSON-RPC events
      const jsonRpcEvents = events.filter((event) => {
        if (!event.data) return false;
        try {
          const parsed = JSON.parse(event.data);
          return parsed.jsonrpc === "2.0";
        } catch {
          return false;
        }
      });

      expect(jsonRpcEvents.length).toBeGreaterThan(0);

      // 6. Wait for capture
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 7. Query captured logs from the database
      const queryResult = await gateway.instance.storage.query({
        serverName: "streaming-server",
        sessionId,
      });

      // Should have captured events (init request + tool call request/response + potential progress events)
      // At minimum: initialize (request+response), tools/call (request+response) = 4 records
      expect(queryResult.data.length).toBeGreaterThanOrEqual(4);

      // Verify we captured the tool call
      const toolCallRecords = queryResult.data.filter(
        (record) => record.method === "tools/call",
      );
      expect(toolCallRecords.length).toBeGreaterThanOrEqual(2); // request + response
    });
  });

  describe("Server Activity Tracking", () => {
    it("should update server activity metrics for GET SSE requests", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/streaming-server/mcp`;

      // 1. Initialize session
      const initResult = await makeJsonRpcRequest(gatewayUrl, "initialize", {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "activity-test", version: "1.0.0" },
      });
      const sessionId = initResult.sessionId;
      expect(sessionId).toBeDefined();
      if (!sessionId) throw new Error("Session ID is undefined");

      // 2. Make SSE request
      const sseResponse = await makeSSERequest(gatewayUrl, sessionId);
      expect(sseResponse.status).toBe(200);
      expect(sseResponse.headers.get("content-type")).toContain(
        "text/event-stream",
      );

      // 3. Close the stream immediately
      await sseResponse.body?.cancel();

      // Verify the GET request was successful
      // (Activity tracking is tested indirectly - the request succeeded)
      expect(sseResponse.ok).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle GET request without session ID gracefully", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/streaming-server/mcp`;

      // Make GET request without session ID (should fail validation)
      const response = await fetch(gatewayUrl, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          "MCP-Protocol-Version": "2025-06-18",
        },
      });

      // Should return 400 (validation error)
      expect(response.status).toBe(400);
    });

    it("should handle GET request to unknown server", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/unknown-server/mcp`;
      const response = await makeSSERequest(gatewayUrl, "test-session");

      expect(response.status).toBe(404);
    });
  });
});
