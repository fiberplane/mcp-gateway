import type {
  CaptureRecord,
  ClientAggregation,
  HealthStatus,
  LogQueryOptions,
  LogQueryResult,
  ServerInfo,
  SessionInfo,
} from "@fiberplane/mcp-gateway-types";
import { and, count, desc, eq, gt, like, lt, sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { logger } from "../logger.js";
import type * as schema from "./schema.js";
import {
  type Log,
  logs,
  type NewLog,
  type NewServerHealth,
  type NewSessionMetadata,
  serverHealth,
  sessionMetadata,
} from "./schema.js";

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
    // Client identification from MCP initialize handshake
    clientName: record.metadata.client?.name ?? null,
    clientVersion: record.metadata.client?.version ?? null,
    clientTitle: record.metadata.client?.title ?? null,
    // Server identification from MCP initialize response
    serverVersion: record.metadata.server?.version ?? null,
    serverTitle: record.metadata.server?.title ?? null,
    serverInfoName:
      record.metadata.server?.name ?? record.metadata.serverName ?? null,
    // HTTP context for fallback identification
    userAgent: record.metadata.userAgent ?? null,
    clientIp: record.metadata.clientIp ?? null,
  };

  // Use transaction to ensure atomicity of log insert and metadata upsert
  await db.transaction(async (tx) => {
    await tx.insert(logs).values(newLog);

    // Also persist session metadata for this session
    // This ensures metadata survives restarts and cache clears
    if (record.metadata.client || record.metadata.server) {
      await upsertSessionMetadata(tx, {
        sessionId: record.metadata.sessionId,
        serverName: record.metadata.serverName,
        client: record.metadata.client,
        server: record.metadata.server,
      });
    }
  });
}

/**
 * Update server info for an initialize request after getting the response
 *
 * This backfills server metadata on the initialize request record,
 * which was captured before the response containing serverInfo was received.
 */
