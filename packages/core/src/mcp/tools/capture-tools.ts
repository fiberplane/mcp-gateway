import type { Registry } from "@fiberplane/mcp-gateway-types";
import type { McpServer } from "mcp-lite";
import { z } from "zod";

/**
 * Registers capture analysis tools with the MCP server.
 * These tools allow clients to search and analyze captured MCP traffic.
 */
export function createCaptureTools(
  mcp: McpServer,
  _registry: Registry,
  _storageDir: string,
): void {
  mcp.tool("search_records", {
    description: `[TEMPORARILY UNAVAILABLE] This tool is being migrated from JSONL to SQLite-based queries. Please use the web UI at /ui or the REST API to query logs.`,
    inputSchema: z.object({}),
    handler: async () => {
      return {
        content: [
          {
            type: "text",
            text: "❌ This tool is temporarily unavailable during migration to SQLite-based queries.\n\n" +
                  "**Alternative Options:**\n" +
                  "- Use the Web UI: Navigate to http://localhost:3333/ui\n" +
                  "- Use the REST API: GET http://localhost:3333/api/logs\n" +
                  "- Export logs: Use the export functionality in the web UI\n\n" +
                  "This tool will be restored in a future update with improved performance.",
          },
        ],
        isError: true,
      };
    },
  });
}
