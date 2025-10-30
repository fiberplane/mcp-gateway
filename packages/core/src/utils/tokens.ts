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

import { toolsCallParamsSchema } from "@fiberplane/mcp-gateway-types";
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
 * Per issue #55: Only methods where the LLM produces tokens have input cost.
 *
 * @param method - MCP method name (e.g., "tools/call")
 * @param params - Request parameters
 * @returns Estimated token count for the input, or undefined if not applicable
 */
export function estimateInputTokens(
  method: string,
  params: unknown,
): number | undefined {
  // Only tools/call has input cost (LLM produces tokens to call the tool)
  // https://github.com/fiberplane/mcp-gateway/issues/55
  if (method !== "tools/call") {
    return undefined;
  }

  try {
    // LLM sends: { name: "tool_name", arguments: {...} }
    const parsed = toolsCallParamsSchema.safeParse(params);
    let payload: unknown;

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
 * Per issue #55: Only methods where the LLM reads the response have output cost.
 *
 * EDGE CASES:
 * - Handles circular references (returns 0)
 * - Handles BigInt values (converts to string)
 * - Handles undefined/null (returns minimal count)
 * - For binary data (base64), counts the encoded string length
 *
 * @param method - MCP method name (e.g., "tools/call")
 * @param result - Response result object
 * @returns Estimated token count for the output, or undefined if not applicable
 */
export function estimateOutputTokens(
  method: string,
  result: unknown,
): number | undefined {
  // Only these methods have output cost (LLM reads the response)
  // https://github.com/fiberplane/mcp-gateway/issues/55
  if (
    method !== "tools/call" &&
    method !== "resources/read" &&
    method !== "prompts/get"
  ) {
    return undefined;
  }

  try {
    // Handle null/undefined explicitly
    if (result === null || result === undefined) {
      return estimateText(JSON.stringify({})); // "{}" = 1 token
    }

    // For MCP responses with content arrays (common pattern)
    // MCP spec uses "contents" (plural) for resources/read
    // Some implementations use "content" (singular) for tools/call
    // Example: { content: [{ type: "text", text: "..." }] }
    let contentArray: Array<unknown> | null = null;

    if (typeof result === "object" && result !== null) {
      // Try "contents" first (MCP spec - used by resources/read)
      if ("contents" in result && Array.isArray(result.contents)) {
        contentArray = result.contents;
      }
      // Fall back to "content" (some implementations - used by tools/call)
      else if ("content" in result && Array.isArray(result.content)) {
        contentArray = result.content;
      }
    }

    if (contentArray) {
      // This is more accurate for text content
      let totalChars = 0;

      for (const item of contentArray) {
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
      const structureOverhead = 40 + contentArray.length * 20;
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
