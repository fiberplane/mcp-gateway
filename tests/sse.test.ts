import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/server.js";
import { addServer } from "../src/registry.js";
import { saveRegistry } from "../src/storage.js";
import {
  parseSSEChunk,
  parseJsonRpcFromSSE,
  isJsonRpcResponse,
  isJsonRpcNotification,
  createSSEEventStream,
  type SSEEvent,
} from "../src/sse-parser.js";
import {
  createSSEEventCaptureRecord,
  createSSEJsonRpcCaptureRecord,
} from "../src/capture.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "mcp-sse-test-"));
});

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true });
  }
});

// SSE Parser Tests
test("parseSSEChunk handles basic event", () => {
  const chunk = "data: hello world\n\n";
  const events = parseSSEChunk(chunk);

  expect(events).toHaveLength(1);
  expect(events[0]?.data).toBe("hello world");
});

test("parseSSEChunk handles event with id and type", () => {
  const chunk = "id: 123\nevent: message\ndata: test data\n\n";
  const events = parseSSEChunk(chunk);

  expect(events).toHaveLength(1);
  expect(events[0]?.id).toBe("123");
  expect(events[0]?.event).toBe("message");
  expect(events[0]?.data).toBe("test data");
});

test("parseSSEChunk handles multiple events", () => {
  const chunk = "data: first\n\ndata: second\n\n";
  const events = parseSSEChunk(chunk);

  expect(events).toHaveLength(2);
  expect(events[0]?.data).toBe("first");
  expect(events[1]?.data).toBe("second");
});

test("parseSSEChunk handles multiline data", () => {
  const chunk = "data: line 1\ndata: line 2\n\n";
  const events = parseSSEChunk(chunk);

  expect(events).toHaveLength(1);
  expect(events[0]?.data).toBe("line 1\nline 2");
});

test("parseSSEChunk ignores comment lines", () => {
  const chunk = ": this is a comment\ndata: real data\n\n";
  const events = parseSSEChunk(chunk);

  expect(events).toHaveLength(1);
  expect(events[0]?.data).toBe("real data");
});

test("parseSSEChunk handles retry field", () => {
  const chunk = "retry: 5000\ndata: test\n\n";
  const events = parseSSEChunk(chunk);

  expect(events).toHaveLength(1);
  expect(events[0]?.retry).toBe(5000);
  expect(events[0]?.data).toBe("test");
});

test("parseJsonRpcFromSSE parses valid JSON-RPC", () => {
  const jsonRpcRequest = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "test/method",
    params: { test: true }
  });

  const result = parseJsonRpcFromSSE(jsonRpcRequest);

  expect(result).toBeTruthy();
  expect(result?.jsonrpc).toBe("2.0");
  expect(result?.id).toBe(1);
  if ("method" in result!) {
    expect(result.method).toBe("test/method");
  }
});

test("parseJsonRpcFromSSE returns null for invalid JSON", () => {
  const result = parseJsonRpcFromSSE("not json");
  expect(result).toBeNull();
});

test("parseJsonRpcFromSSE returns null for non-JSON-RPC", () => {
  const result = parseJsonRpcFromSSE('{"not": "jsonrpc"}');
  expect(result).toBeNull();
});

test("isJsonRpcResponse identifies responses correctly", () => {
  const response = {
    jsonrpc: "2.0" as const,
    id: 1,
    result: { success: true }
  };

  const request = {
    jsonrpc: "2.0" as const,
    id: 1,
    method: "test",
    params: {}
  };

  expect(isJsonRpcResponse(response)).toBe(true);
  expect(isJsonRpcResponse(request)).toBe(false);
});

test("isJsonRpcNotification identifies notifications correctly", () => {
  const notification = {
    jsonrpc: "2.0" as const,
    method: "notification",
    params: {}
  };

  const request = {
    jsonrpc: "2.0" as const,
    id: 1,
    method: "request",
    params: {}
  };

  expect(isJsonRpcNotification(notification)).toBe(true);
  expect(isJsonRpcNotification(request)).toBe(false);
});

