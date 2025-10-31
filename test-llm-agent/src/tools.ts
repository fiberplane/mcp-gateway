import { tool } from "ai";
import { z } from "zod";

/**
 * MCP Tools for AI SDK
 *
 * These tools map to the test-mcp-server's capabilities.
 * Each tool execution calls the MCP server through the gateway.
 */

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3333";
const MCP_SERVER = process.env.MCP_SERVER || "everything";

/**
 * Correlation mode - controls how conversation IDs are propagated
 * - "manual": Send X-Conversation-Id header with MCP calls (default)
 * - "auto": Rely on session-based automatic propagation by gateway
 * - "none": No correlation headers - tests fuzzy matching fallback
 */
type CorrelationMode = "manual" | "auto" | "none";
const CORRELATION_MODE = (process.env.CORRELATION_MODE ||
  "manual") as CorrelationMode;

/**
 * Session ID for MCP calls (stateless for testing)
 * In a real application, this would be managed per-session
 */
const SESSION_ID = "test-agent-session";

/**
 * Global conversation ID storage
 * Set by the agent before tool execution
 */
let currentConversationId: string | undefined;

export function setConversationId(conversationId: string) {
  currentConversationId = conversationId;
}

/**
 * Helper to call MCP server through gateway
 */
async function callMCPTool(
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Mcp-Session-Id": SESSION_ID, // Required by MCP protocol
  };

  // Add conversation ID based on correlation mode
  if (CORRELATION_MODE === "manual" && currentConversationId) {
    // Manual mode: Explicitly send X-Conversation-Id header
    headers["X-Conversation-Id"] = currentConversationId;
  }
  // In "auto" mode: Gateway will automatically link via session
  // In "none" mode: No header sent, relies on fuzzy matching

  const response = await fetch(`${GATEWAY_URL}/s/${MCP_SERVER}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MCP call failed: ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(`MCP error: ${result.error.message}`);
  }

  return result.result;
}

/**
 * Weather tool - gets current weather for a location
 */
export const getWeather = tool({
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z
      .string()
      .describe("Location name (e.g., Amsterdam, Paris, Tokyo)"),
  }),
  execute: async ({ location }) => {
    console.log(`🌤️  Calling MCP tool: getWeather(${location})`);

    const result = await callMCPTool("tools/call", {
      name: "getWeather",
      arguments: {
        location,
        unit: "celsius",
        includeHumidity: false,
      },
    });

    return result;
  },
});

/**
 * Echo tool - simple test tool that echoes back the message
 */
export const echo = tool({
  description: "Echo back a message (useful for testing)",
  inputSchema: z.object({
    message: z.string().describe("Message to echo back"),
    repeat: z
      .number()
      .min(1)
      .max(10)
      .describe("Number of times to repeat the message")
      .optional(),
  }),
  execute: async ({ message, repeat }) => {
    console.log(`📢 Calling MCP tool: echo("${message}", repeat: ${repeat})`);

    const result = await callMCPTool("tools/call", {
      name: "echo",
      arguments: { message, repeat: repeat || 1 },
    });

    return result;
  },
});

/**
 * Add tool - adds two numbers together
 */
export const add = tool({
  description: "Add two numbers together",
  inputSchema: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  }),
  execute: async ({ a, b }) => {
    console.log(`➕ Calling MCP tool: add(${a}, ${b})`);

    const result = await callMCPTool("tools/call", {
      name: "add",
      arguments: { a, b },
    });

    return result;
  },
});

/**
 * All available MCP tools
 */
export const mcpTools = {
  getWeather,
  echo,
  add,
};
