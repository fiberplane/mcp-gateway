import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  }),
);

export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;
