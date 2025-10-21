import {
  createSSEEventStream,
  isJsonRpcResponse,
  logger,
  parseJsonRpcFromSSE,
} from "@fiberplane/mcp-gateway-core";
import type {
  CaptureRecord,
  ClientInfo,
  JsonRpcRequest,
  JsonRpcResponse,
  LogEntry,
  McpServer,
  McpServerInfo,
  Registry,
} from "@fiberplane/mcp-gateway-types";
import {
  clientInfoSchema,
  extractRemoteAddress,
  jsonRpcRequestSchema,
  mcpServerInfoSchema,
  serverParamSchema,
  sessionHeaderSchema,
} from "@fiberplane/mcp-gateway-types";
import { sValidator } from "@hono/standard-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { proxy } from "hono/proxy";
import type { z } from "zod";

// Constant for sessionless (stateless) requests - used when no session ID is provided
const SESSIONLESS_ID = "stateless";

/**
 * HTTP context for capturing request metadata
 */
export interface HttpContext {
  userAgent?: string;
  clientIp?: string;
}

/**
 * Dependency injection callbacks for proxy routes
 *
 * These callbacks decouple the server package from core package,
 * allowing the CLI to wire in Gateway methods at runtime.
 */
export interface ProxyDependencies {
  /** Create a request capture record */
  createRequestRecord: (
    serverName: string,
    sessionId: string,
    request: JsonRpcRequest,
    httpContext?: HttpContext,
    clientInfo?: ClientInfo,
    serverInfo?: McpServerInfo,
  ) => CaptureRecord;

  /** Create a response capture record */
  createResponseRecord: (
    serverName: string,
    sessionId: string,
    response: JsonRpcResponse,
    httpStatus: number,
    method: string,
    httpContext?: HttpContext,
    clientInfo?: ClientInfo,
    serverInfo?: McpServerInfo,
  ) => CaptureRecord;

  /** Append a capture record to storage */
  appendRecord: (record: CaptureRecord) => Promise<void>;

  /** Capture an error response */
  captureErrorResponse: (
    serverName: string,
    sessionId: string,
    request: JsonRpcRequest,
    error: { code: number; message: string; data?: unknown },
    httpStatus: number,
    durationMs: number,
    httpContext?: HttpContext,
  ) => Promise<void>;

  /** Capture an SSE event */
  captureSSEEventData: (
    serverName: string,
    sessionId: string,
    sseEvent: { id?: string; event?: string; data?: string; retry?: number },
    method?: string,
    requestId?: string | number | null,
    httpContext?: HttpContext,
  ) => Promise<void>;

  /** Capture JSON-RPC message from SSE */
  captureSSEJsonRpcMessage: (
    serverName: string,
    sessionId: string,
    jsonRpcMessage: JsonRpcRequest | JsonRpcResponse,
    sseEvent: { id?: string; event?: string; data?: string; retry?: number },
    isResponse?: boolean,
    httpContext?: HttpContext,
    clientInfo?: ClientInfo,
    serverInfo?: McpServerInfo,
  ) => Promise<CaptureRecord | null>;

  /** Store client info for a session */
  storeClientInfoForSession: (sessionId: string, info: ClientInfo) => void;

  /** Get client info for a session */
  getClientInfoForSession: (sessionId: string) => Promise<ClientInfo | undefined>;

  /** Store server info for a session */
  storeServerInfoForSession: (sessionId: string, info: McpServerInfo) => void;

  /** Get server info for a session */
  getServerInfoForSession: (sessionId: string) => Promise<McpServerInfo | undefined>;

  /** Update server info for an initialize request after getting the response */
  updateServerInfoForInitializeRequest: (
    serverName: string,
    sessionId: string,
    requestId: string | number,
    serverInfo: { name?: string; version: string; title?: string },
  ) => Promise<void>;

  /** Get a server from the registry */
  getServerFromRegistry: (
    registry: Registry,
    name: string,
  ) => McpServer | undefined;

  /** Save the registry to storage */
  saveRegistryToStorage: (storage: string, registry: Registry) => Promise<void>;
}

// Headers that are automatically managed by fetch/proxy and should not be manually set
const AUTO_HEADERS = ["content-length", "transfer-encoding", "connection"];

