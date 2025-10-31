import {
  detectProvider,
  extractFinishReason,
  extractModel,
  extractTokenUsage,
  extractToolCalls,
  getProviderEndpoint,
} from "@fiberplane/mcp-gateway-core";
import type { Gateway, LLMProvider } from "@fiberplane/mcp-gateway-types";
import { Hono } from "hono";
import { stream } from "hono/streaming";

export interface LLMProxyOptions {
  gateway: Gateway;
}

/**
 * LLM Proxy Routes
 *
 * Proxies OpenAI and Anthropic API requests through the gateway.
 * Captures all requests/responses to database for correlation with MCP tool calls.
 */
export function createLLMProxyRoutes(options: LLMProxyOptions) {
  const { gateway } = options;
  const app = new Hono();

  // OpenAI chat completions endpoint
  app.post("/v1/chat/completions", async (c) => {
    return handleLLMRequest(c, "/chat/completions", gateway);
  });

  // OpenAI responses endpoint (for structured outputs/tool calling)
  app.post("/v1/responses", async (c) => {
    return handleLLMRequest(c, "/responses", gateway);
  });

  // Anthropic messages endpoint
  app.post("/v1/messages", async (c) => {
    return handleLLMRequest(c, "/messages", gateway);
  });

  return app;
}

/**
 * Handle LLM API request
 *
 * Proxies request to provider and returns response with correlation headers.
 * Captures all requests/responses to database.
 */
async function handleLLMRequest(
  c: any,
  path: string,
  gateway: Gateway,
): Promise<Response> {
  const startTime = Date.now();

  try {
    // Parse request body
    const requestBody = await c.req.json();

    // Detect provider
    const provider = detectProvider(requestBody);

    // Generate correlation IDs
    const requestId = crypto.randomUUID();
    const traceId = crypto.randomUUID();
    const conversationId =
      c.req.header("X-Conversation-Id") || crypto.randomUUID();

    // Get provider endpoint
    const endpoint = getProviderEndpoint(provider, path);

    // Extract API key from Authorization header
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json(
        {
          error: {
            message: "Missing Authorization header",
            type: "invalid_request_error",
          },
        },
        401,
      );
    }

    // Build provider headers
    const providerHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: authHeader,
    };

    // Add provider-specific headers
    if (provider === "anthropic") {
      providerHeaders["anthropic-version"] = "2023-06-01";
    }

    // Extract model from request for capture
    const model = requestBody.model || "unknown";
    const userAgent = c.req.header("User-Agent");
    const clientIp =
      c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP");

    // Store session→conversation mapping for auto-correlation
    // Check for Mcp-Session-Id header (case-insensitive)
    const sessionId =
      c.req.header("Mcp-Session-Id") || c.req.header("mcp-session-id");
    if (sessionId) {
      gateway.conversation.store(sessionId, conversationId);
    }

    // Capture request
    gateway.storage.captureLLMRequest({
      traceId,
      conversationId,
      provider,
      model,
      userAgent,
      clientIp,
      requestBody,
      streaming: requestBody.stream === true,
    });

    // Forward request to provider
    const response = await fetch(endpoint, {
      method: "POST",
      headers: providerHeaders,
      body: JSON.stringify(requestBody),
    });

    const httpStatus = response.status;
    const durationMs = Date.now() - startTime;

    // Log basic info (TODO: integrate with proper capture system)
    console.log(
      `[LLM Proxy] ${provider} ${path} - ${httpStatus} (${durationMs}ms)`,
    );

    // Handle errors
    if (!response.ok) {
      const errorBody = await response.text();

      // Capture error response
      let errorObj: unknown;
      try {
        errorObj = JSON.parse(errorBody);
      } catch {
        errorObj = { message: errorBody };
      }

      gateway.storage.captureLLMResponse({
        traceId,
        conversationId,
        provider,
        model,
        userAgent,
        clientIp,
        responseBody: errorObj,
        durationMs,
        httpStatus,
        error: errorObj,
      });

      return new Response(errorBody, {
        status: httpStatus,
        headers: {
          "Content-Type": "application/json",
          "X-Trace-Id": traceId,
          "X-Conversation-Id": conversationId,
        },
      });
    }

    // Check if streaming
    const isStreaming = requestBody.stream === true;

    if (isStreaming) {
      // For streaming, just pass through the stream
      // TODO: Implement capture for streaming responses
      return new Response(response.body, {
        status: httpStatus,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Trace-Id": traceId,
          "X-Conversation-Id": conversationId,
        },
      });
    }

    // Handle non-streaming response
    const responseBody = await response.json();

    // Extract metrics
    const responseModel = extractModel(responseBody);
    const tokenUsage = extractTokenUsage(provider, responseBody);
    const finishReason = extractFinishReason(provider, responseBody);
    const toolCalls = extractToolCalls(provider, responseBody);

    // Capture successful response
    gateway.storage.captureLLMResponse({
      traceId,
      conversationId,
      provider,
      model: responseModel || model,
      userAgent,
      clientIp,
      responseBody,
      finishReason,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      totalTokens: tokenUsage.totalTokens,
      durationMs,
      httpStatus,
      toolCalls,
    });

    console.log(
      `[LLM Proxy] Model: ${responseModel || model}, Tokens: ${tokenUsage.totalTokens}, Tools: ${toolCalls.length}`,
    );

    return c.json(responseBody, {
      headers: {
        "X-Trace-Id": traceId,
        "X-Conversation-Id": conversationId,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;

    console.error(`[LLM Proxy] Error after ${durationMs}ms:`, error);

    return c.json(
      {
        error: {
          message: error instanceof Error ? error.message : String(error),
          type: "gateway_error",
        },
      },
      500,
    );
  }
}