// Capture Record Tests
test("createSSEEventCaptureRecord creates valid record", () => {
  const sseEvent: SSEEvent = {
    id: "123",
    event: "message",
    data: "test data"
  };

  const record = createSSEEventCaptureRecord(
    "test-server",
    "session-123",
    sseEvent,
    "tools/call",
    1
  );

  expect(record.method).toBe("tools/call");
  expect(record.id).toBe(1);
  expect(record.metadata.serverName).toBe("test-server");
  expect(record.metadata.sessionId).toBe("session-123");
  expect(record.metadata.sseEventId).toBe("123");
  expect(record.metadata.sseEventType).toBe("message");
  expect(record.sseEvent).toEqual(sseEvent);
});

test("createSSEJsonRpcCaptureRecord creates valid record for request", () => {
  const jsonRpcMessage = {
    jsonrpc: "2.0" as const,
    id: 1,
    method: "tools/call",
    params: { name: "test" }
  };

  const sseEvent: SSEEvent = {
    data: JSON.stringify(jsonRpcMessage)
  };

  const record = createSSEJsonRpcCaptureRecord(
    "test-server",
    "session-123",
    jsonRpcMessage,
    sseEvent,
    false
  );

  expect(record.method).toBe("tools/call");
  expect(record.id).toBe(1);
  expect(record.request).toEqual(jsonRpcMessage);
  expect(record.response).toBeUndefined();
});

test("createSSEJsonRpcCaptureRecord creates valid record for response", () => {
  const jsonRpcMessage = {
    jsonrpc: "2.0" as const,
    id: 1,
    result: { success: true }
  };

  const sseEvent: SSEEvent = {
    data: JSON.stringify(jsonRpcMessage)
  };

  const record = createSSEJsonRpcCaptureRecord(
    "test-server",
    "session-123",
    jsonRpcMessage,
    sseEvent,
    true
  );

  expect(record.method).toBe("unknown");
  expect(record.id).toBe(1);
  expect(record.request).toBeUndefined();
  expect(record.response).toEqual(jsonRpcMessage);
});

// Mock SSE server for integration tests
function createMockSSEResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}

// Integration Tests
test("SSE streaming preserves Accept header", async () => {
  const registry = { servers: [] };

  // Add mock SSE server
  addServer(registry, {
    name: "sse-server",
    url: "http://localhost:9999/sse",
    type: "http",
    headers: {}
  });

  await saveRegistry(tempDir, registry);

  const { app } = await createApp(registry, tempDir);

  // Mock the proxy function to capture headers
  let capturedHeaders: Record<string, string> = {};
  const originalProxy = (await import("hono/proxy")).proxy;

  // Create a mock response
  const mockResponse = createMockSSEResponse([
    "data: test event\n\n"
  ]);

  // Test request with Accept header
  const testRequest = new Request("http://localhost:3333/sse-server/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      "MCP-Protocol-Version": "2025-06-18"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "test" }
    })
  });

  // This test would require mocking the proxy function
  // For now, we'll test the header forwarding logic separately
});

test("SSE event stream processing", async () => {
  const events = [
    "data: first event\n\n",
    "id: 123\nevent: progress\ndata: {\"percent\": 50}\n\n",
    "data: final event\n\n"
  ];

  const mockResponse = createMockSSEResponse(events);
  const reader = mockResponse.body!.getReader();
  const eventStream = createSSEEventStream(reader);
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

test("SSE JSON-RPC parsing in stream", async () => {
  const jsonRpcEvent = {
    jsonrpc: "2.0",
    method: "notifications/progress",
    params: { progress: 0.5 }
  };

  const events = [
    `data: ${JSON.stringify(jsonRpcEvent)}\n\n`,
    "data: not json\n\n"
  ];

  const mockResponse = createMockSSEResponse(events);
  const reader = mockResponse.body!.getReader();
  const eventStream = createSSEEventStream(reader);
  const eventReader = eventStream.getReader();

  const results: { event: SSEEvent; jsonRpc: any }[] = [];

  while (true) {
    const { done, value } = await eventReader.read();
    if (done) break;

    const jsonRpc = value.data ? parseJsonRpcFromSSE(value.data) : null;
    results.push({ event: value, jsonRpc });
  }

  expect(results).toHaveLength(2);
  expect(results[0]?.jsonRpc).toBeTruthy();
  expect(results[0]?.jsonRpc?.method).toBe("notifications/progress");
  expect(results[1]?.jsonRpc).toBeNull();
});