// Helper: Extract session ID from request headers
function extractSessionId(
  validatedHeaders: z.infer<typeof sessionHeaderSchema>,
): string {
  return (
    validatedHeaders["Mcp-Session-Id"] ||
    validatedHeaders["mcp-session-id"] ||
    SESSIONLESS_ID
  );
}

// Helper: Extract session ID from response headers
function extractSessionIdFromResponse(headers: Headers): string | null {
  return headers.get("Mcp-Session-Id") || headers.get("mcp-session-id");
}

// Helper: Build proxy headers
function buildProxyHeaders(
  c: Context,
  server: McpServer,
): Record<string, string> {
  const proxyHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "MCP-Protocol-Version":
      c.req.raw.headers.get("MCP-Protocol-Version") || "2025-06-18",
    "Mcp-Session-Id":
      c.req.raw.headers.get("Mcp-Session-Id") ||
      c.req.raw.headers.get("mcp-session-id") ||
      "",
    ...Object.fromEntries(
      Object.entries(server.headers).filter(
        ([key]) => !AUTO_HEADERS.includes(key.toLowerCase()),
      ),
    ),
  };

  const acceptHeader = c.req.raw.headers.get("Accept");
  if (acceptHeader) {
    proxyHeaders.Accept = acceptHeader;
  }

  // Forward Authorization header for authentication
  const authHeader = c.req.raw.headers.get("Authorization");
  if (authHeader) {
    proxyHeaders.Authorization = authHeader;
  }

  return proxyHeaders;
}

// Helper: Handle client info from initialize
// For stateless requests, store in context to avoid race conditions
// For established sessions, store in Gateway stores
function handleInitializeClientInfo(
  c: Context,
  sessionId: string,
  jsonRpcRequest: JsonRpcRequest,
  deps: ProxyDependencies,
): void {
  if (jsonRpcRequest.method === "initialize" && jsonRpcRequest.params) {
    const params = jsonRpcRequest.params as Record<string, unknown>;
    if (params.clientInfo) {
      const clientResult = clientInfoSchema.safeParse(params.clientInfo);
      if (clientResult.success) {
        // Always store in Gateway stores for the current session
        deps.storeClientInfoForSession(sessionId, clientResult.data);

        // Also store for stateless as fallback (for sessions that haven't received their ID yet)
        if (sessionId !== SESSIONLESS_ID) {
          deps.storeClientInfoForSession(SESSIONLESS_ID, clientResult.data);
        }

        // For stateless sessions, also store in context to avoid race conditions
        if (sessionId === SESSIONLESS_ID) {
          c.set("tempClientInfo" as never, clientResult.data as never);
        }
      }
    }
  }
}

// Helper: Handle session transition for initialize
// When an initialize request moves from stateless to a new session ID,
// copy metadata from request context to Gateway stores for the new session
async function handleSessionTransition(
  c: Context,
  _storage: string,
  _server: McpServer,
  targetResponse: Response,
  sessionId: string,
  jsonRpcRequest: JsonRpcRequest,
  deps: ProxyDependencies,
): Promise<void> {
  if (jsonRpcRequest.method !== "initialize" || sessionId !== SESSIONLESS_ID) {
    return;
  }

  const responseSessionId = extractSessionIdFromResponse(
    targetResponse.headers,
  );

  if (responseSessionId) {
    // Copy client info from context to new session (stored there to avoid race conditions)
    const clientInfo = c.get("tempClientInfo" as never) as
      | ClientInfo
      | undefined;
    if (clientInfo) {
      deps.storeClientInfoForSession(responseSessionId, clientInfo);
    }

    // Copy server info from context to new session
    const serverInfo = c.get("tempServerInfo" as never) as
      | McpServerInfo
      | undefined;
    if (serverInfo) {
      deps.storeServerInfoForSession(responseSessionId, serverInfo);
    }
  }
}

// Helper: Log request
function logRequest(
  server: McpServer,
  sessionId: string,
  request: JsonRpcRequest,
  onLog?: (entry: LogEntry) => void,
): void {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    serverName: server.name,
    sessionId,
    method: request.method,
    httpStatus: 0,
    duration: 0,
    direction: "request",
    request,
  };

  onLog?.(logEntry);
}

