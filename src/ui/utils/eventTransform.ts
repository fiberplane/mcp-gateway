import type { CaptureRecord } from "../../schemas.js";
import { METHODS } from "../../schemas.js";
import type {
  UIEvent,
  UIEventDetails,
  UIEventStatus,
  UIEventType,
} from "../types/events.js";

/**
 * Transform a raw CaptureRecord into a UI-friendly UIEvent
 */
export function transformCaptureRecord(record: CaptureRecord): UIEvent {
  const id = generateEventId(record);
  const type = mapMethodToEventType(record.method);
  const status = determineEventStatus(record);
  const summary = generateEventSummary(record, type, status);
  const details = extractEventDetails(record, type);

  return {
    id,
    timestamp: record.timestamp,
    type,
    method: record.method,
    requestId: record.id,
    status,
    metadata: record.metadata,
    summary,
    details,
    error: record.response.error
      ? {
          code: record.response.error.code,
          message: record.response.error.message,
          data: record.response.error.data,
        }
      : undefined,
  };
}

/**
 * Generate a unique ID for the event
 */
function generateEventId(record: CaptureRecord): string {
  const timestamp = new Date(record.timestamp).getTime();
  const method = record.method.replace(/\//g, "_");
  const id = record.id ?? "null";
  const server = record.metadata.serverName;
  return `${timestamp}-${method}-${id}-${server}`;
}

/**
 * Map MCP method names to UI event types
 */
function mapMethodToEventType(method: string): UIEventType {
  if (method === METHODS.INITIALIZE) return "initialize";
  if (method === METHODS.PING) return "ping";
  if (method === METHODS.TOOLS.LIST) return "tool_list";
  if (method === METHODS.TOOLS.CALL) return "tool_call";
  if (method === METHODS.RESOURCES.LIST) return "resource_list";
  if (method === METHODS.RESOURCES.READ) return "resource_read";
  if (method === METHODS.PROMPTS.LIST) return "prompt_list";
  if (method === METHODS.PROMPTS.GET) return "prompt_get";
  if (method === METHODS.COMPLETION.COMPLETE) return "completion";
  if (method === METHODS.ELICITATION.CREATE) return "elicitation";
  if (method.startsWith("notifications/")) return "notification";
  return "unknown";
}

/**
 * Determine the status based on response and HTTP status
 */
function determineEventStatus(record: CaptureRecord): UIEventStatus {
  // If there's a JSON-RPC error, it's an error
  if (record.response.error) return "error";

  // Check HTTP status
  if (record.metadata.httpStatus >= 400) return "error";
  if (record.metadata.httpStatus >= 200 && record.metadata.httpStatus < 300)
    return "success";

  // Notifications are typically info
  if (record.method.startsWith("notifications/")) return "info";

  return "success";
}

/**
 * Generate a human-readable summary for the event
 */
function generateEventSummary(
  record: CaptureRecord,
  type: UIEventType,
  _status: UIEventStatus,
): string {
  const duration = `${record.metadata.durationMs}ms`;

  if (record.response.error) {
    return `${record.response.error.message} (${duration})`;
  }

  switch (type) {
    case "initialize":
      return `Client initialized: ${record.metadata.client?.name || "unknown"} (${duration})`;
    case "ping":
      return `Ping (${duration})`;
    case "tool_list": {
      const toolCount = extractToolCount(record);
      return `Listed ${toolCount} tools (${duration})`;
    }
    case "tool_call": {
      const toolName = extractToolName(record);
      return `Called tool: ${toolName} (${duration})`;
    }
    case "resource_list": {
      const resourceCount = extractResourceCount(record);
      return `Listed ${resourceCount} resources (${duration})`;
    }
    case "resource_read": {
      const resourceUri = extractResourceUri(record);
      return `Read resource: ${resourceUri} (${duration})`;
    }
    case "prompt_list": {
      const promptCount = extractPromptCount(record);
      return `Listed ${promptCount} prompts (${duration})`;
    }
    case "prompt_get": {
      const promptName = extractPromptName(record);
      return `Retrieved prompt: ${promptName} (${duration})`;
    }
    case "notification": {
      const notificationType = record.method.replace("notifications/", "");
      return `Notification: ${notificationType} (${duration})`;
    }
    default:
      return `${record.method} (${duration})`;
  }
}

/**
 * Extract detailed information based on event type
 */
function extractEventDetails(
  record: CaptureRecord,
  type: UIEventType,
): UIEventDetails | undefined {
  try {
    switch (type) {
      case "initialize":
        return {
          type: "initialize",
          // @ts-expect-error fake data utils its fine
          clientInfo: record.request.params?.clientInfo ||
            record.metadata.client || { name: "unknown", version: "unknown" },
          // @ts-expect-error fake data utils its fine
          serverInfo: record.response.result?.serverInfo,
          // @ts-expect-error fake data utils its fine
          capabilities: record.response.result?.capabilities,
        };

      case "tool_list": {
        // @ts-expect-error fake data utils its fine
        const tools = record.response.result?.tools || [];
        return {
          type: "tool_list",
          // biome-ignore lint/suspicious/noExplicitAny: fake data utils its fine
          tools: tools.map((tool: any) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        };
      }

      case "tool_call": {
        const toolCallParams = record.request.params || {};
        const toolCallResult = record.response.result;
        return {
          type: "tool_call",
          // @ts-expect-error fake data utils its fine
          toolName: toolCallParams.name || "unknown",
          // @ts-expect-error fake data utils its fine
          arguments: toolCallParams.arguments || {},
          result: toolCallResult
            ? {
                // @ts-expect-error fake data utils its fine
                content: Array.isArray(toolCallResult.content)
                  ? // @ts-expect-error fake data utils its fine
                    toolCallResult.content
                  : [{ type: "text", text: JSON.stringify(toolCallResult) }],
                isError: !!record.response.error,
              }
            : undefined,
        };
      }

      case "resource_list": {
        // @ts-expect-error fake data utils its fine
        const resources = record.response.result?.resources || [];
        return {
          type: "resource_list",
          // biome-ignore lint/suspicious/noExplicitAny: fake data utils its fine
          resources: resources.map((resource: any) => ({
            uri: resource.uri,
            name: resource.name,
            description: resource.description,
            mimeType: resource.mimeType,
          })),
        };
      }

      case "resource_read": {
        const resourceParams = record.request.params || {};
        const resourceResult = record.response.result;
        return {
          type: "resource_read",
          resource: {
            // @ts-expect-error fake data utils its fine
            uri: resourceParams.uri || "unknown",
            // @ts-expect-error fake data utils its fine
            mimeType: resourceResult?.mimeType,
          },
          // @ts-expect-error fake data utils its fine
          content: resourceResult?.contents || [
            { type: "text", text: "No content" },
          ],
        };
      }

      case "prompt_list": {
        // @ts-expect-error fake data utils its fine
        const prompts = record.response.result?.prompts || [];
        return {
          type: "prompt_list",
          // biome-ignore lint/suspicious/noExplicitAny: fake data utils its fine
          prompts: prompts.map((prompt: any) => ({
            name: prompt.name,
            description: prompt.description,
            arguments: prompt.arguments,
          })),
        };
      }

      case "prompt_get": {
        const promptParams = record.request.params || {};
        const promptResult = record.response.result;
        return {
          type: "prompt_get",
          prompt: {
            // @ts-expect-error fake data utils its fine
            name: promptParams.name || "unknown",
            // @ts-expect-error fake data utils its fine
            arguments: promptParams.arguments || {},
          },
          // @ts-expect-error fake data utils its fine
          messages: promptResult?.messages || [],
        };
      }

      case "notification":
        return {
          type: "notification",
          level: "info", // Could be extracted from params if available
          message: `Notification: ${record.method}`,
          notificationType: record.method,
        };

      default:
        return {
          type: "generic",
          request: record.request.params,
          response: record.response.result,
        };
    }
  } catch (_error) {
    // If parsing fails, return generic details
    return {
      type: "generic",
      request: record.request.params,
      response: record.response.result,
    };
  }
}

// Helper functions to extract specific information
function extractToolCount(record: CaptureRecord): number {
  // @ts-expect-error fake data utils its fine
  return record.response.result?.tools?.length || 0;
}

function extractToolName(record: CaptureRecord): string {
  // @ts-expect-error fake data utils its fine
  return record.request.params?.name || "unknown";
}

function extractResourceCount(record: CaptureRecord): number {
  // @ts-expect-error fake data utils its fine
  return record.response.result?.resources?.length || 0;
}

function extractResourceUri(record: CaptureRecord): string {
  // @ts-expect-error fake data utils its fine
  return record.request.params?.uri || "unknown";
}

function extractPromptCount(record: CaptureRecord): number {
  // @ts-expect-error fake data utils its fine
  return record.response.result?.prompts?.length || 0;
}

function extractPromptName(record: CaptureRecord): string {
  // @ts-expect-error fake data utils its fine
  return record.request.params?.name || "unknown";
}
