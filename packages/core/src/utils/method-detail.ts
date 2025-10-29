import type { ApiLogEntry } from "@fiberplane/mcp-gateway-types";
import {
  promptsGetParamsSchema,
  resourcesReadParamsSchema,
  toolsCallParamsSchema,
} from "@fiberplane/mcp-gateway-types";
import { logger } from "../logger.js";

/**
 * Smart truncation for URIs - preserves protocol and filename
 * Example: file:///very/long/path/to/some/file.txt → file://.../file.txt
 */
function truncateUri(uri: string, maxLength: number): string {
  // Match URI pattern: protocol://path (requires :// to avoid Windows paths like C:\)
  const uriMatch = uri.match(/^([a-z][a-z0-9+.-]*:\/\/)(.*)/i);
  if (!uriMatch) {
    // Not a URI, use regular truncation
    return uri.length > maxLength ? `${uri.slice(0, maxLength)}...` : uri;
  }

  const protocol = uriMatch[1] || "";
  const path = uriMatch[2] || "";

  // If the full URI fits, return as-is
  if (uri.length <= maxLength) {
    return uri;
  }

  // Extract filename (last segment after final /)
  const lastSlashIndex = path.lastIndexOf("/");
  const filename = lastSlashIndex >= 0 ? path.slice(lastSlashIndex + 1) : path;

  // Calculate space available for path after protocol and ".../" and filename
  const overhead = protocol.length + 4 + filename.length; // 4 = ".../".length

  // If even the abbreviated form is too long, truncate the filename
  if (overhead > maxLength) {
    const filenameMaxLength = maxLength - protocol.length - 4;
    if (filenameMaxLength <= 3) {
      // Not enough space, just show protocol
      return `${protocol}...`;
    }
    return `${protocol}.../${filename.slice(0, filenameMaxLength)}...`;
  }

  // Return smart truncated form
  return `${protocol}.../${filename}`;
}

/**
 * Format a value for display in method detail
 * Truncates long values and formats primitives nicely
 */
