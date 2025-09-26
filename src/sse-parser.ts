import type { JsonRpcRequest, JsonRpcResponse } from "./schemas.js";

export interface SSEEvent {
  id?: string;
  event?: string;
  data?: string;
  retry?: number;
}

/**
 * Parses a chunk of SSE data into individual events
 * @param chunk - Raw SSE chunk string
 * @returns Array of parsed SSE events
 */
export function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = chunk.split("\n");
  let currentEvent: SSEEvent = {};
  let hasData = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Empty line indicates end of event
    if (trimmedLine === "") {
      if (hasData && currentEvent.data !== undefined) {
        events.push(currentEvent);
      }
      currentEvent = {};
      hasData = false;
      continue;
    }

    // Skip comment lines
    if (trimmedLine.startsWith(":")) {
      continue;
    }

    // Parse field:value pairs
    const colonIndex = trimmedLine.indexOf(":");
    if (colonIndex === -1) {
      // Treat line without colon as field with empty value
      const field = trimmedLine;
      if (field === "data") {
        currentEvent.data = (currentEvent.data || "") + "\n";
        hasData = true;
      }
      continue;
    }

    const field = trimmedLine.substring(0, colonIndex);
    const value = trimmedLine.substring(colonIndex + 1).replace(/^ /, ""); // Remove single leading space

    switch (field) {
      case "id":
        currentEvent.id = value;
        break;
      case "event":
        currentEvent.event = value;
        break;
      case "data":
        currentEvent.data = (currentEvent.data || "") + (currentEvent.data ? "\n" : "") + value;
        hasData = true;
        break;
      case "retry":
        const retryValue = parseInt(value, 10);
        if (!isNaN(retryValue)) {
          currentEvent.retry = retryValue;
        }
        break;
    }
  }

  // Handle event at end of chunk without trailing newline
  if (hasData && currentEvent.data !== undefined) {
    events.push(currentEvent);
  }

  return events;
}

/**
 * Attempts to parse SSE data as JSON-RPC message
 * @param data - SSE data field content
 * @returns Parsed JSON-RPC message or null if not valid JSON-RPC
 */
export function parseJsonRpcFromSSE(data: string): JsonRpcRequest | JsonRpcResponse | null {
  try {
    const parsed = JSON.parse(data);

    // Check if it looks like JSON-RPC (has jsonrpc field)
    if (parsed && typeof parsed === "object" && parsed.jsonrpc === "2.0") {
      return parsed as JsonRpcRequest | JsonRpcResponse;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Determines if a JSON-RPC message is a response (has id and result/error)
 * @param message - JSON-RPC message
 * @returns True if message is a response
 */
export function isJsonRpcResponse(message: JsonRpcRequest | JsonRpcResponse): message is JsonRpcResponse {
  return "result" in message || "error" in message;
}

/**
 * Determines if a JSON-RPC message is a notification (no id)
 * @param message - JSON-RPC message
 * @returns True if message is a notification
 */
export function isJsonRpcNotification(message: JsonRpcRequest | JsonRpcResponse): boolean {
  return message.id === null || message.id === undefined;
}

/**
 * Creates a readable stream that processes SSE chunks and yields events
 * @param reader - ReadableStreamDefaultReader from the response body
 * @returns ReadableStream of SSE events
 */
export function createSSEEventStream(reader: any): ReadableStream<SSEEvent> {
  let buffer = "";
  const decoder = new TextDecoder();

  return new ReadableStream<SSEEvent>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            const events = parseSSEChunk(buffer);
            for (const event of events) {
              controller.enqueue(event);
            }
          }
          controller.close();
          return;
        }

        // Add new chunk to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete events (those ending with double newline)
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || ""; // Keep the last incomplete part

        for (const part of parts) {
          if (part.trim()) {
            const events = parseSSEChunk(part + "\n\n");
            for (const event of events) {
              controller.enqueue(event);
            }
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },

    cancel() {
      reader.cancel();
    }
  });
}