import type { CaptureRecord } from "./schemas.js";

/**
 * Summary of a conversation (LLM + MCP correlation)
 */
export interface ConversationSummary {
  conversationId: string;
  startTime: string;
  endTime: string;
  llmRequestCount: number;
  mcpCallCount: number;
  provider: string | null;
  model: string | null;
}

/**
 * Timeline event types
 */
export type TimelineEventType = "llm-request" | "llm-response" | "mcp-call";

/**
 * LLM request/response data
 */
export interface LLMEventData {
  provider: string;
  model: string;
  requestBody?: unknown;
  responseBody?: unknown;
  inputTokens?: number | null;
  outputTokens?: number | null;
  durationMs?: number | null;
  httpStatus?: number | null;
  toolCalls?: unknown;
  error?: unknown;
}

/**
 * Timeline event
 */
export interface TimelineEvent {
  type: TimelineEventType;
  timestamp: string;
  data: LLMEventData | CaptureRecord;
}

/**
 * Conversation timeline (chronological LLM + MCP events)
 */
export interface ConversationTimeline {
  conversationId: string;
  events: TimelineEvent[];
}