function formatValue(value: unknown, maxLength = 40): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    const escaped = value.replace(/\n/g, "\\n").replace(/\t/g, "\\t");

    // Check if this looks like a URI (requires :// to avoid Windows paths like C:\)
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(escaped)) {
      const truncated = truncateUri(escaped, maxLength);
      return `"${truncated}"`;
    }

    // Regular string truncation
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
        logger.warn("[method-detail] Failed to parse tools/call params", {
          issues: parsed.error.issues,
          params,
        });
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
        logger.warn("[method-detail] Failed to parse resources/read params", {
          issues: parsed.error.issues,
          params,
        });
        return null;
      }
      // Use smart URI truncation for file paths
      return truncateUri(parsed.data.uri, 100);
    }

    case "prompts/get": {
      const parsed = promptsGetParamsSchema.safeParse(params);
      if (!parsed.success) {
        logger.warn("[method-detail] Failed to parse prompts/get params", {
          issues: parsed.error.issues,
          params,
        });
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
      // Show cursor info only (don't show "all" - it's redundant)
      if (
        params &&
        typeof params === "object" &&
        "cursor" in params &&
        typeof params.cursor === "string"
      ) {
        return `cursor: ${params.cursor.slice(0, 8)}...`;
      }
      return "";
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
 * Extract content array from result (handles both "content" and "contents")
 * MCP spec uses "contents" (plural), but some implementations use "content"
 */
function getContentArray(result: unknown): Array<unknown> | null {
  if (typeof result !== "object" || result === null) return null;

  // Try "contents" first (MCP spec)
  if ("contents" in result && Array.isArray(result.contents)) {
    return result.contents;
  }

  // Fall back to "content" (some implementations)
  if ("content" in result && Array.isArray(result.content)) {
    return result.content;
  }

  return null;
}

/**
 * Extract a preview from a response
 *
 * Attempts to show useful information from the response result.
 * Matches TUI formatting for consistency across interfaces.
 */
function getResponsePreview(log: ApiLogEntry): string {
  if (log.direction !== "response") return "";

  const response = log.response;
  if (!response) return "";

  // Handle errors
  if (response.error) {
    const message = response.error.message || "";
    return message.startsWith("Error") ? message : `Error: ${message}`;
  }

  // Handle successful results
  const result = response.result;
  if (!result) return "";

  // Method-specific formatting (matching TUI output)
  switch (log.method) {
    case "initialize": {
      // Format: → server-name@version
      if (
        typeof result === "object" &&
        result !== null &&
        "serverInfo" in result
      ) {
        const serverInfo = result.serverInfo as {
          name: string;
          version: string;
        };
        return `→ ${serverInfo.name}@${serverInfo.version}`;
      }
      break;
    }

    case "tools/list": {
      // Format: 19 tools: echo, add, multiply, +7
      if (
        typeof result === "object" &&
        result !== null &&
        "tools" in result &&
        Array.isArray(result.tools)
      ) {
        const tools = result.tools as Array<{ name: string }>;
        const count = tools.length;
        if (count === 0) return "0 tools";

        const toolNames = tools.slice(0, 3).map((t) => t.name);
        const more = count > 3 ? `, +${count - 3}` : "";
        return `${count} tools: ${toolNames.join(", ")}${more}`;
      }
      break;
    }

    case "resources/list": {
      // Format: 5 resources: name1, name2, +3
      if (
        typeof result === "object" &&
        result !== null &&
        "resources" in result &&
        Array.isArray(result.resources)
      ) {
        const resources = result.resources as Array<{
          name: string;
          uri: string;
        }>;
        const count = resources.length;
        if (count === 0) return "0 resources";

        const resourceNames = resources.slice(0, 2).map((r) => r.name);
        const more = count > 2 ? `, +${count - 2}` : "";
        return `${count} resources: ${resourceNames.join(", ")}${more}`;
      }
      break;
    }

    case "resources/templates/list": {
      // Format: 5 templates: name1, name2, +3
      if (
        typeof result === "object" &&
        result !== null &&
        "resourceTemplates" in result &&
        Array.isArray(result.resourceTemplates)
      ) {
        const templates = result.resourceTemplates as Array<{
          name: string;
          uriTemplate: string;
        }>;
        const count = templates.length;
        if (count === 0) return "0 templates";

        const templateNames = templates.slice(0, 2).map((t) => t.name);
        const more = count > 2 ? `, +${count - 2}` : "";
        return `${count} templates: ${templateNames.join(", ")}${more}`;
      }
      break;
    }

    case "prompts/list": {
      // Format: 3 prompts: analyze, summarize, +1
      if (
        typeof result === "object" &&
        result !== null &&
        "prompts" in result &&
        Array.isArray(result.prompts)
      ) {
        const prompts = result.prompts as Array<{ name: string }>;
        const count = prompts.length;
        if (count === 0) return "0 prompts";

        const promptNames = prompts.slice(0, 2).map((p) => p.name);
        const more = count > 2 ? `, +${count - 2}` : "";
        return `${count} prompts: ${promptNames.join(", ")}${more}`;
      }
      break;
    }

    case "prompts/get": {
      // Format: "description" (5 messages)
      if (typeof result === "object" && result !== null) {
        const description = (
          "description" in result && typeof result.description === "string"
            ? result.description
            : undefined
        ) as string | undefined;
        const messages = (
          "messages" in result && Array.isArray(result.messages)
            ? result.messages
            : []
        ) as Array<unknown>;
        const messageCount = messages.length;

        if (description) {
          return `"${description}" (${messageCount} ${messageCount === 1 ? "message" : "messages"})`;
        }
        return `${messageCount} ${messageCount === 1 ? "message" : "messages"}`;
      }
      break;
    }

    case "tools/call": {
      // Format: "text content..." with quotes
      const toolContent = getContentArray(result);
      if (toolContent && toolContent.length > 0) {
        const firstItem = toolContent[0];
        if (hasText(firstItem)) {
          const text = firstItem.text;
          const truncated = text.length > 40 ? `${text.slice(0, 40)}...` : text;
          return `"${truncated}"`;
        }
      }
      break;
    }

    case "resources/read": {
      // Format: "mimetype (length)" or "N contents"
      const resourceContent = getContentArray(result);
      if (resourceContent) {
        const contentCount = resourceContent.length;
        if (contentCount === 0) return "0 contents";
        if (contentCount > 1) return `${contentCount} contents`;

        // Single content item - show MIME type and size
        const firstItem = resourceContent[0];
        if (firstItem && typeof firstItem === "object") {
          const mimeType =
            "mimeType" in firstItem && typeof firstItem.mimeType === "string"
              ? firstItem.mimeType
              : undefined;

          // Calculate size
          let size = 0;
          let unit = "chars";

          if (hasText(firstItem)) {
            size = firstItem.text.length;
            unit = "chars";
          } else if (
            "data" in firstItem &&
            typeof firstItem.data === "string"
          ) {
            // Base64 data - estimate bytes (base64 is ~1.33x larger than original)
            size = Math.ceil((firstItem.data.length * 3) / 4);
            unit = "bytes";
          }

          if (mimeType && size > 0) {
            return `${mimeType} (${size.toLocaleString()} ${unit})`;
          }
          if (mimeType) return mimeType;
          if (size > 0) return `${size.toLocaleString()} ${unit}`;
        }
      }
      break;
    }
  }

  // Generic fallback formatting
  // Extract text from MCP content array format (handles both content/contents)
  const genericContent = getContentArray(result);
  if (genericContent && genericContent.length > 0) {
    const firstItem = genericContent[0];
    if (hasText(firstItem)) {
      const text = firstItem.text;
      return text.length > 60 ? `${text.slice(0, 60)}...` : text;
    }
    if (hasType(firstItem)) {
      const type = firstItem.type;
      return `[${type}${genericContent.length > 1 ? ` +${genericContent.length - 1} more` : ""}]`;
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
