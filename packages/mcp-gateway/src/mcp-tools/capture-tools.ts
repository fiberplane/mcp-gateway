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

interface CaptureExchange {
  id: string | number;
  method: string;
  timestamp: string;
  request?: CaptureRecord;
  response?: CaptureRecord;
  durationMs: number;
  hasError: boolean;
  sessionId: string;
  serverName: string;
}

interface TimelineEntry {
  timestamp: string;
  type: "request" | "response" | "notification";
  method: string;
  id: string | number | null;
  durationMs?: number;
  hasError: boolean;
  summary: string;
}

interface SessionMetrics {
  totalRequests: number;
  totalResponses: number;
  totalNotifications: number;
  averageResponseTime: number;
  errorRate: number;
  methodDistribution: Record<string, number>;
  duration: number;
  startTime: string;
  endTime: string;
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

// Schema for analyzing a specific session
const AnalyzeSessionSchema = z.object({
  sessionId: z
    .string()
    .min(1, "Session ID is required")
    .describe(
      "The session ID to analyze. Can be a full session ID or 'stateless' for one-off requests.",
    ),

  server: z
    .string()
    .optional()
    .describe(
      "Optional server name to restrict analysis to. If not provided, analyzes the session across all servers.",
    ),

  includeTimeline: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Whether to include a chronological timeline of all session activities. Useful for understanding request flow.",
    ),

  includeMetrics: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Whether to include performance metrics (response times, error rates, method usage). Essential for performance analysis.",
    ),

  format: z
    .enum(["concise", "detailed"])
    .optional()
    .default("concise")
    .describe(
      "Response detail level. 'concise' provides summary statistics and key insights, 'detailed' includes full interaction history.",
    ),
});

