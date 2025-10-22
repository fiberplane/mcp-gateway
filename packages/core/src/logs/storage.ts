import type {
  CaptureRecord,
  LogQueryOptions,
  LogQueryResult,
  ServerHealth,
  ServerInfo,
  SessionInfo,
} from "@fiberplane/mcp-gateway-types";
import { and, count, desc, eq, gt, like, lt, sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { logger } from "../logger.js";
import type * as schema from "./schema.js";
import { type Log, logs, type NewLog } from "./schema.js";

/**
 * Insert a new log entry into the database
 */
export async function insertLog(
  db: BunSQLiteDatabase<typeof schema>,
  record: CaptureRecord,
): Promise<void> {
  const newLog: NewLog = {
    timestamp: record.timestamp,
    method: record.method,
    jsonrpcId: record.id === null ? null : String(record.id),
    serverName: record.metadata.serverName,
    sessionId: record.metadata.sessionId,
    durationMs: record.metadata.durationMs || 0,
    httpStatus: record.metadata.httpStatus || 0,
    requestJson: record.request ? JSON.stringify(record.request) : null,
    responseJson: record.response ? JSON.stringify(record.response) : null,
    errorJson: record.response?.error
      ? JSON.stringify(record.response.error)
      : null,
  };

  await db.insert(logs).values(newLog);
}

/**
 * Query logs with filtering and pagination
 */
export async function queryLogs(
  db: BunSQLiteDatabase<typeof schema>,
  options: LogQueryOptions = {},
): Promise<LogQueryResult> {
  const {
    serverName,
    sessionId,
    method,
    after,
    before,
    limit = 100,
    order = "desc",
  } = options;

  // Build where conditions
  const conditions = [];
  if (serverName) {
    conditions.push(eq(logs.serverName, serverName));
  }
  if (sessionId) {
    conditions.push(eq(logs.sessionId, sessionId));
  }
  if (method) {
    conditions.push(like(logs.method, `%${method}%`));
  }
  if (after) {
    conditions.push(gt(logs.timestamp, after));
  }
  if (before) {
    conditions.push(lt(logs.timestamp, before));
  }

  // Execute query
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const orderBy = order === "asc" ? logs.timestamp : desc(logs.timestamp);

  const rows = await db
    .select()
    .from(logs)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit + 1); // Fetch one extra to check hasMore

  // Check if there are more results
  const hasMore = rows.length > limit;
  const dataRows = hasMore ? rows.slice(0, limit) : rows;

  // Convert rows to CaptureRecords
  const data = dataRows.map(rowToRecord);

  // Calculate pagination info
  const oldestTimestamp =
    data.length > 0 ? (data[data.length - 1]?.timestamp ?? null) : null;
  const newestTimestamp = data.length > 0 ? (data[0]?.timestamp ?? null) : null;

  return {
    data,
    pagination: {
      count: data.length,
      limit,
      hasMore,
      oldestTimestamp,
      newestTimestamp,
    },
  };
}

/**
 * Get server aggregations with status
 *
 * @param db - Database instance
 * @param registryServers - Optional list of registered server names
 * @param serverHealthMap - Optional map of server names to health status
 * @returns Server information with status (online/offline/deleted)
 */
export async function getServers(
  db: BunSQLiteDatabase<typeof schema>,
  registryServers?: string[],
  serverHealthMap?: Map<string, ServerHealth>,
): Promise<ServerInfo[]> {
  // Get servers that have logs in the database
  const logsResult = await db
    .select({
      name: logs.serverName,
      logCount: count(logs.id),
      sessionCount: sql<number>`COUNT(DISTINCT ${logs.sessionId})`,
    })
    .from(logs)
    .groupBy(logs.serverName);
  // Note: No .orderBy() here since we sort the final result with localeCompare anyway

  // Create a map of registry servers (normalized name -> original name)
  // This preserves the registry's casing as the source of truth
  const registryMap = new Map<string, string>();
  const registryProvided = Array.isArray(registryServers);
  if (registryProvided) {
    for (const serverName of registryServers || []) {
      registryMap.set(serverName.toLowerCase(), serverName);
    }
  }

  // Create a map of servers from logs
  const serverMap = new Map<string, ServerInfo>();

  // Add servers from logs with their counts
  for (const server of logsResult) {
    const normalizedName = server.name.toLowerCase();
    const registryName = registryMap.get(normalizedName);

    // Determine status based on registry membership and health
    let status: "online" | "offline" | "not-found";
    if (registryProvided && registryName) {
      // Server is in registry - check health to determine online vs offline
      const health = serverHealthMap?.get(normalizedName);
      status =
        health === "down"
          ? "offline"
          : health === "up"
            ? "online"
            : "not-found";
    } else {
      // Server not in registry or no health data = not-found
      // Could be: deleted from registry, imported from external source, etc.
      status = "not-found";
    }

    serverMap.set(normalizedName, {
      ...server,
      // Use registry name for consistency if server is registered, otherwise use log name
      name: registryName || server.name,
      status,
    });
  }

  // Add servers from registry that don't have logs yet
  if (registryProvided) {
    for (const serverName of registryServers || []) {
      const normalizedName = serverName.toLowerCase();
      if (!serverMap.has(normalizedName)) {
        // New server in registry with no logs yet - check health
        const health = serverHealthMap?.get(normalizedName);
        const status = health === "down" ? "offline" : "online";

        serverMap.set(normalizedName, {
          name: serverName,
          logCount: 0,
          sessionCount: 0,
          status,
        });
      }
    }
  }

  // Convert to array and sort by name
  return Array.from(serverMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/**
 * Get session aggregations
 */
export async function getSessions(
  db: BunSQLiteDatabase<typeof schema>,
  serverName?: string,
): Promise<SessionInfo[]> {
  let query = db
    .select({
      sessionId: logs.sessionId,
      serverName: logs.serverName,
      logCount: count(logs.id),
      startTime: sql<string>`MIN(${logs.timestamp})`,
      endTime: sql<string>`MAX(${logs.timestamp})`,
    })
    .from(logs);

  if (serverName) {
    query = query.where(eq(logs.serverName, serverName)) as typeof query;
  }

  const result = await query
    .groupBy(logs.sessionId, logs.serverName)
    .orderBy(desc(sql`MIN(${logs.timestamp})`));

  return result as SessionInfo[];
}

/**
 * Safely parse JSON from database, handling corruption gracefully
 */
function safeJsonParse<T = unknown>(json: string | null): T | undefined {
  if (!json) return undefined;

  try {
    return JSON.parse(json) as T;
  } catch (error) {
    // Log warning but don't crash - corrupted data shouldn't break queries
    logger.warn("Failed to parse JSON from database", {
      jsonPreview: json.substring(0, 100),
      error: String(error),
    });
    return undefined;
  }
}

/**
 * Convert database row to CaptureRecord
 */
function rowToRecord(row: Log): CaptureRecord {
  return {
    timestamp: row.timestamp,
    method: row.method,
    id: row.jsonrpcId === null ? null : row.jsonrpcId,
    metadata: {
      serverName: row.serverName,
      sessionId: row.sessionId,
      durationMs: row.durationMs || 0,
      httpStatus: row.httpStatus || 0,
    },
    request: safeJsonParse(row.requestJson),
    response: safeJsonParse(row.responseJson),
  };
}