export async function updateServerInfoForInitializeRequest(
  db: BunSQLiteDatabase<typeof schema>,
  serverName: string,
  sessionId: string,
  requestId: string | number,
  serverInfo: { name?: string; version: string; title?: string },
): Promise<void> {
  await db
    .update(logs)
    .set({
      serverInfoName: serverInfo.name ?? serverName,
      serverVersion: serverInfo.version,
      serverTitle: serverInfo.title ?? null,
    })
    .where(
      and(
        eq(logs.serverName, serverName),
        eq(logs.sessionId, sessionId),
        eq(logs.method, "initialize"),
        eq(logs.jsonrpcId, String(requestId)),
        sql`${logs.requestJson} IS NOT NULL`, // Only update request records
      ),
    );
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
    clientName,
    clientVersion,
    clientIp,
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
  if (clientName) {
    conditions.push(eq(logs.clientName, clientName));
  }
  if (clientVersion) {
    conditions.push(eq(logs.clientVersion, clientVersion));
  }
  if (clientIp) {
    conditions.push(eq(logs.clientIp, clientIp));
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
 * @returns Server information with status (online/offline/not-found)
 */
export async function getServers(
  db: BunSQLiteDatabase<typeof schema>,
  registryServers?: string[],
): Promise<ServerInfo[]> {
  // Get servers that have logs in the database, with health data
  const logsResult = await db
    .select({
      name: logs.serverName,
      logCount: count(logs.id),
      sessionCount: sql<number>`COUNT(DISTINCT ${logs.sessionId})`,
      health: serverHealth.health,
    })
    .from(logs)
    .leftJoin(serverHealth, eq(logs.serverName, serverHealth.serverName))
    .groupBy(logs.serverName, serverHealth.health)
    .orderBy(sql`LOWER(${logs.serverName}) COLLATE NOCASE`);

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
      const health = server.health;
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
      name: registryName || server.name,
      logCount: server.logCount,
      sessionCount: server.sessionCount,
      status,
    });
  }

  // Add servers from registry that don't have logs yet
  if (registryProvided) {
    for (const serverName of registryServers || []) {
      const normalizedName = serverName.toLowerCase();
      if (!serverMap.has(normalizedName)) {
        // New server in registry with no logs yet - check health from database
        const healthData = await getServerHealth(db, serverName);
        const status = healthData?.health === "down" ? "offline" : "online";

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
  // Database already sorted by LOWER(name), but we apply localeCompare as a safety net
  // for consistency in case the map operations affect the order
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
 * Get client aggregations
 */
export async function getClients(
  db: BunSQLiteDatabase<typeof schema>,
): Promise<ClientAggregation[]> {
  const result = await db
    .select({
      clientName: logs.clientName,
      clientVersion: logs.clientVersion,
      logCount: count(logs.id),
      sessionCount: sql<number>`COUNT(DISTINCT ${logs.sessionId})`,
    })
    .from(logs)
    .where(sql`${logs.clientName} IS NOT NULL`)
    .groupBy(logs.clientName, logs.clientVersion)
    .orderBy(logs.clientName);

  return result as ClientAggregation[];
}

/**
 * Get method aggregations
 *
 * Returns all unique methods with log counts, optionally filtered by server.
 */
export async function getMethods(
  db: BunSQLiteDatabase<typeof schema>,
  serverName?: string,
): Promise<Array<{ method: string; logCount: number }>> {
  let query = db
    .select({
      method: logs.method,
      logCount: count(logs.id),
    })
    .from(logs);

  if (serverName) {
    query = query.where(eq(logs.serverName, serverName)) as typeof query;
  }

  const result = await query.groupBy(logs.method).orderBy(logs.method);

  return result as Array<{ method: string; logCount: number }>;
}

/**
 * Get server metrics (derived from logs)
 *
 * Returns activity metrics for a specific server that are computed
 * from the logs table rather than stored in the registry.
 */
export async function getServerMetrics(
  db: BunSQLiteDatabase<typeof schema>,
  serverName: string,
): Promise<{ lastActivity: string | null; exchangeCount: number }> {
  const result = await db
    .select({
      lastActivity: sql<string | null>`MAX(${logs.timestamp})`,
      exchangeCount: count(logs.id),
    })
    .from(logs)
    .where(eq(logs.serverName, serverName));

  const row = result[0];
  return {
    lastActivity: row?.lastActivity ?? null,
    exchangeCount: row?.exchangeCount ?? 0,
  };
}

/**
 * Upsert server health (insert or update)
 *
 * This persists server health check results to SQLite,
 * allowing queries to access live health status.
 */
export async function upsertServerHealth(
  db: BunSQLiteDatabase<typeof schema>,
  data: {
    serverName: string;
    health: HealthStatus;
    lastCheck: string;
    url: string;
  },
): Promise<void> {
  const health: NewServerHealth = {
    serverName: data.serverName,
    health: data.health,
    lastCheck: data.lastCheck,
    url: data.url,
  };

  await db
    .insert(serverHealth)
    .values(health)
    .onConflictDoUpdate({
      target: serverHealth.serverName,
      set: {
        health: health.health,
        lastCheck: health.lastCheck,
        url: health.url,
      },
    });
}

/**
 * Get server health by server name
 *
 * Returns null if health data doesn't exist in the database.
 */
export async function getServerHealth(
  db: BunSQLiteDatabase<typeof schema>,
  serverName: string,
): Promise<{
  health: HealthStatus;
  lastCheck: string;
  url: string;
} | null> {
  const result = await db
    .select()
    .from(serverHealth)
    .where(eq(serverHealth.serverName, serverName))
    .limit(1);

  const row = result[0];
  if (!row) {
    return null;
  }

  return {
    health: row.health as HealthStatus,
    lastCheck: row.lastCheck,
    url: row.url,
  };
}

/**
 * Future enhancement: Add pruneServerLogs function for cleanup of historical data
 *
 * Purpose: Allow users to delete logs for removed servers to reclaim disk space
 * and improve query performance for large databases.
 *
 * Proposed signature:
 * ```typescript
 * export async function pruneServerLogs(
 *   db: BunSQLiteDatabase<typeof schema>,
 *   serverName: string
 * ): Promise<number>
 * ```
 *
 * Implementation approach:
 * 1. Delete logs matching the serverName using `db.delete(logs).where(eq(logs.serverName, serverName))`
 * 2. Optionally clean up orphaned session_metadata records for that server
 * 3. Return the count of deleted rows for feedback
 * 4. Consider adding a timestamp filter to prune only old logs (e.g., older than 30 days)
 *
 * Use cases:
 * - User removes a server from the registry and wants to clean up its logs
 * - Periodic cleanup of test/development server logs
 * - Disk space management for long-running gateways
 *
 * Considerations:
 * - Should be exposed via the Gateway API under `logs.pruneServer(serverName)`
 * - May want to add a confirmation prompt in the CLI before deletion
 * - Consider adding a "dry run" option to preview deletion count
 */

/**
 * Upsert session metadata (insert or update)
 *
 * This persists session metadata to SQLite, ensuring it survives
 * gateway restarts and in-memory cache clears.
 */
export async function upsertSessionMetadata(
  db: BunSQLiteDatabase<typeof schema>,
  data: {
    sessionId: string;
    serverName: string;
    client?: { name: string; version: string; title?: string };
    server?: { name?: string; version: string; title?: string };
  },
): Promise<void> {
  const timestamp = new Date().toISOString();

  const metadata: NewSessionMetadata = {
    sessionId: data.sessionId,
    serverName: data.serverName,
    clientName: data.client?.name ?? null,
    clientVersion: data.client?.version ?? null,
    clientTitle: data.client?.title ?? null,
    serverVersion: data.server?.version ?? null,
    serverTitle: data.server?.title ?? null,
    serverInfoName: data.server?.name ?? data.serverName ?? null,
    firstSeen: timestamp,
    lastSeen: timestamp,
  };

  await db
    .insert(sessionMetadata)
    .values(metadata)
    .onConflictDoUpdate({
      target: sessionMetadata.sessionId,
      set: {
        // Update only lastSeen and metadata fields
        lastSeen: timestamp,
        clientName: metadata.clientName,
        clientVersion: metadata.clientVersion,
        clientTitle: metadata.clientTitle,
        serverVersion: metadata.serverVersion,
        serverTitle: metadata.serverTitle,
        serverInfoName: metadata.serverInfoName,
      },
    });
}

/**
 * Get session metadata by sessionId
 *
 * Returns null if session metadata doesn't exist in the database.
 */
export async function getSessionMetadata(
  db: BunSQLiteDatabase<typeof schema>,
  sessionId: string,
): Promise<{
  client?: { name: string; version: string; title?: string };
  server?: { name?: string; version: string; title?: string };
} | null> {
  const result = await db
    .select()
    .from(sessionMetadata)
    .where(eq(sessionMetadata.sessionId, sessionId))
    .limit(1);

  const row = result[0];
  if (!row) {
    return null;
  }

  // Reconstruct client info if any fields are present
  const client =
    row.clientName || row.clientVersion || row.clientTitle
      ? {
          name: row.clientName ?? "",
          version: row.clientVersion ?? "",
          title: row.clientTitle ?? undefined,
        }
      : undefined;

  // Reconstruct server info if any fields are present
  const server = row.serverVersion
    ? {
        name: row.serverInfoName ?? row.serverName,
        version: row.serverVersion,
        title: row.serverTitle ?? undefined,
      }
    : undefined;

  // Return null if neither client nor server info exists
  if (!client && !server) {
    return null;
  }

  return { client, server };
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
  // Reconstruct client info if any fields are present
  const client =
    row.clientName || row.clientVersion || row.clientTitle
      ? {
          name: row.clientName ?? "",
          version: row.clientVersion ?? "",
          title: row.clientTitle ?? undefined,
        }
      : undefined;

  // Reconstruct server info if any fields are present
  const server = row.serverVersion
    ? {
        name: row.serverInfoName ?? row.serverName,
        version: row.serverVersion,
        title: row.serverTitle ?? undefined,
      }
    : undefined;

  return {
    timestamp: row.timestamp,
    method: row.method,
    id: row.jsonrpcId === null ? null : row.jsonrpcId,
    metadata: {
      serverName: row.serverName,
      sessionId: row.sessionId,
      durationMs: row.durationMs || 0,
      httpStatus: row.httpStatus || 0,
      client,
      server,
      userAgent: row.userAgent ?? undefined,
      clientIp: row.clientIp ?? undefined,
    },
    request: safeJsonParse(row.requestJson),
    response: safeJsonParse(row.responseJson),
  };
}
