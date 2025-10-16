import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { z } from "zod";
import {
	queryLogs,
	getServers,
	getSessions,
	type LogQueryOptions,
} from "@fiberplane/mcp-gateway-core";

/**
 * Query parameters schema for GET /api/logs
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
 * Query parameters schema for GET /api/sessions
 */
const sessionsQuerySchema = z.object({
	server: z.string().optional(),
});

/**
 * Create API routes for querying logs
 *
 * Routes:
 * - GET /api/logs - Query logs with filters and pagination
 * - GET /api/servers - List servers with aggregated stats
 * - GET /api/sessions - List sessions with aggregated stats
 *
 * @param storageDir - Storage directory path
 * @returns Hono app with API routes
 */
export function createApiRoutes(storageDir: string): Hono {
	const app = new Hono();

	/**
	 * GET /api/logs
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

		const result = await queryLogs(storageDir, options);

		return c.json(result);
	});

	/**
	 * GET /api/servers
	 *
	 * List all servers with log counts and session counts
	 */
	app.get("/servers", async (c) => {
		const servers = await getServers(storageDir);

		return c.json({ servers });
	});

	/**
	 * GET /api/sessions
	 *
	 * List all sessions with log counts and time ranges
	 * Optionally filter by server name
	 */
	app.get("/sessions", sValidator("query", sessionsQuerySchema), async (c) => {
		const query = c.req.valid("query") as z.infer<typeof sessionsQuerySchema>;

		const sessions = await getSessions(storageDir, query.server);

		return c.json({ sessions });
	});

	return app;
}
