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
  // Extended health check details
  lastCheckTime: integer("last_check_time"), // Timestamp in ms
  lastHealthyTime: integer("last_healthy_time"), // Timestamp in ms
  lastErrorTime: integer("last_error_time"), // Timestamp in ms
  errorMessage: text("error_message"),
  errorCode: text("error_code"),
  responseTimeMs: integer("response_time_ms"),
});

export type ServerHealth = typeof serverHealth.$inferSelect;
export type NewServerHealth = typeof serverHealth.$inferInsert;