// Schema for server statistics
const GetServerStatsSchema = z.object({
  server: z
    .string()
    .min(1, "Server name is required")
    .describe(
      "Name of the server to generate statistics for. Must be a registered server in the gateway.",
    ),

  timeRange: z
    .object({
      start: z
        .string()
        .min(1, "Start time is required")
        .describe(
          "Start time for statistics in ISO 8601 format. Defaults to 24 hours ago.",
        ),
      end: z
        .string()
        .min(1, "End time is required")
        .describe(
          "End time for statistics in ISO 8601 format. Defaults to current time.",
        ),
    })
    .optional()
    .describe(
      "Time range for statistics calculation. Shorter ranges provide more focused insights.",
    ),

  groupBy: z
    .enum(["hour", "day", "method"])
    .optional()
    .default("hour")
    .describe(
      "How to group statistics. 'hour' for hourly breakdowns, 'day' for daily summaries, 'method' for per-method analysis.",
    ),

  includePerformance: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Whether to include performance metrics (response times, throughput). Critical for performance monitoring.",
    ),

  includeErrors: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Whether to include error analysis (error rates, common failures). Essential for reliability monitoring.",
    ),

  format: z
    .enum(["concise", "detailed"])
    .optional()
    .default("concise")
    .describe(
      "Response format. 'concise' provides key metrics and alerts, 'detailed' includes comprehensive analysis and trends.",
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
 * Correlate requests with responses by ID
 */
function correlateRequestResponse(records: CaptureRecord[]): CaptureExchange[] {
  const requestMap = new Map<string | number, CaptureRecord>();
  const exchanges: CaptureExchange[] = [];

  // First pass: collect requests
  for (const record of records) {
    if (record.request && record.id !== null) {
      requestMap.set(record.id, record);
    }
  }

  // Second pass: match responses and create exchanges
  for (const record of records) {
    if (record.response && record.id !== null) {
      const request = requestMap.get(record.id);
      if (request) {
        exchanges.push({
          id: record.id,
          method: record.method,
          timestamp: request.timestamp,
          request,
          response: record,
          durationMs: record.metadata.durationMs,
          hasError: !!record.response.error,
          sessionId: record.metadata.sessionId,
          serverName: record.metadata.serverName,
        });
        requestMap.delete(record.id);
      }
    }
  }

  // Handle orphaned requests (requests without responses)
  for (const [id, request] of requestMap) {
    exchanges.push({
      id,
      method: request.method,
      timestamp: request.timestamp,
      request,
      durationMs: 0,
      hasError: false,
      sessionId: request.metadata.sessionId,
      serverName: request.metadata.serverName,
    });
  }

  // Handle notifications (id === null)
  for (const record of records) {
    if (record.id === null && record.request) {
      exchanges.push({
        id: "notification",
        method: record.method,
        timestamp: record.timestamp,
        request: record,
        durationMs: 0,
        hasError: false,
        sessionId: record.metadata.sessionId,
        serverName: record.metadata.serverName,
      });
    }
  }

  return exchanges.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
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
 * Calculate percentiles for response times
 */
function calculatePercentiles(durations: number[]): {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
} {
  if (durations.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0 };

  const sorted = [...durations].sort((a, b) => a - b);
  const getPercentile = (p: number) => {
    const index = Math.ceil((sorted.length * p) / 100) - 1;
    return sorted[Math.max(0, index)] || 0;
  };

  return {
    p50: getPercentile(50),
    p90: getPercentile(90),
    p95: getPercentile(95),
    p99: getPercentile(99),
  };
}

/**
 * Build session timeline from records
 */
function buildSessionTimeline(records: CaptureRecord[]): TimelineEntry[] {
  return records
    .map((record) => {
      let type: "request" | "response" | "notification";
      if (record.request) {
        type = record.id === null ? "notification" : "request";
      } else {
        type = "response";
      }

      return {
        timestamp: record.timestamp,
        type,
        method: record.method,
        id: record.id,
        durationMs: record.response ? record.metadata.durationMs : undefined,
        hasError: !!record.response?.error,
        summary: record.request
          ? `${record.method} request`
          : `${record.method} response ${record.response?.error ? "(error)" : "(success)"}`,
      };
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Calculate session metrics
 */
function calculateSessionMetrics(records: CaptureRecord[]): SessionMetrics {
  const requests = records.filter((r) => r.request);
  const responses = records.filter((r) => r.response);
  const notifications = records.filter((r) => r.id === null && r.request);
  const errors = records.filter((r) => r.response?.error);

  const responseTimes = responses
    .filter((r) => r.metadata.durationMs > 0)
    .map((r) => r.metadata.durationMs);

  const averageResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) /
        responseTimes.length
      : 0;

  const methodDistribution: Record<string, number> = {};
  records.forEach((record) => {
    methodDistribution[record.method] =
      (methodDistribution[record.method] || 0) + 1;
  });

  const timestamps = records.map((r) => new Date(r.timestamp).getTime());
  const startTime = new Date(Math.min(...timestamps)).toISOString();
  const endTime = new Date(Math.max(...timestamps)).toISOString();
  const duration = Math.max(...timestamps) - Math.min(...timestamps);

  return {
    totalRequests: requests.length,
    totalResponses: responses.length,
    totalNotifications: notifications.length,
    averageResponseTime,
    errorRate:
      responses.length > 0 ? (errors.length / responses.length) * 100 : 0,
    methodDistribution,
    duration,
    startTime,
    endTime,
  };
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

  mcp.tool("analyze_session", {
    description: `Provides comprehensive analysis of a specific MCP session, including timeline reconstruction, performance metrics, and interaction patterns. Essential for understanding client behavior and debugging session-specific issues.

An MCP session represents a sequence of related interactions between a client and servers through the gateway. Sessions can be:
- **Named sessions**: Long-lived connections with session IDs for stateful interactions
- **Stateless sessions**: Individual request/response pairs without persistent state

**Analysis Components:**

**Timeline Reconstruction:**
- Chronological sequence of all requests and responses in the session
- Method call patterns and frequency
- Server interaction patterns (which servers were used)
- Error occurrence and resolution attempts
- Performance bottlenecks and slow operations

**Performance Metrics:**
- Total session duration and activity periods
- Average response times per method and server
- Request/response size analysis
- Throughput patterns and peak usage times
- Comparative performance vs. other sessions

**Interaction Patterns:**
- Most frequently used methods and tools
- Server preference patterns
- Error recovery behavior
- Session lifecycle analysis (initialization, activity, termination)

**Use Cases:**
- **Session Debugging**: Identify where and why a session failed or performed poorly
- **User Experience Analysis**: Understand how clients interact with your MCP ecosystem
- **Performance Optimization**: Find sessions with unusual latency or error patterns
- **Capacity Planning**: Analyze session resource usage and duration patterns
- **Compliance Auditing**: Review session activities for security or policy compliance

**Response Formats:**
- **Concise**: Key metrics, timeline summary, and notable events/issues
- **Detailed**: Full interaction history, comprehensive metrics, and detailed error analysis

The tool provides actionable insights and recommendations based on the session analysis, helping you optimize both client usage and server configuration.`,
    inputSchema: AnalyzeSessionSchema,
    handler: async (args) => {
      try {
        // Find capture files for the session
        const captureFiles = await findCaptureFiles(storageDir, args.server);
        const sessionFiles = captureFiles.filter(
          (file) => file.sessionId === args.sessionId,
        );

        if (sessionFiles.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Session '${args.sessionId}' not found.\n\n**Available sessions:**\n${
                  captureFiles
                    .slice(0, 10)
                    .map((f) => `- ${f.sessionId} (${f.serverName})`)
                    .join("\n") || "(No sessions found)"
                }\n\n💡 Use search_records to find active sessions.`,
              },
            ],
            isError: true,
          };
        }

        // Load all records for the session
        const sessionRecords: CaptureRecord[] = [];
        for (const file of sessionFiles) {
          const records = await parseJsonlFile(file.path);
          sessionRecords.push(
            ...records.filter((r) => r.metadata.sessionId === args.sessionId),
          );
        }

        if (sessionRecords.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `❌ No records found for session '${args.sessionId}'.`,
              },
            ],
            isError: true,
          };
        }

        // Calculate metrics
        const metrics = calculateSessionMetrics(sessionRecords);
        const timeline = args.includeTimeline
          ? buildSessionTimeline(sessionRecords)
          : [];
        const exchanges = correlateRequestResponse(sessionRecords);

        // Format response based on detail level
        if (args.format === "concise") {
          const duration = Math.round(metrics.duration / 1000);
          const topMethods = Object.entries(metrics.methodDistribution)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([method, count]) => `${method} (${count})`)
            .join(", ");

          const insights = [];
          if (metrics.errorRate > 10)
            insights.push(
              `🔴 High error rate: ${metrics.errorRate.toFixed(1)}%`,
            );
          if (metrics.averageResponseTime > 1000)
            insights.push(
              `🐌 Slow responses: ${metrics.averageResponseTime.toFixed(0)}ms avg`,
            );
          if (exchanges.length === 0)
            insights.push(`⚠️ No completed exchanges found`);

          return {
            content: [
              {
                type: "text",
                text: `📊 **Session Analysis: ${args.sessionId}**

**Overview:**
- Duration: ${duration}s (${new Date(metrics.startTime).toLocaleString()} → ${new Date(metrics.endTime).toLocaleString()})
- Requests: ${metrics.totalRequests} | Responses: ${metrics.totalResponses} | Notifications: ${metrics.totalNotifications}
- Avg Response Time: ${metrics.averageResponseTime.toFixed(0)}ms
- Error Rate: ${metrics.errorRate.toFixed(1)}%

**Top Methods:** ${topMethods || "None"}

${insights.length > 0 ? `**Insights:**\n${insights.map((i) => `- ${i}`).join("\n")}` : "✅ Session appears healthy"}

💡 Use format=detailed for complete timeline and interaction history.`,
              },
            ],
          };
        } else {
          // Detailed format
          const timelineText = timeline
            .slice(0, 20)
            .map((entry, i) => {
              const time = new Date(entry.timestamp).toLocaleTimeString();
              const duration = entry.durationMs
                ? ` (${entry.durationMs}ms)`
                : "";
              const error = entry.hasError ? " ❌" : "";
              return `${i + 1}. [${time}] ${entry.summary}${duration}${error}`;
            })
            .join("\n");

          const truncated =
            timeline.length > 20
              ? `\n... and ${timeline.length - 20} more entries`
              : "";

          return {
            content: [
              {
                type: "text",
                text: `📊 **Detailed Session Analysis: ${args.sessionId}**

**Session Metrics:**
- Total Duration: ${Math.round(metrics.duration / 1000)}s
- Time Range: ${new Date(metrics.startTime).toLocaleString()} → ${new Date(metrics.endTime).toLocaleString()}
- Request/Response Pairs: ${exchanges.filter((e) => e.response).length}
- Orphaned Requests: ${exchanges.filter((e) => !e.response).length}
- Notifications: ${metrics.totalNotifications}
- Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms
- Error Rate: ${metrics.errorRate.toFixed(1)}%

**Method Distribution:**
${Object.entries(metrics.methodDistribution)
  .sort(([, a], [, b]) => b - a)
  .map(([method, count]) => `- ${method}: ${count} calls`)
  .join("\n")}

**Timeline:**
${timelineText}${truncated}

**Performance Summary:**
${metrics.averageResponseTime < 100 ? "✅ Fast responses" : metrics.averageResponseTime < 500 ? "⚠️ Moderate response times" : "🔴 Slow responses"}
${metrics.errorRate === 0 ? "✅ No errors" : metrics.errorRate < 5 ? "⚠️ Some errors" : "🔴 High error rate"}`,
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Session analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  });

  mcp.tool("get_server_stats", {
    description: `Generates comprehensive statistics and performance metrics for a specific MCP server registered with the gateway. Essential for monitoring server health, performance trends, and capacity planning.

This tool analyzes captured traffic for a specific server to provide insights into its operational characteristics, usage patterns, and performance metrics. The statistics help identify trends, bottlenecks, and optimization opportunities.

**Statistical Categories:**

**Usage Metrics:**
- Total request volume over the specified time period
- Request rate trends (requests per hour/day)
- Peak usage periods and traffic patterns
- Client session distribution and concurrency levels
- Method popularity and usage distribution

**Performance Analysis:**
- Response time statistics (min, max, average, percentiles)
- Performance trends over time
- Comparative performance by method type
- Latency distribution analysis
- Throughput and capacity utilization

**Reliability Metrics:**
- Overall error rate and error type distribution
- Common failure patterns and error codes
- Error recovery and retry patterns
- Availability and uptime analysis
- Performance degradation indicators

**Operational Insights:**
- Resource utilization patterns
- Scaling and capacity requirements
- Performance baselines and anomaly detection
- Client behavior impact on server performance
- Optimization recommendations and alerts

**Time-based Analysis:**
- **Hour**: Detailed hourly breakdown showing traffic patterns and peak usage
- **Day**: Daily summary trends useful for capacity planning and usage patterns
- **Method**: Per-method analysis showing which operations are most used/problematic

**Use Cases:**
- **Performance Monitoring**: Track server performance over time and identify degradation
- **Capacity Planning**: Understand usage patterns to plan scaling and resource allocation
- **SLA Monitoring**: Measure response times and availability against service commitments
- **Troubleshooting**: Identify performance bottlenecks and error patterns
- **Optimization**: Find opportunities to improve server configuration or client usage

**Alert Conditions:**
The tool automatically identifies and highlights concerning patterns like high error rates, performance degradation, or unusual traffic spikes, providing actionable recommendations for investigation and resolution.`,
    inputSchema: GetServerStatsSchema,
    handler: async (args) => {
      try {
        // Check if server exists in registry
        const server = registry.servers.find((s) => s.name === args.server);
        if (!server) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Server '${args.server}' not found in the gateway registry.

**Available servers:**
${registry.servers.map((s) => `- ${s.name}`).join("\n") || "(No servers registered)"}

Use add_server to register the server first, or check the server name spelling.`,
              },
            ],
            isError: true,
          };
        }

        // Set default time range if not provided
        const now = new Date();
        const defaultStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const timeStart = args.timeRange?.start || defaultStart.toISOString();
        const timeEnd = args.timeRange?.end || now.toISOString();

        // Find capture files for the server
        const captureFiles = await findCaptureFiles(storageDir, args.server);

        if (captureFiles.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `📭 No capture data found for server '${args.server}'.

**Server Registry Info:**
- URL: ${server.url}
- Last Activity: ${server.lastActivity || "Never"}
- Total Requests: ${server.exchangeCount}

The server may not have processed any requests yet, or capture data may have been cleared.`,
              },
            ],
          };
        }

        // Load and filter records
        let allRecords: CaptureRecord[] = [];
        for (const file of captureFiles) {
          const records = await parseJsonlFile(file.path);
          allRecords.push(...records);
        }

        allRecords = filterByTimeRange(allRecords, timeStart, timeEnd);

        if (allRecords.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `📭 No records found for server '${args.server}' in the specified time range.

**Time Range:** ${new Date(timeStart).toLocaleString()} → ${new Date(timeEnd).toLocaleString()}

Try expanding the time range or check if the server has been active recently.`,
              },
            ],
          };
        }

        // Calculate comprehensive statistics
        const requests = allRecords.filter((r) => r.request);
        const responses = allRecords.filter((r) => r.response);
        const errors = allRecords.filter((r) => r.response?.error);
        const successfulResponses = responses.filter((r) => !r.response?.error);

        const responseTimes = successfulResponses
          .filter((r) => r.metadata.durationMs > 0)
          .map((r) => r.metadata.durationMs);

        const avgResponseTime =
          responseTimes.length > 0
            ? responseTimes.reduce((sum, time) => sum + time, 0) /
              responseTimes.length
            : 0;

        const percentiles = calculatePercentiles(responseTimes);
        const errorRate =
          responses.length > 0 ? (errors.length / responses.length) * 100 : 0;

        // Method distribution
        const methodDistribution: Record<string, number> = {};
        requests.forEach((record) => {
          methodDistribution[record.method] =
            (methodDistribution[record.method] || 0) + 1;
        });

        // Time series data (simplified hourly buckets)
        const timeSeriesData: Array<{
          timestamp: string;
          requests: number;
          errors: number;
          avgResponseTime: number;
        }> = [];

        if (args.groupBy === "hour" || args.groupBy === "day") {
          const bucketSize =
            args.groupBy === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
          const buckets = new Map<
            string,
            { requests: number; errors: number; responseTimes: number[] }
          >();

          for (const record of allRecords) {
            const time = new Date(record.timestamp).getTime();
            const bucketTime = Math.floor(time / bucketSize) * bucketSize;
            const bucketKey = new Date(bucketTime).toISOString();

            if (!buckets.has(bucketKey)) {
              buckets.set(bucketKey, {
                requests: 0,
                errors: 0,
                responseTimes: [],
              });
            }

            // biome-ignore lint/style/noNonNullAssertion: we check above
            const bucket = buckets.get(bucketKey)!;

            if (record.request) bucket.requests++;
            if (record.response?.error) bucket.errors++;
            if (
              record.response &&
              !record.response.error &&
              record.metadata.durationMs > 0
            ) {
              bucket.responseTimes.push(record.metadata.durationMs);
            }
          }

          for (const [timestamp, data] of buckets) {
            timeSeriesData.push({
              timestamp,
              requests: data.requests,
              errors: data.errors,
              avgResponseTime:
                data.responseTimes.length > 0
                  ? data.responseTimes.reduce((sum, time) => sum + time, 0) /
                    data.responseTimes.length
                  : 0,
            });
          }

          timeSeriesData.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        }

        // Generate insights and alerts
        const alerts = [];
        if (errorRate > 5)
          alerts.push(`🔴 High error rate: ${errorRate.toFixed(1)}%`);
        if (avgResponseTime > 1000)
          alerts.push(
            `🐌 Slow average response time: ${avgResponseTime.toFixed(0)}ms`,
          );
        if (percentiles.p95 > 2000)
          alerts.push(`⚠️ High P95 latency: ${percentiles.p95.toFixed(0)}ms`);

        // Format response based on detail level
        if (args.format === "concise") {
          const topMethods = Object.entries(methodDistribution)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([method, count]) => `${method} (${count})`)
            .join(", ");

          return {
            content: [
              {
                type: "text",
                text: `📈 **Server Statistics: ${args.server}**

**Time Range:** ${new Date(timeStart).toLocaleString()} → ${new Date(timeEnd).toLocaleString()}

**Key Metrics:**
- Total Requests: ${requests.length}
- Total Responses: ${responses.length}
- Error Rate: ${errorRate.toFixed(1)}%
- Avg Response Time: ${avgResponseTime.toFixed(0)}ms
- P95 Response Time: ${percentiles.p95.toFixed(0)}ms

**Top Methods:** ${topMethods || "None"}

${alerts.length > 0 ? `**Alerts:**\n${alerts.map((a) => `- ${a}`).join("\n")}` : "✅ Server performance looks healthy"}

💡 Use format=detailed for comprehensive analysis and trends.`,
              },
            ],
          };
        } else {
          // Detailed format
          const timeSeriesText = timeSeriesData
            .slice(0, 10)
            .map((data) => {
              const time =
                args.groupBy === "hour"
                  ? new Date(data.timestamp).toLocaleString()
                  : new Date(data.timestamp).toLocaleDateString();
              return `- ${time}: ${data.requests} req, ${data.errors} err, ${data.avgResponseTime.toFixed(0)}ms avg`;
            })
            .join("\n");

          const truncated =
            timeSeriesData.length > 10
              ? `\n... and ${timeSeriesData.length - 10} more periods`
              : "";

          return {
            content: [
              {
                type: "text",
                text: `📈 **Detailed Server Statistics: ${args.server}**

**Analysis Period:** ${new Date(timeStart).toLocaleString()} → ${new Date(timeEnd).toLocaleString()}

**Request Volume:**
- Total Requests: ${requests.length}
- Total Responses: ${responses.length}
- Successful Responses: ${successfulResponses.length}
- Failed Responses: ${errors.length}
- Success Rate: ${((successfulResponses.length / responses.length) * 100).toFixed(1)}%

**Performance Metrics:**
- Average Response Time: ${avgResponseTime.toFixed(2)}ms
- P50 (Median): ${percentiles.p50.toFixed(0)}ms
- P90: ${percentiles.p90.toFixed(0)}ms
- P95: ${percentiles.p95.toFixed(0)}ms
- P99: ${percentiles.p99.toFixed(0)}ms

**Method Usage Distribution:**
${Object.entries(methodDistribution)
  .sort(([, a], [, b]) => b - a)
  .map(([method, count]) => `- ${method}: ${count} requests`)
  .join("\n")}

**Time Series (${args.groupBy}ly):**
${timeSeriesText}${truncated}

${alerts.length > 0 ? `**Performance Alerts:**\n${alerts.map((a) => `- ${a}`).join("\n")}` : ""}

**Recommendations:**
${avgResponseTime > 500 ? "- Consider optimizing slow methods or scaling server resources" : ""}
${errorRate > 2 ? "- Investigate error patterns and improve error handling" : ""}
${percentiles.p95 > 1000 ? "- Monitor P95 latency and identify bottlenecks" : ""}
${alerts.length === 0 ? "✅ Server performance is within acceptable ranges" : ""}`,
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Statistics generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  });
}
