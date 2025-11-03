/** biome-ignore-all lint/suspicious/noConsole: tests */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  sessionIds: Set<string>;
}

// Create test MCP server with session tracking
function createTestMcpServer(name: string, port: number): TestServer {
  const sessionIds = new Set<string>();

  const mcp = new McpServerLib({
    name,
    version: "1.0.0",
  });

  // Add test tools
  mcp.tool("ping", {
    description: "Simple ping tool",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: () => ({
      content: [{ type: "text", text: "pong" }],
    }),
  });

  // Configure transport with session adapter to support GET and DELETE
  const transport = new StreamableHttpTransport({
    sessionAdapter: new InMemorySessionAdapter({
      maxEventBufferSize: 1024,
    }),
  });
  const handler = transport.bind(mcp);

  // Wrap handler to track sessions for testing
  const wrappedHandler = async (req: Request) => {
    const sessionId = req.headers.get("Mcp-Session-Id");

    // Track session additions and deletions
    if (req.method === "DELETE" && sessionId) {
      sessionIds.delete(sessionId);
    } else if (sessionId) {
      sessionIds.add(sessionId);
    }

    return handler(req);
  };

  // Start HTTP server
  const server = Bun.serve({
    port,
    fetch: wrappedHandler,
  });

  return {
    url: `http://localhost:${port}`,
    port,
    sessionIds,
    stop: async () => {
      server.stop();
    },
  };
}

// Helper to make JSON-RPC requests via POST
async function makeJsonRpcRequest(
  url: string,
  method: string,
  params?: unknown,
  sessionId?: string,
): Promise<unknown> {
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

  return response.json();
}

// Helper to make DELETE request
async function makeDeleteRequest(
  url: string,
  sessionId?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    "MCP-Protocol-Version": "2025-06-18",
  };

  if (sessionId) {
    headers["Mcp-Session-Id"] = sessionId;
  }

  return fetch(url, {
    method: "DELETE",
    headers,
  });
}