// Helper: Log response
function logResponse(
  server: McpServer,
  sessionId: string,
  method: string,
  httpStatus: number,
  duration: number,
  response?: JsonRpcResponse,
  onLog?: (entry: LogEntry) => void,
): void {
  const errorMessage = response?.error
    ? `JSON-RPC ${response.error.code}: ${response.error.message}`
    : undefined;

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    serverName: server.name,
    sessionId,
    method,
    httpStatus,
    duration,
    direction: "response",
    errorMessage,
    response,
  };

  // Emit log to TUI (if handler provided)
  onLog?.(logEntry);
}

// Helper: Capture authentication error with full response
async function captureAuthError(
  serverName: string,
  sessionId: string,
  request: JsonRpcRequest,
  responseBody: string,
  httpStatus: number,
  deps: ProxyDependencies,
  httpContext?: HttpContext,
): Promise<void> {
  const clientInfo = await deps.getClientInfoForSession(sessionId);

  // Try to parse response body as JSON-RPC error
  let response: JsonRpcResponse | undefined;
  try {
    const parsed = JSON.parse(responseBody);
    if (parsed && typeof parsed === "object") {
      response = {
        jsonrpc: "2.0",
        id: request.id ?? null,
        error: {
          code: httpStatus,
          message: parsed.error || parsed.message || "Authentication required",
          data: parsed,
        },
      };
    }
  } catch {
    // If not JSON, create a generic error response
    response = {
      jsonrpc: "2.0",
      id: request.id ?? null,
      error: {
        code: httpStatus,
        message: "Authentication required",
        data: { rawBody: responseBody },
      },
    };
  }

  const record: CaptureRecord = {
    timestamp: new Date().toISOString(),
    method: request.method,
    id: request.id ?? null,
    metadata: {
      serverName,
      sessionId,
      durationMs: 0, // 401s are typically fast
      httpStatus,
      client: clientInfo,
      userAgent: httpContext?.userAgent,
      clientIp: httpContext?.clientIp,
    },
    request,
    response,
  };

  await deps.appendRecord(record);
}

/**
 * Create a composable Hono app with the following routes:
 *
 * - POST `/:server/mcp`
 *
 * @todo - Also implement GET and DELETE routes
 *
 * This can be mounted at `/servers` or `/s` (short alias route) in the main server
 */
