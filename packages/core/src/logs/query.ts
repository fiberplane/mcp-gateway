import type {
  LogQueryOptions,
  LogQueryResult,
  ServerInfo,
  SessionInfo,
} from "@fiberplane/mcp-gateway-types";
import { getDb } from "./db.js";
import { ensureMigrations } from "./migrations.js";
import {
  getServers as getServersInternal,
  getSessions as getSessionsInternal,
  queryLogs as queryLogsInternal,
} from "./storage.js";

// Re-export types for consumers
export type { LogQueryOptions, LogQueryResult, ServerInfo, SessionInfo };

/**
 * Query logs with filters and pagination
 *
 * Automatically runs migrations if needed
 *
 * @param storageDir - Path to storage directory
 * @param options - Query options (filters, pagination, ordering)
 * @returns Paginated log results
 */
export async function queryLogs(
  storageDir: string,
  options: LogQueryOptions = {},
): Promise<LogQueryResult> {
  const db = getDb(storageDir);
  await ensureMigrations(db);
  return queryLogsInternal(db, options);
}

/**
 * Get server aggregations
 *
 * Returns list of servers with log count and session count
 *
 * @param storageDir - Path to storage directory
 * @returns Server information list
 */
export async function getServers(storageDir: string): Promise<ServerInfo[]> {
  const db = getDb(storageDir);
  await ensureMigrations(db);
  return getServersInternal(db);
}

/**
 * Get session aggregations
 *
 * Returns list of sessions with log counts and time ranges
 *
 * @param storageDir - Path to storage directory
 * @param serverName - Optional server name filter
 * @returns Session information list
 */
export async function getSessions(
  storageDir: string,
  serverName?: string,
): Promise<SessionInfo[]> {
  const db = getDb(storageDir);
  await ensureMigrations(db);
  return getSessionsInternal(db, serverName);
}
