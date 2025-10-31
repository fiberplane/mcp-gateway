/** biome-ignore-all lint/suspicious/noConsole: tests */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { McpServer } from "@fiberplane/mcp-gateway-types";
import { McpServer as McpServerLib, StreamableHttpTransport } from "mcp-lite";
import { createApp, saveRegistry } from "../helpers/test-app.js";

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
  let gateway: { port: number; stop: () => void };

  beforeAll(async () => {
    // Create temp directory for storage
    storageDir = await mkdtemp(join(tmpdir(), "mcp-gateway-test-"));

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

    // Save registry to storage
    await saveRegistry(storageDir, servers);

    // Create and start gateway app
    const { app } = await createApp(servers, storageDir);
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

  describe("Authentication Handling", () => {
    it("should forward 401 responses with auth headers", async () => {
      // Create a mock server that returns 401 for unauthorized requests
      const authServerPort = 8203;
      const authServer = Bun.serve({
        port: authServerPort,
        fetch(request) {
          // Check for authorization header
          const authHeader = request.headers.get("Authorization");

          if (!authHeader || authHeader !== "Bearer valid-token") {
            // Return 401 with WWW-Authenticate header and auth info in body
            return new Response(
              JSON.stringify({
                error: "Authentication required",
                auth_url: "https://auth.example.com/login",
                message: "Please authenticate to access this resource",
              }),
              {
                status: 401,
                headers: {
                  "Content-Type": "application/json",
                  "WWW-Authenticate": 'Bearer realm="mcp-server"',
                  "X-Auth-Provider": "test-provider",
                },
              },
            );
          }

          // Return success for authorized requests
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              result: { content: [{ type: "text", text: "authorized" }] },
            }),
            {
              headers: { "Content-Type": "application/json" },
            },
          );
        },
      });

      try {
        // Add auth server to registry
        const authServers: McpServer[] = [
          {
            name: "auth-server",
            type: "http" as const,
            url: `http://localhost:${authServerPort}/mcp`,
            headers: {},
            lastActivity: null,
            exchangeCount: 0,
          },
        ];

        await saveRegistry(storageDir, authServers);

        // Create gateway with auth server
        const { app } = await createApp(authServers, storageDir);
        const authGateway = Bun.serve({
          port: 8204,
          fetch: app.fetch,
        });

        try {
          // Test 1: Unauthorized request should return 401 with all headers
          const unauthorizedResponse = await fetch(
            `http://localhost:8204/servers/auth-server/mcp`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "MCP-Protocol-Version": "2025-06-18",
              },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "tools/call",
                params: { name: "test" },
              }),
            },
          );

          // Should return 401
          expect(unauthorizedResponse.status).toBe(401);

          // Should preserve WWW-Authenticate header
          expect(unauthorizedResponse.headers.get("WWW-Authenticate")).toBe(
            'Bearer realm="mcp-server"',
          );

          // Should preserve custom auth header
          expect(unauthorizedResponse.headers.get("X-Auth-Provider")).toBe(
            "test-provider",
          );

          // Should preserve response body with auth info
          // biome-ignore lint/suspicious/noExplicitAny: tests
          const unauthorizedBody: any = await unauthorizedResponse.json();
          expect(unauthorizedBody.error).toBe("Authentication required");
          expect(unauthorizedBody.auth_url).toBe(
            "https://auth.example.com/login",
          );

          // Test 2: Authorized request should succeed
          const authorizedResponse = await fetch(
            `http://localhost:8204/servers/auth-server/mcp`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "MCP-Protocol-Version": "2025-06-18",
                Authorization: "Bearer valid-token",
              },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/call",
                params: { name: "test" },
              }),
            },
          );

          expect(authorizedResponse.status).toBe(200);
          const authorizedBody =
            (await authorizedResponse.json()) as JsonRpcResponse;
          expect(authorizedBody.result).toBeDefined();
        } finally {
          authGateway.stop();
        }
      } finally {
        authServer.stop();
      }
    });

    it("should forward 401 responses via short alias route", async () => {
      // Create a mock server that returns 401
      const authServerPort = 8205;
      const authServer = Bun.serve({
        port: authServerPort,
        fetch(_request) {
          return new Response(
            JSON.stringify({
              error: "Unauthorized",
            }),
            {
              status: 401,
              headers: {
                "Content-Type": "application/json",
                "WWW-Authenticate": 'Bearer realm="test"',
              },
            },
          );
        },
      });

      try {
        const authServers: McpServer[] = [
          {
            name: "auth-server-2",
            type: "http" as const,
            url: `http://localhost:${authServerPort}/mcp`,
            headers: {},
            lastActivity: null,
            exchangeCount: 0,
          },
        ];

        await saveRegistry(storageDir, authServers);

        const { app } = await createApp(authServers, storageDir);
        const authGateway = Bun.serve({
          port: 8206,
          fetch: app.fetch,
        });

        try {
          // Test via short alias /s/:server/mcp
          const response = await fetch(
            `http://localhost:8206/s/auth-server-2/mcp`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "MCP-Protocol-Version": "2025-06-18",
              },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "test",
                params: {},
              }),
            },
          );

          expect(response.status).toBe(401);
          expect(response.headers.get("WWW-Authenticate")).toBe(
            'Bearer realm="test"',
          );
        } finally {
          authGateway.stop();
        }
      } finally {
        authServer.stop();
      }
    });
  });
});
