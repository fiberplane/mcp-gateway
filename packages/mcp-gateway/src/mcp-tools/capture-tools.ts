import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { McpServer } from "mcp-lite";
import { z } from "zod";
import type { Registry } from "../registry.js";
import type { CaptureRecord } from "../schemas.js";

// =============================================================================
// Types and Interfaces
// =============================================================================

interface CaptureFile {
  path: string;
  serverName: string;
  sessionId: string;
  timestamp: string;
}


// Schema for searching captures with comprehensive filtering
const SearchRecordsSchema = z.object({
  server: z
    .string()
    .optional()
    .describe(
      "Filter by specific server name. If not provided, searches across all servers.",
    ),

  session: z
    .string()
    .optional()
    .describe(
      "Filter by specific session ID. Useful for analyzing a particular client interaction sequence.",
    ),

  method: z
    .string()
    .optional()
    .describe(
      "Filter by MCP method name (e.g., 'tools/call', 'resources/read', 'prompts/get'). Supports partial matching.",
    ),

  messageType: z
    .enum(["request", "response", "notification", "error"])
    .optional()
    .describe(
      "Filter by message type. 'request' shows incoming requests, 'response' shows server responses, 'notification' shows one-way messages, 'error' shows failed requests.",
    ),

  hasError: z
    .boolean()
    .optional()
    .describe(
      "Filter to show only messages that resulted in errors (true) or exclude error messages (false). Omit to include both.",
    ),

  timeRange: z
    .object({
      start: z
        .string()
        .min(1, "Start time is required")
        .describe(
          "Start time for search in ISO 8601 format (e.g., '2024-01-01T00:00:00Z'). Defaults to 24 hours ago.",
        ),
      end: z
        .string()
        .min(1, "End time is required")
        .describe(
          "End time for search in ISO 8601 format. Defaults to current time.",
        ),
    })
    .optional()
    .describe(
      "Time range to search within. Helps narrow results for large capture datasets.",
    ),

  limit: z
    .number()
    .min(1)
    .max(1000)
    .optional()
    .default(50)
    .describe(
      "Maximum number of results to return (1-1000). Use pagination for large result sets.",
    ),

  offset: z
    .number()
    .min(0)
    .optional()
    .default(0)
    .describe(
      "Number of results to skip for pagination. Combine with limit for paging through large datasets.",
    ),

  format: z
    .enum(["concise", "detailed"])
    .optional()
    .default("concise")
    .describe(
      "Response format. 'concise' returns essential information for quick scanning, 'detailed' includes full request/response bodies and metadata.",
    ),
});


// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Find all capture files in the storage directory with optional filtering
 */