export async function createProxyRoutes(options: {
  registry: Registry;
  storageDir: string;
  dependencies: ProxyDependencies;
  onLog?: (entry: LogEntry) => void;
  onRegistryUpdate?: () => void;
}): Promise<Hono> {
  const {
    registry,
    storageDir,
    dependencies: deps,
    onLog,
    onRegistryUpdate: _onRegistryUpdate,
  } = options;
  const app = new Hono();

  // Canonical proxy route for server connections
  app.post(
    "/:server/mcp",
    sValidator("param", serverParamSchema),
    sValidator("json", jsonRpcRequestSchema),
    sValidator("header", sessionHeaderSchema),
    async (c) => {
      const startTime = Date.now();

      // Get validated data
      const { server: serverName } = c.req.valid("param");
      const jsonRpcRequest = c.req.valid("json");

      // Find server in registry
      const server = deps.getServerFromRegistry(registry, serverName);
      if (!server) {
        return c.notFound();
      }

      // Extract session ID from headers
      const validatedHeaders = c.req.valid("header");
      const sessionId = extractSessionId(validatedHeaders);

      // Extract HTTP context for capture
      const httpContext: HttpContext = {
        userAgent: c.req.header("User-Agent"),
        clientIp: extractRemoteAddress(validatedHeaders),
      };

      // Handle initialize method - store client info BEFORE capturing request
      handleInitializeClientInfo(c, sessionId, jsonRpcRequest, deps);

      // Get stored client and server info for this session
      // For stateless requests, check context first (to avoid race conditions)
      const clientInfo =
        sessionId === SESSIONLESS_ID
          ? (c.get("tempClientInfo" as never) as ClientInfo | undefined) ||
            (await deps.getClientInfoForSession(sessionId))
          : await deps.getClientInfoForSession(sessionId);
      const serverInfo =
        sessionId === SESSIONLESS_ID
          ? (c.get("tempServerInfo" as never) as McpServerInfo | undefined) ||
            (await deps.getServerInfoForSession(sessionId))
          : await deps.getServerInfoForSession(sessionId);

      // Capture request immediately (before forwarding)
      const requestRecord = deps.createRequestRecord(
        server.name,
        sessionId,
        jsonRpcRequest,
        httpContext,
        clientInfo,
        serverInfo,
      );
      await deps.appendRecord(requestRecord);

      // Log incoming request from client
      logRequest(server, sessionId, jsonRpcRequest, onLog);

      let response: JsonRpcResponse;
      let httpStatus = 200;

      try {
        // Forward request to target MCP server using Hono proxy helper
        const proxyHeaders = buildProxyHeaders(c, server);

        const targetResponse = await proxy(server.url, {
          method: "POST",
          headers: proxyHeaders,
          body: JSON.stringify(jsonRpcRequest),
        });

        httpStatus = targetResponse.status;

        // CRITICAL: If 401, return response as-is with all auth info
        // 401 responses may contain authentication information (WWW-Authenticate header,
        // auth URLs, error details) that must be preserved for the client
        if (httpStatus === 401) {
          const duration = Date.now() - startTime;
          const responseText = await targetResponse.text();
          const responseHeaders = new Headers(targetResponse.headers);

          // Remove auto-generated headers to avoid duplicates
          for (const header of AUTO_HEADERS) {
            responseHeaders.delete(header);
          }

          // Log the 401 response (for TUI visibility)
          logResponse(
            server,
            sessionId,
            jsonRpcRequest.method,
            401,
            duration,
            undefined,
            onLog,
          );

          // Capture the 401 response with full details
          await captureAuthError(
            server.name,
            sessionId,
            jsonRpcRequest,
            responseText,
            401,
            deps,
            httpContext,
          );

          return new Response(responseText, {
            status: 401,
            headers: responseHeaders,
          });
        }

        // Check if response is SSE stream
        const contentType =
          targetResponse.headers.get("content-type")?.toLowerCase() || "";
        const isSSE = contentType.startsWith("text/event-stream");

        if (isSSE) {
          // Handle SSE streaming response

          if (!targetResponse.body) {
            throw new Error("SSE response has no body");
          }

          // Create two streams from the response body
          const [streamForClient, streamForCapture] = targetResponse.body.tee();

          // Start background capture processing
          processSSECapture(
            streamForCapture,
            server,
            sessionId,
            jsonRpcRequest.method,
            jsonRpcRequest.id,
            deps,
            httpContext,
            onLog,
          );

          // Return streaming response to client
          return new Response(streamForClient, {
            status: httpStatus,
            headers: targetResponse.headers,
          });
        }

        // Handle regular JSON response (existing logic)
        // Read body as text first to avoid consuming the stream twice
        const responseText = await targetResponse.text();
        let responseBody: unknown;
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          // If not valid JSON, use as-is
          responseBody = responseText;
        }
        response = responseBody as JsonRpcResponse;
        const duration = Date.now() - startTime;

        // Capture server info from initialize response BEFORE creating response record
        if (jsonRpcRequest.method === "initialize" && response.result) {
          const result = response.result as Record<string, unknown>;
          if (result.serverInfo) {
            const serverResult = mcpServerInfoSchema.safeParse(
              result.serverInfo,
            );
            if (serverResult.success) {
              // Always store in Gateway stores for the current session
              deps.storeServerInfoForSession(sessionId, serverResult.data);

              // Also store for stateless as fallback (for sessions that haven't received their ID yet)
              if (sessionId !== SESSIONLESS_ID) {
                deps.storeServerInfoForSession(SESSIONLESS_ID, serverResult.data);
              }

              // For stateless sessions, also store in context to avoid race conditions
              if (sessionId === SESSIONLESS_ID) {
                c.set("tempServerInfo" as never, serverResult.data as never);
              }

              // Backfill server info on the initialize request record
              // The request was captured before we received the response containing serverInfo
              if (jsonRpcRequest.id != null) {
                await deps.updateServerInfoForInitializeRequest(
                  server.name,
                  sessionId,
                  jsonRpcRequest.id,
                  serverResult.data,
                );
              }
            }
          }
        }

        // Get updated client and server info after initialize response
        // For stateless requests, check context first (to avoid race conditions)
        const updatedClientInfo =
          sessionId === SESSIONLESS_ID
            ? (c.get("tempClientInfo" as never) as ClientInfo | undefined) ||
              (await deps.getClientInfoForSession(sessionId))
            : await deps.getClientInfoForSession(sessionId);
        const updatedServerInfo =
          sessionId === SESSIONLESS_ID
            ? (c.get("tempServerInfo" as never) as McpServerInfo | undefined) ||
              (await deps.getServerInfoForSession(sessionId))
            : await deps.getServerInfoForSession(sessionId);

        // Capture response (both for regular requests and notifications)
        // The upstream server returns a JSON response for all requests, including notifications
        const responseRecord = deps.createResponseRecord(
          server.name,
          sessionId,
          response,
          httpStatus,
          jsonRpcRequest.method,
          httpContext,
          updatedClientInfo,
          updatedServerInfo,
        );
        await deps.appendRecord(responseRecord);

        // Handle initialize → session transition
        await handleSessionTransition(
          c,
          storageDir,
          server,
          targetResponse,
          sessionId,
          jsonRpcRequest,
          deps,
        );

        // Log response
        logResponse(
          server,
          sessionId,
          jsonRpcRequest.method,
          httpStatus,
          duration,
          response,
          onLog,
        );

        // Create new response with the same data and headers
        // Remove auto-generated headers to avoid duplicates when Response constructor adds them
        const responseHeaders = new Headers(targetResponse.headers);
        for (const header of AUTO_HEADERS) {
          responseHeaders.delete(header);
        }
        return new Response(responseText, {
          status: httpStatus,
          headers: responseHeaders,
        });
      } catch (error) {
        const duration = Date.now() - startTime;

        // Create error response
        const errorResponse: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: jsonRpcRequest.id ?? null,
          error: {
            code: -32603,
            message: String(error),
          },
        };

        // Log error response
        logResponse(
          server,
          sessionId,
          jsonRpcRequest.method,
          httpStatus,
          duration,
          errorResponse,
          onLog,
        );

        // Capture error
        await deps.captureErrorResponse(
          server.name,
          sessionId,
          jsonRpcRequest,
          {
            code: -32603,
            message: String(error),
          },
          httpStatus,
          duration,
          httpContext,
        );

        return new Response(JSON.stringify(errorResponse), {
          status: httpStatus,
          headers: { "Content-Type": "application/json" },
        });
      }
    },
  );

  return app;
}

