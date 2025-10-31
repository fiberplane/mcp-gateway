import type {
  ApiLogEntry,
  LogQueryOptions,
  QueryFunctions,
} from "@fiberplane/mcp-gateway-types";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { ServerManagementFunctions } from "./server-management.js";
import { createServerManagementRoutes } from "./server-management.js";

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
 * Create API routes for querying logs and managing servers
 *
 * Routes:
 * - GET /logs - Query logs with filters and pagination
 * - GET /servers - List servers with aggregated stats
 * - GET /sessions - List sessions with aggregated stats
 * - GET /clients - List clients with aggregated stats
 * - GET /methods - List methods with aggregated stats
 * - POST /sessions/clear - Clear all session data
 * - GET /servers/config - List all server configurations
 * - POST /servers/config - Add a new server
 * - PUT /servers/config/:name - Update an existing server
 * - DELETE /servers/config/:name - Delete a server
 *
 * @param queries - Query functions to use for data access
 * @param serverManagement - Server management functions (optional, for backward compatibility)
 * @returns Hono app with API routes
 */
export function createApiRoutes(
  queries: QueryFunctions,
  serverManagement?: ServerManagementFunctions,
): Hono {
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
    // Helper to parse operator:value format from query params
    // Returns { operator, values } where values is array for multi-select
    // defaultOperator allows per-field backward compatibility
    const parseFilterParam = (
      params: string[] | undefined,
      defaultOperator: "is" | "contains" = "is",
    ): { operator: "is" | "contains"; values: string[] } | undefined => {
      if (!params || params.length === 0) return undefined;

      // Parse first param to extract operator (all params should have same operator)
      const first = params[0];
      if (!first) return undefined;

      const colonIndex = first.indexOf(":");
      if (colonIndex === -1) {
        // No operator specified, use field-specific default for backward compat
        return { operator: defaultOperator, values: params };
      }

      // Extract and validate operator from first param
      const operatorStr = first.slice(0, colonIndex);
      if (operatorStr !== "is" && operatorStr !== "contains") {
        // Invalid operator, use default
        return { operator: defaultOperator, values: params };
      }

      // Extract values from all params, stripping operator prefix
      const values = params.map((p) => {
        const idx = p.indexOf(":");
        return idx === -1 ? p : p.slice(idx + 1);
      });

      return { operator: operatorStr, values };
    };

    // Manually extract query params to handle arrays from repeated params
    const searchQueries = c.req.queries("q");
    // String filters with field-specific defaults for backward compatibility:
    // - server, session, client: default to "is" (exact match)
    // - method: default to "contains" (partial match, legacy behavior)
    const serverParams = parseFilterParam(c.req.queries("server"), "is");
    const sessionParams = parseFilterParam(c.req.queries("session"), "is");
    const clientParams = parseFilterParam(c.req.queries("client"), "is");
    const methodParams = parseFilterParam(c.req.queries("method"), "contains");
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

    // Helper to parse and validate numeric parameter
    const parseNumeric = (
      value: string | undefined,
      paramName: string,
    ): number | undefined => {
      if (!value) return undefined;
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        throw new Error(`${paramName} must be a valid integer`);
      }
      return parsed;
    };

    // Helper to parse and validate array of numeric parameters
    const parseNumericArray = (
      values: string[] | undefined,
      paramName: string,
    ): number | number[] | undefined => {
      if (!values || values.length === 0) return undefined;
      const parsed =
        values.length === 1
          ? parseNumeric(values[0], paramName)
          : values.map((v, i) => {
              const num = Number.parseInt(v, 10);
              if (Number.isNaN(num)) {
                throw new Error(`${paramName}[${i}] must be a valid integer`);
              }
              return num;
            });
      return parsed;
    };

    // Parse numeric filters (duration)
    let durationEq: number | number[] | undefined;
    let durationGt: number | undefined;
    let durationLt: number | undefined;
    let durationGte: number | undefined;
    let durationLte: number | undefined;

    // Parse numeric filters (tokens)
    let tokensEq: number | number[] | undefined;
    let tokensGt: number | undefined;
    let tokensLt: number | undefined;
    let tokensGte: number | undefined;
    let tokensLte: number | undefined;

    try {
      durationEq = parseNumericArray(durationEqStrs, "durationEq");
      durationGt = parseNumeric(durationGtStr, "durationGt");
      durationLt = parseNumeric(durationLtStr, "durationLt");
      durationGte = parseNumeric(durationGteStr, "durationGte");
      durationLte = parseNumeric(durationLteStr, "durationLte");

      tokensEq = parseNumericArray(tokensEqStrs, "tokensEq");
      tokensGt = parseNumeric(tokensGtStr, "tokensGt");
      tokensLt = parseNumeric(tokensLtStr, "tokensLt");
      tokensGte = parseNumeric(tokensGteStr, "tokensGte");
      tokensLte = parseNumeric(tokensLteStr, "tokensLte");
    } catch (error) {
      return c.json(
        {
          error: {
            code: "INVALID_PARAM",
            message:
              error instanceof Error
                ? error.message
                : "Invalid numeric parameter",
          },
        },
        400,
      );
    }

    // Helper to create StringFilter from parsed params
    const createStringFilter = (
      params: { operator: "is" | "contains"; values: string[] } | undefined,
    ):
      | { operator: "is" | "contains"; value: string | string[] }
      | undefined => {
      if (!params || params.values.length === 0) return undefined;
      const nonEmptyValues = params.values.filter((v): v is string => !!v);
      if (nonEmptyValues.length === 0) return undefined;

      const firstValue = nonEmptyValues[0];
      return {
        operator: params.operator,
        value:
          nonEmptyValues.length === 1 && firstValue
            ? firstValue
            : nonEmptyValues,
      };
    };

    const options: LogQueryOptions = {
      // Search queries (text search)
      searchQueries:
        searchQueries && searchQueries.length > 0 ? searchQueries : undefined,

      // String filters (support arrays and operators)
      serverName: createStringFilter(serverParams),
      sessionId: createStringFilter(sessionParams),
      method: createStringFilter(methodParams),
      clientName: createStringFilter(clientParams),

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

  // Mount server management routes if provided
  if (serverManagement) {
    const serverManagementApp = createServerManagementRoutes(serverManagement);
    app.route("/", serverManagementApp);
  }

  return app;
}
