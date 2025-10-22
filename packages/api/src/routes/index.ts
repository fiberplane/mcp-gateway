import type {
  ApiLogEntry,
  ClientAggregation,
  LogQueryOptions,
  LogQueryResult,
  QueryFunctions,
  ServerInfo,
  SessionInfo,
} from "@fiberplane/mcp-gateway-types";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { z } from "zod";

/**
 * Query parameters schema for GET /logs
 */
const logsQuerySchema = z
  .object({
    server: z.string().optional(),
    session: z.string().optional(),
    method: z.string().optional(),
    after: z.string().datetime().optional(),
    before: z.string().datetime().optional(),
    limit: z.coerce.number().int().positive().max(1000).optional(),
    order: z.enum(["asc", "desc"]).optional(),
  })
  .refine(
    (data) => {
      // Validate that after timestamp is before the before timestamp
      if (data.after && data.before) {
        return new Date(data.after) < new Date(data.before);
      }
      return true;
    },
    {
      message: "after timestamp must be before before timestamp",
      path: ["after"],
    },
  );

/**
 * Query parameters schema for GET /sessions
 */
const sessionsQuerySchema = z.object({
  server: z.string().optional(),
});

// QueryFunctions is imported above and re-exported for backward compatibility
export type { QueryFunctions };

/**
 * Create API routes for querying logs
 *
 * Routes:
 * - GET /logs - Query logs with filters and pagination
 * - GET /servers - List servers with aggregated stats
 * - GET /sessions - List sessions with aggregated stats
 * - GET /clients - List clients with aggregated stats
 * - POST /sessions/clear - Clear all session data
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

    // Transform CaptureRecords into separate ApiLogEntry records
    // Splits request/response pairs and includes SSE events as separate entries
    const logEntries: ApiLogEntry[] = result.data.flatMap((record) => {
      const entries: ApiLogEntry[] = [];

      // Add request entry if present
      if (record.request) {
        entries.push({
          timestamp: record.timestamp,
          method: record.method,
          id: record.id,
          direction: "request",
          metadata: record.metadata,
          request: record.request,
        });
      }

      // Add response entry if present
      if (record.response) {
        entries.push({
          timestamp: record.timestamp,
          method: record.method,
          id: record.id,
          direction: "response",
          metadata: record.metadata,
          response: record.response,
        });
      }

      // Add SSE event entry if present
      if (record.sseEvent) {
        entries.push({
          timestamp: record.timestamp,
          method: record.method,
          id: record.id,
          direction: "sse-event",
          metadata: record.metadata,
          sseEvent: record.sseEvent,
        });
      }

      return entries;
    });

    return c.json({
      data: logEntries,
      pagination: result.pagination,
    });
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

  /**
   * GET /clients
   *
   * List all clients with log counts and session counts
   */
  app.get("/clients", async (c) => {
    const clients = await queries.getClients(storageDir);

    return c.json({ clients });
  });

  /**
   * POST /logs/clear
   *
   * Clear all captured logs and session metadata
   */
  app.post("/logs/clear", async (c) => {
    await queries.clearSessions();

    return c.json({ success: true });
  });

  return app;
}
