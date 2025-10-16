import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { z } from "zod";
import type {
	LogQueryOptions,
	LogQueryResult,
	ServerInfo,
	SessionInfo,
} from "@fiberplane/mcp-gateway-core";

/**
 * Query parameters schema for GET /logs
 */
const logsQuerySchema = z.object({
	server: z.string().optional(),
	session: z.string().optional(),
	method: z.string().optional(),
	after: z.string().datetime().optional(),
	before: z.string().datetime().optional(),
	limit: z.coerce.number().int().positive().max(1000).optional(),
	order: z.enum(["asc", "desc"]).optional(),
});

/**
 * Query parameters schema for GET /sessions
 */
const sessionsQuerySchema = z.object({
	server: z.string().optional(),
});

/**
 * Query functions interface for dependency injection
 */
export interface QueryFunctions {
	queryLogs: (
		storageDir: string,
		options?: LogQueryOptions,
	) => Promise<LogQueryResult>;
	getServers: (storageDir: string) => Promise<ServerInfo[]>;
	getSessions: (
		storageDir: string,
		serverName?: string,
	) => Promise<SessionInfo[]>;
}

/**
 * Create API routes for querying logs
 *
 * Routes:
 * - GET /logs - Query logs with filters and pagination
 * - GET /servers - List servers with aggregated stats
 * - GET /sessions - List sessions with aggregated stats
 *
 * @param storageDir - Storage directory path
 * @param queries - Query functions to use for data access
 * @returns Hono app with API routes
 */
export function createApiRoutes(
	storageDir: string,
	queries: QueryFunctions,
): Hono {
	const app = new Hono();

	/**
	 * GET /logs
	 *
	 * Query logs with optional filters and pagination
	 */
	app.get("/logs", sValidator("query", logsQuerySchema), async (c) => {
		const query = c.req.valid("query") as z.infer<typeof logsQuerySchema>;

		const options: LogQueryOptions = {
			serverName: query.server,
			sessionId: query.session,
			method: query.method,
			after: query.after,
			before: query.before,
			limit: query.limit,
			order: query.order,
		};

		const result = await queries.queryLogs(storageDir, options);

		return c.json(result);
	});

	/**
	 * GET /servers
	 *
	 * List all servers with log counts and session counts
	 */
	app.get("/servers", async (c) => {
		const servers = await queries.getServers(storageDir);

		return c.json({ servers });
	});

	/**
	 * GET /sessions
	 *
	 * List all sessions with log counts and time ranges
	 * Optionally filter by server name
	 */
	app.get("/sessions", sValidator("query", sessionsQuerySchema), async (c) => {
		const query = c.req.valid("query") as z.infer<typeof sessionsQuerySchema>;

		const sessions = await queries.getSessions(storageDir, query.server);

		return c.json({ sessions });
	});

	return app;
}
