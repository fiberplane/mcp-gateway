import type { LLMProvider } from "@fiberplane/mcp-gateway-types";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../logs/schema";
import { llmRequests, type NewLLMRequest } from "../logs/schema";

/**
 * LLM Request Capture
 *
 * Captures LLM requests and responses to the database for correlation with MCP tool calls.
 */

export interface CaptureOptions {
  db: BunSQLiteDatabase<typeof schema>;
  traceId: string;
  conversationId: string;
  provider: LLMProvider;
  model: string;
  userAgent?: string;
  clientIp?: string;
}

export interface RequestCaptureData {
  requestBody: unknown;
  streaming: boolean;
}

export interface ResponseCaptureData {
  responseBody: unknown;
  finishReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs: number;
  httpStatus: number;
  toolCalls?: unknown[];
  error?: unknown;
}

/**
 * Capture LLM request to database
 */
export function captureLLMRequest(
  options: CaptureOptions,
  data: RequestCaptureData,
): void {
  const { db, traceId, conversationId, provider, model, userAgent, clientIp } =
    options;
  const { requestBody, streaming } = data;

  const entry: NewLLMRequest = {
    uuid: crypto.randomUUID(),
    traceId,
    conversationId,
    timestamp: new Date().toISOString(),
    provider,
    model,
    direction: "request",
    requestBody: JSON.stringify(requestBody),
    responseBody: null,
    finishReason: null,
    streaming,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    durationMs: 0,
    httpStatus: 0,
    toolCallsJson: null,
    userAgent: userAgent || null,
    clientIp: clientIp || null,
    errorJson: null,
  };

  db.insert(llmRequests).values(entry).run();
}

/**
 * Capture LLM response to database
 */
export function captureLLMResponse(
  options: CaptureOptions,
  data: ResponseCaptureData,
): void {
  const { db, traceId, conversationId, provider, model, userAgent, clientIp } =
    options;
  const {
    responseBody,
    finishReason,
    inputTokens,
    outputTokens,
    totalTokens,
    durationMs,
    httpStatus,
    toolCalls,
    error,
  } = data;

  const entry: NewLLMRequest = {
    uuid: crypto.randomUUID(),
    traceId,
    conversationId,
    timestamp: new Date().toISOString(),
    provider,
    model,
    direction: "response",
    requestBody: null,
    responseBody: JSON.stringify(responseBody),
    finishReason: finishReason || null,
    streaming: false,
    inputTokens: inputTokens || null,
    outputTokens: outputTokens || null,
    totalTokens: totalTokens || null,
    durationMs,
    httpStatus,
    toolCallsJson: toolCalls ? JSON.stringify(toolCalls) : null,
    userAgent: userAgent || null,
    clientIp: clientIp || null,
    errorJson: error ? JSON.stringify(error) : null,
  };

  db.insert(llmRequests).values(entry).run();
}
