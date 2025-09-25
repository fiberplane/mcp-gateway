import {
  type CallToolRequest,
  CallToolRequestSchema,
  type GetPromptRequest,
  GetPromptRequestSchema,
  type InitializeRequest,
  InitializeRequestSchema,
  type JSONRPCError,
  JSONRPCErrorSchema,
  type JSONRPCNotification,
  JSONRPCNotificationSchema,
  type JSONRPCRequest,
  JSONRPCRequestSchema,
  type JSONRPCResponse,
  JSONRPCResponseSchema,
  type ReadResourceRequest,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export interface ParsedMCPMessage {
  requestId?: string;
  method?: string;
  protocolVersion: string;

  // Tool-specific fields
  toolName?: string;
  arguments?: Record<string, unknown>; // Store full arguments, not hash

  // Prompt-specific fields
  promptName?: string;

  // Resource-specific fields
  resourceUri?: string;

  // Response fields
  isError?: boolean;
  errorCode?: number;
  contentTypes?: string[];
  contentCount?: number;
  content?: unknown; // Store actual content for small responses

  // Session fields
  sessionId?: string;
  clientInfo?: { name: string; version: string };

  // Metadata
  timestamp: number;
  direction: "request" | "response";
}

export function parseMCPMessage(
  body: string,
  isRequest: boolean,
): ParsedMCPMessage | null {
  if (!body.trim()) {
    return null;
  }

  try {
    // Handle single messages using OFFICIAL MCP SDK schemas
    const parsed = JSON.parse(body);

    if (isRequest) {
      // Try request schema first
      const requestValidation = JSONRPCRequestSchema.safeParse(parsed);
      if (requestValidation.success) {
        // Check for specific method types
        if (parsed.method === "tools/call") {
          const toolValidation = CallToolRequestSchema.safeParse(parsed);
          if (toolValidation.success) {
            return parseToolCall(toolValidation.data, parsed);
          }
          // Invalid tools/call request - don't fall back to generic
          return null;
        }

        if (parsed.method === "prompts/get") {
          const promptValidation = GetPromptRequestSchema.safeParse(parsed);
          if (promptValidation.success) {
            return parsePromptGet(promptValidation.data, parsed);
          }
          // Invalid prompts/get request - don't fall back to generic
          return null;
        }

        if (parsed.method === "resources/read") {
          const resourceValidation =
            ReadResourceRequestSchema.safeParse(parsed);
          if (resourceValidation.success) {
            return parseResourceRead(resourceValidation.data, parsed);
          }
          // Invalid resources/read request - don't fall back to generic
          return null;
        }

        if (parsed.method === "initialize") {
          const initValidation = InitializeRequestSchema.safeParse(parsed);
          if (initValidation.success) {
            return parseInitialize(initValidation.data, parsed);
          }
          // Invalid initialize request - don't fall back to generic
          return null;
        }

        return parseGenericMCPMessage(requestValidation.data, isRequest);
      }

      // Try notification schema for requests without ID
      const notificationValidation =
        JSONRPCNotificationSchema.safeParse(parsed);
      if (notificationValidation.success) {
        return parseGenericMCPMessage(notificationValidation.data, isRequest);
      }

      return null;
    }
    // For responses, try success response schema first
    const responseValidation = JSONRPCResponseSchema.safeParse(parsed);
    if (responseValidation.success) {
      return parseGenericMCPMessage(responseValidation.data, isRequest);
    }

    // Try error response schema
    const errorValidation = JSONRPCErrorSchema.safeParse(parsed);
    if (errorValidation.success) {
      return parseGenericMCPMessage(errorValidation.data, isRequest);
    }

    // Handle special case where JSON-RPC error has id: null (parse errors)
    // This is according to JSON-RPC 2.0 spec but the MCP schema doesn't allow it
    // Only accept this if it's a pure error response (no result field)
    if (
      parsed.jsonrpc === "2.0" &&
      "error" in parsed &&
      !("result" in parsed) &&
      parsed.error &&
      typeof parsed.error.code === "number" &&
      typeof parsed.error.message === "string" &&
      (parsed.id === null ||
        typeof parsed.id === "string" ||
        typeof parsed.id === "number")
    ) {
      return parseGenericMCPMessage(parsed as JSONRPCError, isRequest);
    }

    return null;
  } catch {
    return null;
  }
}

function parseToolCall(
  data: CallToolRequest,
  originalParsed?: JSONRPCRequest,
): ParsedMCPMessage {
  return {
    requestId:
      originalParsed?.id != null ? String(originalParsed.id) : undefined,
    method: data.method,
    protocolVersion: "2.0",
    toolName: data.params.name,
    arguments: data.params.arguments || {},
    timestamp: Date.now(),
    direction: "request",
  };
}

function parsePromptGet(
  data: GetPromptRequest,
  originalParsed?: JSONRPCRequest,
): ParsedMCPMessage {
  return {
    requestId:
      originalParsed?.id != null ? String(originalParsed.id) : undefined,
    method: data.method,
    protocolVersion: "2.0",
    promptName: data.params.name,
    arguments: data.params.arguments || {},
    timestamp: Date.now(),
    direction: "request",
  };
}

function parseResourceRead(
  data: ReadResourceRequest,
  originalParsed?: JSONRPCRequest,
): ParsedMCPMessage {
  return {
    requestId:
      originalParsed?.id != null ? String(originalParsed.id) : undefined,
    method: data.method,
    protocolVersion: "2.0",
    resourceUri: data.params.uri,
    timestamp: Date.now(),
    direction: "request",
  };
}

function parseInitialize(
  data: InitializeRequest,
  originalParsed?: JSONRPCRequest,
): ParsedMCPMessage {
  return {
    requestId:
      originalParsed?.id != null ? String(originalParsed.id) : undefined,
    method: data.method,
    protocolVersion: data.params.protocolVersion,
    clientInfo: data.params.clientInfo,
    // sessionId should come from request headers or a separate field, not the JSON-RPC payload
    sessionId: undefined,
    timestamp: Date.now(),
    direction: "request",
  };
}

function parseGenericMCPMessage(
  data: JSONRPCRequest | JSONRPCResponse | JSONRPCError | JSONRPCNotification,
  isRequest: boolean,
): ParsedMCPMessage {
  const base: ParsedMCPMessage = {
    protocolVersion: "2.0",
    timestamp: Date.now(),
    direction: isRequest ? "request" : "response",
  };

  if ("method" in data) {
    // Request or notification message
    const message = data as JSONRPCRequest | JSONRPCNotification;
    base.requestId =
      "id" in message && message.id != null ? String(message.id) : undefined;
    base.method = message.method;
  } else if ("error" in data) {
    // Error response message
    const errorResponse = data as JSONRPCError;
    // Handle special case where id can be null for parse errors
    base.requestId =
      errorResponse.id !== undefined ? String(errorResponse.id) : undefined;
    base.isError = true;
    base.errorCode = errorResponse.error.code;
  } else {
    // Success response message
    const response = data as JSONRPCResponse;
    base.requestId = response.id != null ? String(response.id) : undefined;

    // Try to extract content information from result
    if ("result" in response && response.result) {
      const result = response.result as Record<string, unknown>;

      // Check for non-standard error format (isError: true inside result)
      if (result.isError === true) {
        base.isError = true;
      }

      if (result.content && Array.isArray(result.content)) {
        base.contentCount = result.content.length;
        base.contentTypes = result.content
          .map((c: Record<string, unknown>) => c.type as string)
          .filter(Boolean);
        // Store actual content for small responses (for span attributes)
        base.content = result.content;
      }
    }
  }

  return base;
}

// Helper function for streaming MCP message extraction
export function extractCompleteMessages(buffer: string): {
  messages: string[];
  remaining: string;
} {
  const lines = buffer.split("\n");
  const messages: string[] = [];
  let remaining = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();

    // Skip empty lines
    if (!line) {
      continue;
    }

    // Handle SSE data lines
    if (line.startsWith("data: ")) {
      const jsonData = line.substring(6);
      try {
        JSON.parse(jsonData); // Validate JSON
        messages.push(jsonData);
      } catch {
        // Try to determine if this is incomplete JSON or just malformed
        const trimmed = jsonData.trim();
        // If it starts with { but doesn't end with }, it's likely incomplete
        if (trimmed.startsWith("{") && !trimmed.endsWith("}")) {
          // Incomplete JSON, add to remaining
          remaining = lines.slice(i).join("\n");
          break;
        }
        // Otherwise, it's just malformed - skip this line and continue
      }
      continue;
    }

    // Skip SSE control lines
    if (
      line.startsWith("event:") ||
      line.startsWith("id:") ||
      line.startsWith("retry:")
    ) {
      continue;
    }

    // Try to parse as complete JSON-RPC message
    try {
      JSON.parse(line);
      messages.push(line);
    } catch {
      // Incomplete JSON, everything from here is remaining
      remaining = lines.slice(i).join("\n");
      break;
    }
  }

  return { messages, remaining };
}

// CRITICAL: Always use MCP SDK schemas, never write custom validation
// This ensures we stay compatible with MCP spec updates automatically
