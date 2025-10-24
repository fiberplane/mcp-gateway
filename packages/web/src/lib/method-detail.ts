import type { ApiLogEntry } from "@fiberplane/mcp-gateway-types";
import {
  promptsGetParamsSchema,
  resourcesReadParamsSchema,
  toolsCallParamsSchema,
} from "@fiberplane/mcp-gateway-types";

/**
 * Format a value for display in method detail
 * Truncates long values and formats primitives nicely
 */
function formatValue(value: unknown, maxLength = 40): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    const escaped = value.replace(/\n/g, "\\n").replace(/\t/g, "\\t");
    return escaped.length > maxLength
      ? `"${escaped.slice(0, maxLength)}..."`
      : `"${escaped}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (typeof value === "object") {
    return "{...}";
  }
  return String(value);
}

/**
 * Truncate string to max length with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
}

/**
 * Extract human-readable detail from MCP request/response
 *
 * Returns a concise description of what the request is doing (for requests)
 * or a preview of the response content (for responses).
 *
 * @param log - API log entry (request, response, or SSE event)
 * @returns Human-readable detail string, or empty string if not applicable
 */
export function getMethodDetail(log: ApiLogEntry): string {
  // For responses, show a preview of the result
  if (log.direction === "response") {
    const preview = getResponsePreview(log);
    return truncate(preview, 100);
  }

  // For requests, show the method call details
  if (log.direction !== "request") return "";

  const params = log.request.params;

  switch (log.method) {
    case "tools/call": {
      const parsed = toolsCallParamsSchema.safeParse(params);
      if (!parsed.success) return "";

      const { name, arguments: args } = parsed.data;
      if (!args || typeof args !== "object") {
        return `${name}()`;
      }

      // Format as function call: toolName(arg1: value1, arg2: value2)
      const argEntries = Object.entries(args);
      if (argEntries.length === 0) {
        return `${name}()`;
      }

      const formattedArgs = argEntries
        .map(([key, value]) => `${key}: ${formatValue(value)}`)
        .join(", ");

      const result = `${name}(${formattedArgs})`;
      return truncate(result, 100);
    }

    case "resources/read": {
      const parsed = resourcesReadParamsSchema.safeParse(params);
      if (!parsed.success) return "";
      return truncate(parsed.data.uri, 100);
    }

    case "prompts/get": {
      const parsed = promptsGetParamsSchema.safeParse(params);
      if (!parsed.success) return "";

      const { name, arguments: args } = parsed.data;
      if (!args || typeof args !== "object") {
        return `${name}()`;
      }

      // Format as function call: promptName(arg1: value1, arg2: value2)
      const argEntries = Object.entries(args);
      if (argEntries.length === 0) {
        return `${name}()`;
      }

      const formattedArgs = argEntries
        .map(([key, value]) => `${key}: ${formatValue(value)}`)
        .join(", ");

      const result = `${name}(${formattedArgs})`;
      return truncate(result, 100);
    }

    case "tools/list":
    case "resources/list":
    case "prompts/list": {
      // Show "all" or cursor info
      const cursor = (params as { cursor?: string })?.cursor;
      return cursor ? `cursor: ${cursor.slice(0, 8)}...` : "all";
    }

    default:
      return "";
  }
}

/**
 * Extract a preview from a response
 *
 * Attempts to show useful information from the response result.
 */
function getResponsePreview(log: ApiLogEntry): string {
  if (log.direction !== "response") return "";

  const response = log.response;
  if (!response) return "";

  // Handle errors
  if (response.error) {
    return `Error: ${response.error.message}`;
  }

  // Handle successful results
  const result = response.result;
  if (!result) return "";

  // Extract text from MCP content array format
  if (typeof result === "object" && result !== null && "content" in result) {
    const content = (result as { content?: unknown }).content;
    if (Array.isArray(content) && content.length > 0) {
      const firstItem = content[0];
      if (
        typeof firstItem === "object" &&
        firstItem !== null &&
        "text" in firstItem
      ) {
        const text = String((firstItem as { text: unknown }).text);
        return text.length > 60 ? `${text.slice(0, 60)}...` : text;
      }
      if (
        typeof firstItem === "object" &&
        firstItem !== null &&
        "type" in firstItem
      ) {
        const type = (firstItem as { type: unknown }).type;
        return `[${type}${content.length > 1 ? ` +${content.length - 1} more` : ""}]`;
      }
    }
  }

  // Handle primitive responses
  if (typeof result === "string") {
    return result.length > 60 ? `${result.slice(0, 60)}...` : result;
  }

  if (typeof result === "number" || typeof result === "boolean") {
    return String(result);
  }

  // Handle arrays/objects generically
  if (Array.isArray(result)) {
    return `[${result.length} items]`;
  }

  if (typeof result === "object") {
    const keys = Object.keys(result);
    if (keys.length === 0) return "{}";
    return `{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", ..." : ""}}`;
  }

  return "";
}