// Background processing of SSE stream for capture
async function processSSECapture(
  stream: ReadableStream<Uint8Array>,
  server: McpServer,
  sessionId: string,
  method: string,
  requestId: string | number | null | undefined,
  deps: ProxyDependencies,
  httpContext?: HttpContext,
  onLog?: (entry: LogEntry) => void,
): Promise<void> {
  try {
    const reader = stream.getReader();
    const eventStream = createSSEEventStream(reader);
    const eventReader = eventStream.getReader();

    let _eventCount = 0;

    while (true) {
      const { done, value: sseEvent } = await eventReader.read();

      if (done) {
        break;
      }

      _eventCount++;

      // Try to parse SSE data as JSON-RPC
      if (sseEvent.data) {
        const jsonRpcMessage = parseJsonRpcFromSSE(sseEvent.data);

        if (jsonRpcMessage) {
          // Capture as JSON-RPC message
          const isResponse = isJsonRpcResponse(jsonRpcMessage);

          // Get stored client and server info for this session
          const clientInfo = await deps.getClientInfoForSession(sessionId);
          const serverInfo = await deps.getServerInfoForSession(sessionId);

          const record = await deps.captureSSEJsonRpcMessage(
            server.name,
            sessionId,
            jsonRpcMessage,
            sseEvent,
            isResponse,
            httpContext,
            clientInfo,
            serverInfo,
          );

          // Log response to TUI if it's a response (even if capture failed)
          if (isResponse) {
            const method = record?.method ?? "unknown";
            const durationMs = record?.metadata.durationMs ?? 0;
            const httpStatus = record?.metadata.httpStatus ?? 200;

            logResponse(
              server,
              sessionId,
              method,
              httpStatus,
              durationMs,
              jsonRpcMessage,
              onLog,
            );
          }
        } else {
          // Capture as raw SSE event
          await deps.captureSSEEventData(
            server.name,
            sessionId,
            sseEvent,
            method,
            requestId,
            httpContext,
          );
        }
      } else {
        // Capture events without data
        await deps.captureSSEEventData(
          server.name,
          sessionId,
          sseEvent,
          method,
          requestId,
          httpContext,
        );
      }
    }
  } catch (error) {
    logger.error("SSE capture error", {
      server: server.name,
      method,
      error: String(error),
    });
    // Don't throw - capture failures shouldn't affect the client stream
  }
}
