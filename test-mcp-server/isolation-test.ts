#!/usr/bin/env bun

/**
 * Isolation Test MCP Server
 *
 * A minimal MCP server designed to test stdio session isolation.
 * Maintains an in-memory counter that increments with each call,
 * allowing verification that different sessions have separate state.
 *
 * Tools:
 * - increment: Increments the counter and returns the new value
 * - get_count: Returns the current counter value
 * - reset: Resets the counter to zero
 */

import { createInterface } from "node:readline";
import { McpServer } from "mcp-lite";
import pkg from "./package.json" with { type: "json" };

// Create MCP server instance
const mcp = new McpServer({
  name: "isolation-test-server",
  version: "1.0.0",
});

// In-memory counter - each process instance has its own
let counter = 0;

// Tool: increment counter
mcp.tool("increment", {
  description: "Increments the counter and returns the new value",
  handler: () => {
    counter++;
    return {
      content: [
        {
          type: "text",
          text: `Counter incremented to ${counter}`,
        },
      ],
      structuredContent: { count: counter },
    };
  },
});

// Tool: get current count
mcp.tool("get_count", {
  description: "Returns the current counter value",
  handler: () => ({
    content: [
      {
        type: "text",
        text: `Counter is ${counter}`,
      },
    ],
    structuredContent: { count: counter },
  }),
});

// Tool: reset counter
mcp.tool("reset", {
  description: "Resets the counter to zero",
  handler: () => {
    counter = 0;
    return {
      content: [
        {
          type: "text",
          text: "Counter reset to 0",
        },
      ],
      structuredContent: { count: counter },
    };
  },
});

// Log to stderr (won't interfere with stdio communication)
console.error("Isolation test server started (stdio mode)");
console.error(`Process PID: ${process.pid}`);

// Handle stdio communication
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  try {
    const request = JSON.parse(line);

    // Handle different MCP methods
    // biome-ignore lint/suspicious/noImplicitAnyLet: JSON-RPC response can be various types
    let response;

    if (request.method === "initialize") {
      response = {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: pkg.name,
            version: pkg.version,
          },
        },
      };
    } else if (request.method === "tools/list") {
      // Get tools from mcp server
      const tools = Array.from(
        // biome-ignore lint/suspicious/noExplicitAny: McpServer tools map not exposed in types
        (mcp as any).tools.entries() as [string, any][],
      ).map(([name, tool]) => ({
        name,
        description: tool.metadata.description,
        inputSchema: tool.metadata.inputSchema || {
          type: "object",
          properties: {},
        },
      }));

      response = {
        jsonrpc: "2.0",
        id: request.id,
        result: { tools },
      };
    } else if (request.method === "tools/call") {
      // Call the tool handler
      const toolName = request.params?.name;
      // biome-ignore lint/suspicious/noExplicitAny: McpServer tools map not exposed in types
      const tool = (mcp as any).tools.get(toolName);

      if (!tool) {
        response = {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32601,
            message: `Tool not found: ${toolName}`,
          },
        };
      } else {
        try {
          const result = await tool.handler(request.params?.arguments || {});
          response = {
            jsonrpc: "2.0",
            id: request.id,
            result,
          };
        } catch (error) {
          response = {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : String(error),
            },
          };
        }
      }
    } else {
      response = {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`,
        },
      };
    }

    // Write response to stdout
    console.log(JSON.stringify(response));
  } catch (error) {
    console.error("Error processing request:", error);
  }
});
