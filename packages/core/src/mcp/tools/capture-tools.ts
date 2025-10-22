import type { Registry } from "@fiberplane/mcp-gateway-types";
import type { McpServer } from "mcp-lite";
import { z } from "zod";
import type { Gateway } from "../../gateway.js";

/**
 * Schema for search_records tool input
 */
const SearchRecordsSchema = z.object({
  serverName: z.string().optional().describe("Filter by server name"),
  sessionId: z.string().optional().describe("Filter by session ID"),
  method: z.string().optional().describe("Filter by JSON-RPC method name"),
  limit: z
    .number()
    .int()
    .positive()
    .max(1000)
    .default(100)
    .describe("Maximum number of records to return (max: 1000)"),
  order: z
    .enum(["asc", "desc"])
    .default("desc")
    .describe("Sort order by timestamp (asc or desc)"),
});

/**
 * Registers capture analysis tools with the MCP server.
 * These tools allow clients to search and analyze captured MCP traffic.
 */
export function createCaptureTools(
  mcp: McpServer,
  _registry: Registry,
  gateway: Gateway,
): void {
  mcp.tool("search_records", {
    description: `Search captured MCP traffic records with filtering and pagination.

Filters:
- serverName: Filter by server name (exact match)
- sessionId: Filter by session ID (exact match)
- method: Filter by JSON-RPC method (partial match)
- limit: Maximum number of records to return (default: 100, max: 1000)
- order: Sort order by timestamp ('asc' or 'desc', default: 'desc')

Returns:
- Paginated list of capture records with request/response data
- Each record includes: timestamp, method, request, response, metadata (server, session, duration, HTTP status)

Examples:
- Search all records: {}
- Search by server: { "serverName": "my-server" }
- Search by method: { "method": "tools/call" }
- Search recent errors: { "order": "desc", "limit": 50 }`,
    inputSchema: SearchRecordsSchema,
    handler: async (args) => {
      try {
        const result = await gateway.storage.query(args);

        // Format results for MCP output
        const summary = `Found ${result.data.length} records (limit: ${result.pagination.limit}, hasMore: ${result.pagination.hasMore})`;

        const recordsText = result.data
          .map((record, index) => {
            const parts = [
              `\n**Record ${index + 1}/${result.data.length}**`,
              `- Timestamp: ${record.timestamp}`,
              `- Server: ${record.metadata.serverName}`,
              `- Session: ${record.metadata.sessionId}`,
              `- Method: ${record.method}`,
              `- Duration: ${record.metadata.durationMs}ms`,
              `- HTTP Status: ${record.metadata.httpStatus}`,
            ];

            if (record.request) {
              parts.push(
                `- Request: \`\`\`json\n${JSON.stringify(record.request, null, 2)}\n\`\`\``,
              );
            }

            if (record.response) {
              parts.push(
                `- Response: \`\`\`json\n${JSON.stringify(record.response, null, 2)}\n\`\`\``,
              );
            }

            return parts.join("\n");
          })
          .join("\n\n---\n");

        return {
          content: [
            {
              type: "text",
              text: `${summary}\n${recordsText || "\n(No records found)"}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching records: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  });
}
