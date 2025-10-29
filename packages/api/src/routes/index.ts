import type {
  ApiLogEntry,
  LogQueryOptions,
  QueryFunctions,
} from "@fiberplane/mcp-gateway-types";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { z } from "zod";

/**
 * Query parameters schema for GET /sessions
 */
const sessionsQuerySchema = z.object({
  server: z.string().optional(),
});

/**
 * Query parameters schema for GET /methods
 */
const methodsQuerySchema = z.object({
  server: z.string().optional(),
});

/**
 * Create API routes for querying logs
 *
 * Routes:
 * - GET /logs - Query logs with filters and pagination
 * - GET /servers - List servers with aggregated stats
 * - GET /sessions - List sessions with aggregated stats
 * - GET /clients - List clients with aggregated stats
 * - GET /methods - List methods with aggregated stats
 * - POST /sessions/clear - Clear all session data
 *
 * @param queries - Query functions to use for data access
 * @returns Hono app with API routes
 */
export function createApiRoutes(queries: QueryFunctions): Hono {
  const app = new Hono();

  /**
   * GET /logs
   *
   * Query logs with optional filters and pagination
   *
   * Supports repeated query parameters for multi-select filtering:
   * - ?server=foo&server=bar (matches logs from "foo" OR "bar")
   * - ?client=alice&client=bob (matches logs from "alice" OR "bob")
   * - ?session=123&session=456 (matches logs from session "123" OR "456")
   */
  app.get("/logs", async (c) => {
    // Manually extract query params to handle arrays from repeated params
    const serverNames = c.req.queries("server");
    const sessionIds = c.req.queries("session");
    const clientNames = c.req.queries("client");
    const methodNames = c.req.queries("method");
    const after = c.req.query("after");
    const before = c.req.query("before");
    const limitStr = c.req.query("limit");
    const order = c.req.query("order");

    // Duration filter params
    const durationEqStrs = c.req.queries("durationEq");
    const durationGtStr = c.req.query("durationGt");
    const durationLtStr = c.req.query("durationLt");
    const durationGteStr = c.req.query("durationGte");
    const durationLteStr = c.req.query("durationLte");

    // Tokens filter params
    const tokensEqStrs = c.req.queries("tokensEq");
    const tokensGtStr = c.req.query("tokensGt");
    const tokensLtStr = c.req.query("tokensLt");
    const tokensGteStr = c.req.query("tokensGte");
    const tokensLteStr = c.req.query("tokensLte");

    // Parse and validate limit
    const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined;
    if (
      limit !== undefined &&
      (Number.isNaN(limit) || limit <= 0 || limit > 1000)
    ) {
      return c.json(
        {
          error: {
            code: "INVALID_PARAM",
            message: "limit must be a positive integer between 1 and 1000",
          },
        },
        400,
      );
    }

    // Validate order
    if (order && order !== "asc" && order !== "desc") {
      return c.json(
        {
          error: {
            code: "INVALID_PARAM",
            message: "order must be 'asc' or 'desc'",
          },
        },
        400,
      );
    }

    // Validate timestamps
    if (after && before && new Date(after) >= new Date(before)) {
      return c.json(
        {
          error: {
            code: "INVALID_PARAM",
            message: "after timestamp must be before before timestamp",
          },
        },
        400,
      );
    }

    // Parse numeric filters (duration)
    const durationEq =
      durationEqStrs && durationEqStrs.length > 0
        ? durationEqStrs.length === 1
          ? Number.parseInt(durationEqStrs[0]!, 10)
          : durationEqStrs.map((s) => Number.parseInt(s, 10))
        : undefined;
    const durationGt = durationGtStr
      ? Number.parseInt(durationGtStr, 10)
      : undefined;
    const durationLt = durationLtStr
      ? Number.parseInt(durationLtStr, 10)
      : undefined;
    const durationGte = durationGteStr
      ? Number.parseInt(durationGteStr, 10)
      : undefined;
    const durationLte = durationLteStr
      ? Number.parseInt(durationLteStr, 10)
      : undefined;

    // Parse numeric filters (tokens)
    const tokensEq =
      tokensEqStrs && tokensEqStrs.length > 0
        ? tokensEqStrs.length === 1
          ? Number.parseInt(tokensEqStrs[0]!, 10)
          : tokensEqStrs.map((s) => Number.parseInt(s, 10))
        : undefined;
    const tokensGt = tokensGtStr ? Number.parseInt(tokensGtStr, 10) : undefined;
    const tokensLt = tokensLtStr ? Number.parseInt(tokensLtStr, 10) : undefined;
    const tokensGte = tokensGteStr
      ? Number.parseInt(tokensGteStr, 10)
      : undefined;
    const tokensLte = tokensLteStr
      ? Number.parseInt(tokensLteStr, 10)
      : undefined;

    const options: LogQueryOptions = {
      // String filters (support arrays)
      serverName:
        serverNames && serverNames.length > 0
          ? serverNames.length === 1
            ? serverNames[0]
            : serverNames
          : undefined,
      sessionId:
        sessionIds && sessionIds.length > 0
          ? sessionIds.length === 1
            ? sessionIds[0]
            : sessionIds
          : undefined,
      method:
        methodNames && methodNames.length > 0
          ? methodNames.length === 1
            ? methodNames[0]
            : methodNames
          : undefined,
      clientName:
        clientNames && clientNames.length > 0
          ? clientNames.length === 1
            ? clientNames[0]
            : clientNames
          : undefined,

      // Duration filters
      durationEq,
      durationGt,
      durationLt,
      durationGte,
      durationLte,

      // Tokens filters
      tokensEq,
      tokensGt,
      tokensLt,
      tokensGte,
      tokensLte,

      // Time range
      after: after || undefined,
      before: before || undefined,

      // Pagination
      limit,
      order: (order as "asc" | "desc") || undefined,
    };

    const result = await queries.queryLogs(options);

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
   * List all servers with log counts, session counts, and status
   */
  app.get("/servers", async (c) => {
    const servers = await queries.getServers();

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

    const sessions = await queries.getSessions(query.server);

    return c.json({ sessions });
  });

  /**
   * GET /clients
   *
   * List all clients with log counts and session counts
   */
  app.get("/clients", async (c) => {
    const clients = await queries.getClients();

    return c.json({ clients });
  });

  /**
   * GET /methods
   *
   * List all methods with log counts
   * Optionally filter by server name
   */
  app.get("/methods", sValidator("query", methodsQuerySchema), async (c) => {
    const query = c.req.valid("query") as z.infer<typeof methodsQuerySchema>;

    const methods = await queries.getMethods(query.server);

    return c.json({ methods });
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
