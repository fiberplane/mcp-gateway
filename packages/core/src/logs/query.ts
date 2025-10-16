import { getDb } from "./db.js";
import { ensureMigrations } from "./migrations.js";
import {
	queryLogs as queryLogsInternal,
	getServers as getServersInternal,
	getSessions as getSessionsInternal,
	type LogQueryOptions,
	type LogQueryResult,
	type ServerInfo,
	type SessionInfo,
} from "./storage.js";

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
