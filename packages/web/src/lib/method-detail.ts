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
 * @returns Human-readable detail string, null if parsing failed, or empty string if not applicable
 */
export function getMethodDetail(log: ApiLogEntry): string | null {
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
      if (!parsed.success) {
        // biome-ignore lint/suspicious/noConsole: Intentional logging for debugging parse failures
        console.warn(
          "[method-detail] Failed to parse tools/call params:",
          parsed.error.issues,
          "params:",
          params,
        );
        return null;
      }

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
      if (!parsed.success) {
        // biome-ignore lint/suspicious/noConsole: Intentional logging for debugging parse failures
        console.warn(
          "[method-detail] Failed to parse resources/read params:",
          parsed.error.issues,
          "params:",
          params,
        );
        return null;
      }
      return truncate(parsed.data.uri, 100);
    }

    case "prompts/get": {
      const parsed = promptsGetParamsSchema.safeParse(params);
      if (!parsed.success) {
        // biome-ignore lint/suspicious/noConsole: Intentional logging for debugging parse failures
        console.warn(
          "[method-detail] Failed to parse prompts/get params:",
          parsed.error.issues,
          "params:",
          params,
        );
        return null;
      }

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
      if (
        params &&
        typeof params === "object" &&
        "cursor" in params &&
        typeof params.cursor === "string"
      ) {
        return `cursor: ${params.cursor.slice(0, 8)}...`;
      }
      return "all";
    }

    default:
      return "";
  }
}

/**
 * Type guard for MCP content item with text
 */
function hasText(item: unknown): item is { text: string } {
  return (
    typeof item === "object" &&
    item !== null &&
    "text" in item &&
    typeof item.text === "string"
  );
}

/**
 * Type guard for MCP content item with type
 */
function hasType(item: unknown): item is { type: string } {
  return (
    typeof item === "object" &&
    item !== null &&
    "type" in item &&
    typeof item.type === "string"
  );
}

/**
 * Type guard for MCP content array format
 */
function hasContent(result: unknown): result is { content: Array<unknown> } {
  return (
    typeof result === "object" &&
    result !== null &&
    "content" in result &&
    Array.isArray(result.content)
  );
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
  if (hasContent(result) && result.content.length > 0) {
    const firstItem = result.content[0];
    if (hasText(firstItem)) {
      const text = firstItem.text;
      return text.length > 60 ? `${text.slice(0, 60)}...` : text;
    }
    if (hasType(firstItem)) {
      const type = firstItem.type;
      return `[${type}${result.content.length > 1 ? ` +${result.content.length - 1} more` : ""}]`;
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
