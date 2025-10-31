import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Define the health status enum values
export const healthStatusValues = ["up", "down", "unknown"] as const;
export type HealthStatus = (typeof healthStatusValues)[number];

/**
 * SQLite table schema for MCP log entries
 *
 * This table stores all captured MCP traffic (requests, responses, errors, SSE events)
 * for fast querying and analysis.
 */
export const logs = sqliteTable(
  "logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    timestamp: text("timestamp").notNull(),
    method: text("method").notNull(),
    jsonrpcId: text("jsonrpc_id"),
    serverName: text("server_name").notNull(),
    sessionId: text("session_id").notNull(),
    durationMs: integer("duration_ms").default(0),
    httpStatus: integer("http_status").default(0),
    requestJson: text("request_json"),
    responseJson: text("response_json"),
    errorJson: text("error_json"),
    // Client identification from MCP initialize handshake
    clientName: text("client_name"),
    clientVersion: text("client_version"),
    clientTitle: text("client_title"),
    // Server identification from MCP initialize response
    serverVersion: text("server_version"),
    serverTitle: text("server_title"),
    serverInfoName: text("server_info_name"),
    // HTTP context for fallback identification
    userAgent: text("user_agent"),
    clientIp: text("client_ip"),
    // Token estimation for cost tracking
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    // Human-readable method detail for display and sorting
    methodDetail: text("method_detail"),
    // LLM correlation fields
    llmTraceId: text("llm_trace_id"),
    conversationId: text("conversation_id"),
  },
  (table) => ({
    // Index for time-based queries (newest first)
    timestampIdx: index("idx_timestamp").on(table.timestamp),
    // Index for filtering by server
    serverNameIdx: index("idx_server_name").on(table.serverName),
    // Index for filtering by session
    sessionIdIdx: index("idx_session_id").on(table.sessionId),
    // Composite index for common query pattern
    serverSessionIdx: index("idx_server_session").on(
      table.serverName,
      table.sessionId,
    ),
    // Index for filtering by client
    clientNameIdx: index("idx_client_name").on(table.clientName),
    // Composite index for client name + version filtering
    clientNameVersionIdx: index("idx_client_name_version").on(
      table.clientName,
      table.clientVersion,
    ),
    // Index for IP-based queries (debugging)
    clientIpIdx: index("idx_client_ip").on(table.clientIp),
    // Indexes for LLM correlation
    llmTraceIdIdx: index("idx_llm_trace_id").on(table.llmTraceId),
    conversationIdIdx: index("idx_conversation_id").on(table.conversationId),
  }),
);

export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;

/**
 * SQLite table schema for session metadata
 *
 * This table stores persistent session metadata (client and server information)
 * that survives gateway restarts and session clears. This ensures we can always
 * retrieve session metadata even when in-memory stores are empty.
 */
export const sessionMetadata = sqliteTable(
  "session_metadata",
  {
    sessionId: text("session_id").primaryKey(),
    serverName: text("server_name").notNull(),
    // Client identification from MCP initialize handshake
    clientName: text("client_name"),
    clientVersion: text("client_version"),
    clientTitle: text("client_title"),
    // Server identification from MCP initialize response
    serverVersion: text("server_version"),
    serverTitle: text("server_title"),
    serverInfoName: text("server_info_name"),
    // Timestamps for tracking session lifecycle
    firstSeen: text("first_seen").notNull(),
    lastSeen: text("last_seen").notNull(),
  },
  (table) => ({
    // Index for filtering by server
    serverNameIdx: index("session_metadata_idx_server_name").on(
      table.serverName,
    ),
    // Index for time-based queries
    lastSeenIdx: index("session_metadata_idx_last_seen").on(table.lastSeen),
  }),
);

export type SessionMetadata = typeof sessionMetadata.$inferSelect;
export type NewSessionMetadata = typeof sessionMetadata.$inferInsert;

/**
 * SQLite table schema for server health status
 *
 * This table stores the latest health check results for each registered server.
 * Updated periodically by the HealthCheckManager.
 */
export const serverHealth = sqliteTable("server_health", {
  serverName: text("server_name").primaryKey(),
  health: text("health", { enum: healthStatusValues }).notNull(),
  lastCheck: text("last_check").notNull(),
  url: text("url").notNull(),
});

export type ServerHealth = typeof serverHealth.$inferSelect;
export type NewServerHealth = typeof serverHealth.$inferInsert;

/**
 * SQLite table schema for LLM requests/responses
 *
 * This table stores all LLM API calls (OpenAI, Anthropic) that pass through
 * the gateway proxy. Used for correlating LLM calls with MCP tool invocations.
 */
export const llmRequests = sqliteTable(
  "llm_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uuid: text("uuid").notNull().unique(), // UUID for external reference
    traceId: text("trace_id").notNull(), // Links to logs.llm_trace_id
    conversationId: text("conversation_id").notNull(),
    timestamp: text("timestamp").notNull(),
    provider: text("provider", {
      enum: ["openai", "anthropic"],
    }).notNull(),
    model: text("model").notNull(),
    direction: text("direction", { enum: ["request", "response"] }).notNull(),

    // Request/response data
    requestBody: text("request_body"), // Full request JSON
    responseBody: text("response_body"), // Full response JSON
    finishReason: text("finish_reason"),
    streaming: integer("streaming", { mode: "boolean" }).default(false),

    // Metrics
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    durationMs: integer("duration_ms").default(0),
    httpStatus: integer("http_status").default(0),

    // Tool calls (for correlation)
    toolCallsJson: text("tool_calls_json"), // Extracted tool calls

    // HTTP context
    userAgent: text("user_agent"),
    clientIp: text("client_ip"),

    // Error information
    errorJson: text("error_json"),
  },
  (table) => ({
    // Index for correlation queries
    traceIdIdx: index("llm_trace_id_idx").on(table.traceId),
    conversationIdIdx: index("llm_conversation_id_idx").on(
      table.conversationId,
    ),
    // Index for time-based queries
    timestampIdx: index("llm_timestamp_idx").on(table.timestamp),
    // Composite indexes for common queries
    providerModelIdx: index("llm_provider_model_idx").on(
      table.provider,
      table.model,
    ),
    conversationTimestampIdx: index("llm_conversation_timestamp_idx").on(
      table.conversationId,
      table.timestamp,
    ),
  }),
);

export type LLMRequest = typeof llmRequests.$inferSelect;
export type NewLLMRequest = typeof llmRequests.$inferInsert;
