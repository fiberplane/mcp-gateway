import type { ApiLogEntry } from "@fiberplane/mcp-gateway-types";

/**
 * Extract human-readable detail from MCP request/response
 *
 * Returns a concise description of what the request is doing (for requests)
 * or a preview of the response content (for responses).
 *
 * The detail is computed by the backend at capture time and stored in metadata.
 *
 * @param log - API log entry (request, response, or SSE event)
 * @returns Human-readable detail string, null if parsing failed, or empty string if not applicable
 */
export function getMethodDetail(log: ApiLogEntry): string | null {
  return log.metadata.methodDetail ?? null;
}
