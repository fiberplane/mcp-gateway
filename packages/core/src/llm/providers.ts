import type {
  AnthropicMessagesRequest,
  LLMProvider,
  OpenAIChatCompletionRequest,
} from "@fiberplane/mcp-gateway-types";
import {
  anthropicMessagesRequestSchema,
  openaiChatCompletionRequestSchema,
} from "@fiberplane/mcp-gateway-types";

/**
 * Detect LLM provider from request body
 *
 * Uses schema validation to determine if request matches OpenAI or Anthropic format.
 * Falls back to heuristics if schema validation fails.
 */
export function detectProvider(requestBody: unknown): LLMProvider {
  // Try OpenAI schema first (more common)
  const openaiResult = openaiChatCompletionRequestSchema.safeParse(requestBody);
  if (openaiResult.success) {
    return "openai";
  }

  // Try Anthropic schema
  const anthropicResult = anthropicMessagesRequestSchema.safeParse(requestBody);
  if (anthropicResult.success) {
    return "anthropic";
  }

  // Fallback to heuristics
  const body = requestBody as Record<string, unknown>;

  // Anthropic requires max_tokens (OpenAI doesn't)
  if ("max_tokens" in body && typeof body.max_tokens === "number") {
    return "anthropic";
  }

  // Check model prefix
  if ("model" in body && typeof body.model === "string") {
    if (body.model.startsWith("claude-")) {
      return "anthropic";
    }
    if (
      body.model.startsWith("gpt-") ||
      body.model.startsWith("o1-") ||
      body.model.startsWith("text-")
    ) {
      return "openai";
    }
  }

  // Default to OpenAI (more widely used)
  return "openai";
}

/**
 * Get provider API endpoint
 */
export function getProviderEndpoint(
  provider: LLMProvider,
  path: string,
): string {
  const endpoints = {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
  };

  return `${endpoints[provider]}${path}`;
}

/**
 * Validate OpenAI request
 */
export function validateOpenAIRequest(
  body: unknown,
): OpenAIChatCompletionRequest {
  const result = openaiChatCompletionRequestSchema.parse(body);
  return result;
}

/**
 * Validate Anthropic request
 */
export function validateAnthropicRequest(
  body: unknown,
): AnthropicMessagesRequest {
  const result = anthropicMessagesRequestSchema.parse(body);
  return result;
}

/**
 * Extract model from request body
 */
export function extractModel(requestBody: unknown): string {
  const body = requestBody as Record<string, unknown>;
  if ("model" in body && typeof body.model === "string") {
    return body.model;
  }
  return "unknown";
}

/**
 * Extract tool calls from OpenAI response
 */
export function extractOpenAIToolCalls(
  responseBody: unknown,
): Array<{ id: string; name: string; arguments: Record<string, unknown> }> {
  const body = responseBody as Record<string, unknown>;

  if (!body.choices || !Array.isArray(body.choices)) {
    return [];
  }

  const toolCalls: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }> = [];

  for (const choice of body.choices) {
    const message = choice.message as Record<string, unknown>;
    if (message?.tool_calls && Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === "function" && toolCall.function) {
          try {
            const args =
              typeof toolCall.function.arguments === "string"
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments;

            toolCalls.push({
              id: toolCall.id,
              name: toolCall.function.name,
              arguments: args,
            });
          } catch {
            // Skip invalid tool calls
          }
        }
      }
    }
  }

  return toolCalls;
}

/**
 * Extract tool calls from Anthropic response
 */
export function extractAnthropicToolCalls(
  responseBody: unknown,
): Array<{ id: string; name: string; arguments: Record<string, unknown> }> {
  const body = responseBody as Record<string, unknown>;

  if (!body.content || !Array.isArray(body.content)) {
    return [];
  }

  const toolCalls: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }> = [];

  for (const content of body.content) {
    if (content.type === "tool_use") {
      toolCalls.push({
        id: content.id,
        name: content.name,
        arguments: content.input || {},
      });
    }
  }

  return toolCalls;
}

/**
 * Extract tool calls based on provider
 */
export function extractToolCalls(
  provider: LLMProvider,
  responseBody: unknown,
): Array<{ id: string; name: string; arguments: Record<string, unknown> }> {
  if (provider === "openai") {
    return extractOpenAIToolCalls(responseBody);
  }
  return extractAnthropicToolCalls(responseBody);
}

/**
 * Extract token usage from response
 */
export function extractTokenUsage(
  provider: LLMProvider,
  responseBody: unknown,
): {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
} {
  const body = responseBody as Record<string, unknown>;

  if (provider === "openai") {
    const usage = body.usage as Record<string, unknown> | undefined;
    return {
      inputTokens: usage?.prompt_tokens as number | undefined,
      outputTokens: usage?.completion_tokens as number | undefined,
      totalTokens: usage?.total_tokens as number | undefined,
    };
  }

  // Anthropic
  const usage = body.usage as Record<string, unknown> | undefined;
  return {
    inputTokens: usage?.input_tokens as number | undefined,
    outputTokens: usage?.output_tokens as number | undefined,
    totalTokens:
      ((usage?.input_tokens as number) || 0) +
      ((usage?.output_tokens as number) || 0),
  };
}

/**
 * Extract finish reason from response
 */
export function extractFinishReason(
  provider: LLMProvider,
  responseBody: unknown,
): string | undefined {
  const body = responseBody as Record<string, unknown>;

  if (provider === "openai") {
    const choices = body.choices as Array<Record<string, unknown>> | undefined;
    return choices?.[0]?.finish_reason as string | undefined;
  }

  // Anthropic
  return body.stop_reason as string | undefined;
}
