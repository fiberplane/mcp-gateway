/**
 * Token estimation utilities for MCP operations
 *
 * Uses a simple heuristic (~4 characters per token) to estimate the cost
 * of MCP tool calls in terms of LLM tokens. This provides a rough approximation
 * useful for cost tracking and monitoring.
 *
 * ACCURACY NOTES:
 * - For English text: ~4-5 chars/token
 * - For JSON payloads: ~3.5-4.5 chars/token
 * - For code/paths: ~3-4 chars/token
 * - This estimate is intentionally conservative (may overestimate by 10-20%)
 *
 * For precise token counting, consider using tiktoken or an LLM tokenizer.
 * However, this heuristic is sufficient for cost monitoring and rate limiting.
 */

import {
  promptsGetParamsSchema,
  resourcesReadParamsSchema,
  toolsCallParamsSchema,
} from "@fiberplane/mcp-gateway-types";
import { logger } from "../logger.js";

const CHARS_PER_TOKEN = 4;

/**
 * Estimate tokens from a text string
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
function estimateText(text: string): number {
  // Handle edge cases
  if (!text) return 0;

  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate input tokens from MCP request params
 *
 * Extracts only the parts that would be sent to the LLM in a tool_use block,
 * ignoring MCP protocol overhead.
 *
 * @param method - MCP method name (e.g., "tools/call")
 * @param params - Request parameters
 * @returns Estimated token count for the input
 */
export function estimateInputTokens(method: string, params: unknown): number {
  try {
    let payload: unknown;

    switch (method) {
      case "tools/call": {
        // LLM sends: { name: "tool_name", arguments: {...} }
        const parsed = toolsCallParamsSchema.safeParse(params);
        if (parsed.success) {
          payload = {
            name: parsed.data.name,
            arguments: parsed.data.arguments,
          };
        } else {
          // Fallback to full params if schema validation fails
          logger.warn(
            "[tokens] Failed to parse tools/call params for token estimation",
            {
              issues: parsed.error.issues,
              method,
            },
          );
          payload = params || {};
        }
        break;
      }

      case "resources/read": {
        // LLM sends: { uri: "file://..." }
        const parsed = resourcesReadParamsSchema.safeParse(params);
        if (parsed.success) {
          payload = { uri: parsed.data.uri };
        } else {
          logger.warn(
            "[tokens] Failed to parse resources/read params for token estimation",
            {
              issues: parsed.error.issues,
              method,
            },
          );
          payload = params || {};
        }
        break;
      }

      case "prompts/get": {
        // LLM sends: { name: "prompt_name", arguments?: {...} }
        const parsed = promptsGetParamsSchema.safeParse(params);
        if (parsed.success) {
          payload = {
            name: parsed.data.name,
            arguments: parsed.data.arguments,
          };
        } else {
          logger.warn(
            "[tokens] Failed to parse prompts/get params for token estimation",
            {
              issues: parsed.error.issues,
              method,
            },
          );
          payload = params || {};
        }
        break;
      }

      case "tools/list":
      case "resources/list":
      case "prompts/list":
        // List methods have minimal input (just cursor if any)
        payload = params || {};
        break;

      default:
        // For other methods, use full params
        payload = params || {};
    }

    return estimateText(JSON.stringify(payload));
  } catch (error) {
    // Gracefully handle serialization errors
    logger.warn("[tokens] Failed to estimate input tokens", {
      method,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Estimate output tokens from MCP response result
 *
 * The result is what gets sent back to the LLM in a tool_result block.
 *
 * EDGE CASES:
 * - Handles circular references (returns 0)
 * - Handles BigInt values (converts to string)
 * - Handles undefined/null (returns minimal count)
 * - For binary data (base64), counts the encoded string length
 *
 * @param result - Response result object
 * @returns Estimated token count for the output
 */
export function estimateOutputTokens(result: unknown): number {
  try {
    // Handle null/undefined explicitly
    if (result === null || result === undefined) {
      return estimateText(JSON.stringify({})); // "{}" = 1 token
    }

    // For MCP responses with content arrays (common pattern)
    // Example: { content: [{ type: "text", text: "..." }] }
    if (
      typeof result === "object" &&
      result !== null &&
      "content" in result &&
      Array.isArray(result.content)
    ) {
      // This is more accurate for text content
      const content = result.content;
      let totalChars = 0;

      for (const item of content) {
        if (item && typeof item === "object") {
          // Count text content more accurately
          if ("text" in item && typeof item.text === "string") {
            totalChars += item.text.length;
          }
          // Count image data (base64)
          if ("data" in item && typeof item.data === "string") {
            totalChars += item.data.length;
          }
        }
      }

      // Add overhead for JSON structure (type fields, etc.)
      // Typical: {"content":[{"type":"text","text":"..."}]} adds ~40 chars
      const structureOverhead = 40 + content.length * 20;
      totalChars += structureOverhead;

      return Math.ceil(totalChars / CHARS_PER_TOKEN);
    }

    // Default: stringify the entire result
    return estimateText(JSON.stringify(result));
  } catch (error) {
    // Handle circular references, BigInt, or other serialization errors
    // Attempt basic stringification
    if (error instanceof TypeError && error.message.includes("circular")) {
      logger.warn(
        "[tokens] Circular reference detected in output, using key-based estimate",
        {
          keyCount:
            typeof result === "object" && result !== null
              ? Object.keys(result).length
              : 0,
        },
      );
      // For circular refs, try to estimate based on object keys
      if (typeof result === "object" && result !== null) {
        const keys = Object.keys(result);
        // Rough estimate: 20 chars per key (including value estimate)
        return Math.ceil((keys.length * 20) / CHARS_PER_TOKEN);
      }
    }

    // Fallback: return 0 for unsupported types
    logger.warn("[tokens] Failed to estimate output tokens", {
      error: error instanceof Error ? error.message : String(error),
      resultType: typeof result,
    });
    return 0;
  }
}