async function findCaptureFiles(
  storageDir: string,
  serverFilter?: string,
): Promise<CaptureFile[]> {
  const captureFiles: CaptureFile[] = [];

  try {
    const entries = await readdir(storageDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const serverName = entry.name;
      if (serverFilter && serverName !== serverFilter) continue;

      const serverDir = join(storageDir, serverName);

      try {
        const files = await readdir(serverDir);

        for (const file of files) {
          if (!file.endsWith(".jsonl")) continue;

          // Parse filename with regex: {timestamp}-{serverName}-{sessionId}.jsonl
          // Expected: 2025-09-25T15-14-50-833Z-localhost_3000-7e4d837e_e4a1_4408_9955_af89f93efef3.jsonl
          const withoutExt = file.replace(".jsonl", "");

          // Match pattern: (timestamp)-(server_name)-(session_id)
          // We know the server name from the directory, so work backwards from there
          const serverNamePattern = serverName.replace(/[-]/g, "_"); // Convert to underscore format
          const regex = new RegExp(
            `^(.+)-${serverNamePattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(.+)$`,
          );
          const match = withoutExt.match(regex);

          if (!match) {
            continue;
          }

          const timestamp = match[1] || "";
          const sessionId = match[2]?.replace(/_/g, "-") || "unknown"; // Convert underscores back to dashes in session ID

          captureFiles.push({
            path: join(serverDir, file),
            serverName,
            sessionId,
            timestamp,
          });
        }
      } catch (error) {
        console.warn(`Failed to read server directory ${serverName}:`, error);
      }
    }
  } catch (error) {
    console.warn("Failed to read storage directory:", error);
  }

  return captureFiles.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Parse a JSONL file and return capture records
 */
async function parseJsonlFile(filePath: string): Promise<CaptureRecord[]> {
  try {
    const content = await readFile(filePath, "utf8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.trim());
    const records: CaptureRecord[] = [];

    for (const line of lines) {
      try {
        const record = JSON.parse(line) as CaptureRecord;
        records.push(record);
      } catch (error) {
        console.warn(`Failed to parse JSONL line in ${filePath}:`, error);
      }
    }

    return records;
  } catch (error) {
    console.warn(`Failed to read capture file ${filePath}:`, error);
    return [];
  }
}


/**
 * Filter records by time range
 */
function filterByTimeRange(
  records: CaptureRecord[],
  start?: string,
  end?: string,
): CaptureRecord[] {
  if (!start && !end) return records;

  const startTime = start ? new Date(start).getTime() : 0;
  const endTime = end ? new Date(end).getTime() : Date.now();

  return records.filter((record) => {
    const recordTime = new Date(record.timestamp).getTime();
    return recordTime >= startTime && recordTime <= endTime;
  });
}

/**
 * Filter records by method (supports partial matching)
 */
function filterByMethod(
  records: CaptureRecord[],
  method: string,
): CaptureRecord[] {
  const methodLower = method.toLowerCase();
  return records.filter((record) =>
    record.method.toLowerCase().includes(methodLower),
  );
}

/**
 * Filter records by message type
 */
function filterByMessageType(
  records: CaptureRecord[],
  messageType: "request" | "response" | "notification" | "error",
): CaptureRecord[] {
  switch (messageType) {
    case "request":
      return records.filter((record) => !!record.request);
    case "response":
      return records.filter(
        (record) => !!record.response && !record.response.error,
      );
    case "notification":
      return records.filter((record) => record.id === null && !!record.request);
    case "error":
      return records.filter((record) => !!record.response?.error);
    default:
      return records;
  }
}


/**
 * Format large payload with truncation
 */
function truncateLargePayload(obj: unknown, maxLength: number = 500): string {
  const str = JSON.stringify(obj, null, 2);
  if (str.length <= maxLength) return str;

  const truncated = str.slice(0, maxLength);
  const lastNewline = truncated.lastIndexOf("\n");
  return (
    truncated.slice(0, lastNewline > 0 ? lastNewline : maxLength) +
    `\n... [truncated ${str.length - maxLength} characters]`
  );
}

/**
 * Format a concise record for display
 */
function formatConciseRecord(
  record: CaptureRecord,
  includePayload: boolean = false,
): string {
  const timestamp = new Date(record.timestamp).toLocaleString();
  const type = record.request
    ? record.id === null
      ? "NOTIFY"
      : "REQ"
    : "RESP";
  const error = record.response?.error ? " ❌" : "";
  const duration = record.response ? ` (${record.metadata.durationMs}ms)` : "";

  let result = `[${timestamp}] ${type} ${record.method}${duration}${error}`;

  if (includePayload) {
    const payload = record.request || record.response;
    if (payload) {
      result += `\n${truncateLargePayload(payload, 200)}`;
    }
  }

  return result;
}

// =============================================================================
// Tool Implementations
// =============================================================================

/**
 * Registers capture analysis tools with the MCP server.
 * These tools allow clients to search and analyze captured MCP traffic.
 */
export function createCaptureTools(
  mcp: McpServer,
  registry: Registry,
  storageDir: string,
): void {
  mcp.tool("search_records", {
    description: `Searches through captured MCP traffic with powerful filtering capabilities. This tool is essential for debugging, monitoring, and understanding MCP communication patterns across your gateway.

The gateway captures all MCP requests and responses in JSONL format, organized by server and session. This tool provides a flexible search interface to find specific interactions or patterns in the capture data.

**Key Use Cases:**
- **Debugging**: Find failed requests by error type or method to diagnose issues
- **Monitoring**: Track usage patterns and identify high-traffic methods or servers
- **Analysis**: Understand client behavior and server response patterns
- **Auditing**: Review security-sensitive operations or compliance requirements
- **Performance**: Identify slow requests or servers with high latency

**Filtering Strategy:**
Use multiple filters together for precise results. For example:
- Find tool call errors: messageType="error" + method="tools/call"
- Debug a session: session="abc123" + hasError=true
- Monitor a server: server="weather" + timeRange (last hour)

**Performance Considerations:**
- Use timeRange to limit search scope for better performance
- Start with concise format for quick scanning, then use detailed for specific records
- Use pagination (limit/offset) for large result sets to avoid overwhelming responses
- Filter by server first if you know which server is relevant

**Response Optimization:**
The tool automatically truncates large request/response bodies to prevent token overflow. Full bodies are available in detailed format when needed. Error messages include actionable guidance for refining searches.

Results are sorted by timestamp (newest first) and include context like duration, status codes, and session information to help you quickly identify relevant interactions.`,
    inputSchema: SearchRecordsSchema,
    handler: async (args) => {
      try {
        // Set default time range if not provided
        const now = new Date();
        const defaultStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const timeStart = args.timeRange?.start || defaultStart.toISOString();
        const timeEnd = args.timeRange?.end || now.toISOString();

        // Find capture files
        const captureFiles = await findCaptureFiles(storageDir, args.server);

        if (captureFiles.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: args.server
                  ? `📭 No capture files found for server '${args.server}'.`
                  : "📭 No capture files found in the gateway storage.",
              },
            ],
          };
        }

        // Load and filter records
        let allRecords: CaptureRecord[] = [];

        for (const file of captureFiles) {
          if (args.session && file.sessionId !== args.session) continue;

          const records = await parseJsonlFile(file.path);
          allRecords.push(...records);
        }

        // Apply filters progressively
        allRecords = filterByTimeRange(allRecords, timeStart, timeEnd);

        if (args.method) {
          allRecords = filterByMethod(allRecords, args.method);
        }

        if (args.messageType) {
          allRecords = filterByMessageType(allRecords, args.messageType);
        }

        if (args.hasError !== undefined) {
          allRecords = allRecords.filter((record) => {
            const hasError = !!record.response?.error;
            return args.hasError ? hasError : !hasError;
          });
        }

        // Sort by timestamp (newest first)
        allRecords.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        // Apply pagination
        const totalResults = allRecords.length;
        const paginatedRecords = allRecords.slice(
          args.offset || 0,
          (args.offset || 0) + (args.limit || 50),
        );

        if (totalResults === 0) {
          return {
            content: [
              {
                type: "text",
                text: "🔍 No records found matching your search criteria.\n\n**Suggestions:**\n- Expand time range\n- Remove or relax filters\n- Check server/session names for typos",
              },
            ],
          };
        }

        // Format results
        const recordsText = paginatedRecords
          .map((record, index) => {
            const number = (args.offset || 0) + index + 1;
            const formatted = formatConciseRecord(
              record,
              args.format === "detailed",
            );
            return `${number}. ${formatted}`;
          })
          .join("\n\n");

        const summary = `📊 Found ${totalResults} records (showing ${paginatedRecords.length})`;
        const pagination =
          totalResults > (args.limit || 50)
            ? `\n\n💡 Use offset=${(args.offset || 0) + (args.limit || 50)} to see more results.`
            : "";

        return {
          content: [
            {
              type: "text",
              text: `${summary}\n\n${recordsText}${pagination}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  });

}
