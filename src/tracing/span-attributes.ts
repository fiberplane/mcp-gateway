import type { Span } from "@opentelemetry/api";
import type { ParsedMCPMessage } from "./parser.js";

export interface MCPResponseData {
  isError: boolean;
  contentCount: number;
  contentTypes?: string[];
  content?: unknown;
}

/**
 * Set method-specific MCP request attributes on a span per Sentry MCP spec
 */
export function setMCPRequestAttributes(
  span: Span,
  requestMCP: ParsedMCPMessage,
): void {
  if (requestMCP.method === "tools/call" && requestMCP.toolName) {
    span.setAttributes({
      "mcp.tool.name": requestMCP.toolName,
    });

    // Add tool arguments with mcp.request.argument prefix
    if (requestMCP.arguments) {
      for (const [key, value] of Object.entries(requestMCP.arguments)) {
        span.setAttribute(`mcp.request.argument.${key}`, String(value));
      }
    }
  } else if (requestMCP.method === "prompts/get" && requestMCP.promptName) {
    span.setAttributes({
      "mcp.prompt.name": requestMCP.promptName,
    });

    // Add prompt arguments with mcp.request.argument prefix
    if (requestMCP.arguments) {
      for (const [key, value] of Object.entries(requestMCP.arguments)) {
        span.setAttribute(`mcp.request.argument.${key}`, String(value));
      }
    }
  } else if (requestMCP.method === "resources/read" && requestMCP.resourceUri) {
    span.setAttributes({
      "mcp.resource.uri": requestMCP.resourceUri,
    });
  }
}

/**
 * Set method-specific MCP result attributes on a span per Sentry MCP spec
 */
export function setMCPResponseAttributes(
  span: Span,
  requestMCP: ParsedMCPMessage,
  responseData: MCPResponseData,
): void {
  if (requestMCP.method === "tools/call") {
    span.setAttributes({
      "mcp.tool.result.is_error": responseData.isError,
      "mcp.tool.result.content_count": responseData.contentCount,
    });

    // Add content types if available
    if (responseData.contentTypes && responseData.contentTypes.length > 0) {
      span.setAttribute(
        "mcp.tool.result.content_types",
        responseData.contentTypes.join(","),
      );
    }

    // Optionally store serialized content (be mindful of size limits)
    if (
      responseData.content &&
      JSON.stringify(responseData.content).length < 1000
    ) {
      span.setAttribute(
        "mcp.tool.result.content",
        JSON.stringify(responseData.content),
      );
    }
  } else if (requestMCP.method === "prompts/get") {
    span.setAttributes({
      "mcp.prompt.result.is_error": responseData.isError,
      "mcp.prompt.result.content_count": responseData.contentCount,
    });
  } else if (requestMCP.method === "resources/read") {
    span.setAttributes({
      "mcp.resource.result.is_error": responseData.isError,
      "mcp.resource.result.content_count": responseData.contentCount,
    });
  }
}
