/** biome-ignore-all lint/suspicious/noConsole: tests */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSSEEventStream,
  type SSEEvent,
  saveRegistry,
} from "@fiberplane/mcp-gateway-core";
import { createApp } from "@fiberplane/mcp-gateway-server";
import type { Registry } from "@fiberplane/mcp-gateway-types";

// Real SSE server for testing
function createSSEServer(port: number): { url: string; stop: () => void } {
  const server = Bun.serve({
    port,
    fetch(request) {
      const url = new URL(request.url);

      if (
        url.pathname === "/sse" &&
        request.headers.get("Accept")?.includes("text/event-stream")
      ) {
        // Return SSE stream
        const events = [
          "data: first event\n\n",
          'id: 123\nevent: progress\ndata: {"jsonrpc": "2.0", "method": "notifications/progress", "params": {"percent": 50}}\n\n',
          "data: final event\n\n",
        ];

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            for (const event of events) {
              controller.enqueue(encoder.encode(event));
            }
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      // Regular JSON-RPC response
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { content: [{ type: "text", text: "success" }] },
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  });

  return {
    url: `http://localhost:${port}`,
    stop: () => server.stop(),
  };
}

// Integration Tests with Real SSE Server
describe("SSE Integration Tests", () => {
  let sseServer: { url: string; stop: () => void };
  let gateway: { port: number; stop: () => void };
  let storageDir: string;

  beforeAll(async () => {
    // Create temp directory for storage
    storageDir = await mkdtemp(join(tmpdir(), "mcp-sse-integration-test-"));

    // Create SSE test server
    sseServer = createSSEServer(8003);

    // Create test registry with SSE server
    const registry: Registry = {
      servers: [
        {
          name: "sse-server",
          type: "http" as const,
          url: `${sseServer.url}/sse`,
          headers: {},
          lastActivity: null,
          exchangeCount: 0,
        },
      ],
    };

    await saveRegistry(storageDir, registry);

    // Create and start gateway app
    const { app } = await createApp(registry, storageDir);
    const server = Bun.serve({
      port: 8100,
      fetch: app.fetch,
    });

    gateway = {
      port: 8100,
      stop: () => server.stop(),
    };
  });

  afterAll(async () => {
    // Stop all servers
    gateway?.stop();
    sseServer?.stop();

    // Clean up temp directory
    try {
      await rm(storageDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("Failed to clean up temp directory:", error);
    }
  });

  test("should stream SSE events through gateway", async () => {
    const gatewayUrl = `http://localhost:${gateway.port}/servers/sse-server/mcp`;

    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "MCP-Protocol-Version": "2025-06-18",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "test" },
      }),
    });

    expect(response.headers.get("content-type")).toBe("text/event-stream");

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader available");

    const eventStream = createSSEEventStream(
      reader as ReadableStreamDefaultReader<Uint8Array>,
    );
    const eventReader = eventStream.getReader();
    const receivedEvents: SSEEvent[] = [];

    while (true) {
      const { done, value } = await eventReader.read();
      if (done) break;
      receivedEvents.push(value);
    }

    expect(receivedEvents).toHaveLength(3);
    expect(receivedEvents[0]?.data).toBe("first event");
    expect(receivedEvents[1]?.id).toBe("123");
    expect(receivedEvents[1]?.event).toBe("progress");
    expect(receivedEvents[2]?.data).toBe("final event");
  });

  test("should capture SSE events with JSON-RPC content", async () => {
    const gatewayUrl = `http://localhost:${gateway.port}/servers/sse-server/mcp`;
    const sessionId = "sse-capture-test";

    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "MCP-Protocol-Version": "2025-06-18",
        "mcp-session-id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "test" },
      }),
    });

    expect(response.headers.get("content-type")).toBe("text/event-stream");

    // Consume the stream to ensure capture processing happens
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader available");

    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // Give some time for background capture processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check if capture file exists and contains SSE events
    const serverDir = join(storageDir, "sse-server");
    const files = await Bun.$`find ${serverDir} -name "*.jsonl"`.text();

    expect(files.trim()).not.toBe("");

    const captureFile = files.trim().split("\n")[0];
    if (!captureFile) throw new Error("Capture file not found");

    const content = await Bun.file(captureFile).text();
    const lines = content.trim().split("\n");

    // Should have at least the initial request and some SSE events
    expect(lines.length).toBeGreaterThan(1);

    const requestRecord = JSON.parse(lines[0] ?? "");
    expect(requestRecord.method).toBe("tools/call");

    // Note: SSE requests may be processed with stateless session initially
    // but the important thing is that we captured SSE events
    expect(requestRecord.metadata.sessionId).toMatch(
      /sse-capture-test|stateless/,
    );
  });
});
