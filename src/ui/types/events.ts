import type { ClientInfo } from "../../schemas.js";

// UI-friendly event data structures
export type UIEventStatus = "success" | "error" | "pending" | "info";

export type UIEventType =
  | "initialize"
  | "ping"
  | "tool_list"
  | "tool_call"
  | "resource_list"
  | "resource_read"
  | "prompt_list"
  | "prompt_get"
  | "notification"
  | "completion"
  | "elicitation"
  | "unknown";

export interface UIEventMetadata {
  serverName: string;
  sessionId: string;
  durationMs: number;
  httpStatus: number;
  client?: ClientInfo;
  remoteAddress?: string;
}

// Core UI event structure
export interface UIEvent {
  id: string; // unique identifier for React keys
  timestamp: string; // ISO string
  type: UIEventType;
  method: string; // original MCP method
  requestId: string | number | null;
  status: UIEventStatus;
  metadata: UIEventMetadata;
  summary: string; // human-readable summary
  details?: UIEventDetails;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Expandable event details based on event type
export type UIEventDetails =
  | {
      type: "initialize";
      clientInfo: ClientInfo;
      serverInfo?: {
        name: string;
        version: string;
      };
      capabilities?: unknown;
    }
  | {
      type: "tool_list";
      tools: Array<{
        name: string;
        description?: string;
        inputSchema?: unknown;
      }>;
    }
  | {
      type: "tool_call";
      toolName: string;
      arguments: Record<string, unknown>;
      result?: {
        content: Array<{
          type: "text" | "image" | "resource";
          text?: string;
          uri?: string;
          mimeType?: string;
        }>;
        isError?: boolean;
      };
    }
  | {
      type: "resource_list";
      resources: Array<{
        uri: string;
        name?: string;
        description?: string;
        mimeType?: string;
      }>;
    }
  | {
      type: "resource_read";
      resource: {
        uri: string;
        name?: string;
        mimeType?: string;
      };
      content: Array<{
        type: "text" | "image" | "resource";
        text?: string;
        uri?: string;
        mimeType?: string;
      }>;
    }
  | {
      type: "prompt_list";
      prompts: Array<{
        name: string;
        description?: string;
        arguments?: Array<{
          name: string;
          description?: string;
          required?: boolean;
        }>;
      }>;
    }
  | {
      type: "prompt_get";
      prompt: {
        name: string;
        arguments: Record<string, unknown>;
      };
      messages: Array<{
        role: "system" | "user" | "assistant";
        content: Array<{
          type: "text" | "image" | "resource";
          text?: string;
          uri?: string;
          mimeType?: string;
        }>;
      }>;
    }
  | {
      type: "notification";
      level: "info" | "warn" | "error";
      message: string;
      notificationType?: string;
    }
  | {
      type: "generic";
      request?: unknown;
      response?: unknown;
    };

// Filter and grouping options for the UI
export interface UIEventFilters {
  serverNames?: string[];
  eventTypes?: UIEventType[];
  statuses?: UIEventStatus[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

export interface UIEventGroup {
  label: string;
  events: UIEvent[];
  count: number;
}