describe("DELETE /mcp Session Termination Tests", () => {
  let testServers: TestServer[] = [];
  let storageDir: string;
  let gateway: { port: number; stop: () => void };

  beforeAll(async () => {
    // Create temp directory for storage
    storageDir = await mkdtemp(join(tmpdir(), "mcp-gateway-delete-test-"));

    // Create test MCP servers
    testServers = [
      createTestMcpServer("delete-server1", 8201),
      createTestMcpServer("delete-server2", 8202),
    ];

    // Create test servers
    const servers: McpServer[] = [
      {
        name: "delete-server1",
        type: "http" as const,
        url: testServers[0]?.url || "",
        headers: {},
        lastActivity: null,
        exchangeCount: 0,
      },
      {
        name: "delete-server2",
        type: "http" as const,
        url: testServers[1]?.url || "",
        headers: {},
        lastActivity: null,
        exchangeCount: 0,
      },
    ];

    // Save registry to storage
    await saveRegistry(storageDir, servers);

    // Create and start gateway app
    const { app } = await createApp(servers, storageDir);
    const server = Bun.serve({
      port: 8210,
      fetch: app.fetch,
    });

    gateway = {
      port: 8210,
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

    // Clean up temp directory
    try {
      await rm(storageDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("Failed to clean up temp directory:", error);
    }
  });

  describe("DELETE Proxy Routing", () => {
    it("should proxy DELETE request to delete-server1 (canonical)", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/delete-server1/mcp`;
      const sessionId = "delete-test-1";

      // First, create a session by making a request
      await makeJsonRpcRequest(
        gatewayUrl,
        "tools/call",
        { name: "ping", arguments: {} },
        sessionId,
      );

      // Then delete the session
      const response = await makeDeleteRequest(gatewayUrl, sessionId);

      // mcp-lite returns 200 for successful DELETE
      expect(response.status).toBe(200);
    });

    it("should proxy DELETE request to delete-server2 (canonical)", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/delete-server2/mcp`;
      const sessionId = "delete-test-2";

      // First, create a session
      await makeJsonRpcRequest(
        gatewayUrl,
        "tools/call",
        { name: "ping", arguments: {} },
        sessionId,
      );

      // Then delete the session
      const response = await makeDeleteRequest(gatewayUrl, sessionId);

      // mcp-lite returns 200 for successful DELETE
      expect(response.status).toBe(200);
    });

    it("should proxy DELETE request via short alias", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/s/delete-server1/mcp`;
      const sessionId = "delete-test-alias";

      // First, create a session
      await makeJsonRpcRequest(
        gatewayUrl,
        "tools/call",
        { name: "ping", arguments: {} },
        sessionId,
      );

      // Then delete via alias
      const response = await makeDeleteRequest(gatewayUrl, sessionId);

      // mcp-lite returns 200 for successful DELETE
      expect(response.status).toBe(200);
    });

    it("should return 404 for unknown server", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/unknown-delete-server/mcp`;

      const response = await makeDeleteRequest(gatewayUrl, "test-session");

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE Session Handling", () => {
    it("should handle DELETE with session ID", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/delete-server1/mcp`;
      const sessionId = "explicit-session-delete";

      // Create session
      await makeJsonRpcRequest(
        gatewayUrl,
        "tools/call",
        { name: "ping", arguments: {} },
        sessionId,
      );

      // Delete with session ID
      const response = await makeDeleteRequest(gatewayUrl, sessionId);

      // mcp-lite returns 200 for successful DELETE
      expect(response.status).toBe(200);
    });

    it("should handle DELETE without session ID", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/delete-server1/mcp`;

      // Delete without session ID (stateless)
      const response = await makeDeleteRequest(gatewayUrl);

      // mcp-lite returns 400 for DELETE without session
      expect(response.status).toBe(400);
    });

    it("should forward session header to downstream server", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/delete-server1/mcp`;
      const sessionId = "forward-header-test";
      const testServer = testServers[0];

      if (!testServer) {
        throw new Error("Test server not found");
      }

      // Create session
      await makeJsonRpcRequest(
        gatewayUrl,
        "tools/call",
        { name: "ping", arguments: {} },
        sessionId,
      );

      // Verify session exists on server
      expect(testServer.sessionIds.has(sessionId)).toBe(true);

      // Delete session
      const response = await makeDeleteRequest(gatewayUrl, sessionId);

      // mcp-lite returns 200 for successful DELETE
      expect(response.status).toBe(200);

      // Verify session was removed from server
      expect(testServer.sessionIds.has(sessionId)).toBe(false);
    });
  });

  describe("DELETE Method Verification", () => {
    it("should use DELETE HTTP method", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/delete-server1/mcp`;
      const sessionId = "method-verify-test";

      // Create session
      await makeJsonRpcRequest(
        gatewayUrl,
        "tools/call",
        { name: "ping", arguments: {} },
        sessionId,
      );

      // Make DELETE request
      const response = await fetch(gatewayUrl, {
        method: "DELETE",
        headers: {
          "MCP-Protocol-Version": "2025-06-18",
          "Mcp-Session-Id": sessionId,
        },
      });

      // mcp-lite returns 200 for successful DELETE
      expect(response.status).toBe(200);
    });

    it("should forward MCP-Protocol-Version header", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/delete-server1/mcp`;
      const sessionId = "protocol-header-test";

      // Create session
      await makeJsonRpcRequest(
        gatewayUrl,
        "tools/call",
        { name: "ping", arguments: {} },
        sessionId,
      );

      // Delete with protocol version
      const response = await fetch(gatewayUrl, {
        method: "DELETE",
        headers: {
          "MCP-Protocol-Version": "2025-06-18",
          "Mcp-Session-Id": sessionId,
        },
      });

      // mcp-lite returns 200 for successful DELETE
      expect(response.status).toBe(200);
    });

    it("should not include request body", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/delete-server1/mcp`;
      const sessionId = "no-body-test";

      // Create session
      await makeJsonRpcRequest(
        gatewayUrl,
        "tools/call",
        { name: "ping", arguments: {} },
        sessionId,
      );

      // DELETE should not have body
      const response = await makeDeleteRequest(gatewayUrl, sessionId);

      // mcp-lite returns 200 for successful DELETE
      expect(response.status).toBe(200);

      // Response should have no body (or empty body)
      const text = await response.text();
      expect(text).toBe("");
    });
  });

  describe("DELETE Multiple Sessions", () => {
    it("should handle multiple session deletions independently", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/delete-server1/mcp`;
      const sessions = ["multi-1", "multi-2", "multi-3"];

      // Create multiple sessions
      for (const sessionId of sessions) {
        await makeJsonRpcRequest(
          gatewayUrl,
          "tools/call",
          { name: "ping", arguments: {} },
          sessionId,
        );
      }

      // Delete sessions one by one
      for (const sessionId of sessions) {
        const response = await makeDeleteRequest(gatewayUrl, sessionId);
        // mcp-lite returns 200 for successful DELETE
        expect(response.status).toBe(200);
      }
    });

    it("should handle deleting same session twice gracefully", async () => {
      const gatewayUrl = `http://localhost:${gateway.port}/servers/delete-server1/mcp`;
      const sessionId = "double-delete-test";

      // Create session
      await makeJsonRpcRequest(
        gatewayUrl,
        "tools/call",
        { name: "ping", arguments: {} },
        sessionId,
      );

      // First delete
      const response1 = await makeDeleteRequest(gatewayUrl, sessionId);
      // mcp-lite returns 200 for successful DELETE
      expect(response1.status).toBe(200);

      // Second delete (session already gone)
      const response2 = await makeDeleteRequest(gatewayUrl, sessionId);
      // mcp-lite returns 200 (idempotent) even for already-deleted sessions
      expect(response2.status).toBe(200);
    });
  });

  describe("DELETE Different Servers", () => {
    it("should route DELETE to correct server", async () => {
      const server1Url = `http://localhost:${gateway.port}/servers/delete-server1/mcp`;
      const server2Url = `http://localhost:${gateway.port}/servers/delete-server2/mcp`;
      const sessionId = "cross-server-test";

      // Create session on server1
      await makeJsonRpcRequest(
        server1Url,
        "tools/call",
        { name: "ping", arguments: {} },
        sessionId,
      );

      // Create session on server2
      await makeJsonRpcRequest(
        server2Url,
        "tools/call",
        { name: "ping", arguments: {} },
        sessionId,
      );

      // Delete from server1
      const response1 = await makeDeleteRequest(server1Url, sessionId);
      // mcp-lite returns 200 for successful DELETE
      expect(response1.status).toBe(200);

      // Delete from server2
      const response2 = await makeDeleteRequest(server2Url, sessionId);
      // mcp-lite returns 200 for successful DELETE
      expect(response2.status).toBe(200);
    });
  });
});
