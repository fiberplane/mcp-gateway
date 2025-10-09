// TODO - Write utilities for ...

import type { McpServer } from "../registry";

type ToolsListRequestOptions = {
  sessionId?: string;
  requestId?: string;
};

/**
 * Build an HTTP Request to make a JSON RPC request to fetch the tools list
 *
 * Intended to be a one-off request + response (not streaming)
 * in order to fetch and cache the tools list of a server behind the gateway
 */
export function buildToolsListRequest(
  server: McpServer,
  options: ToolsListRequestOptions,
) {
  const { sessionId } = options;

  const requestId = options.requestId ?? crypto.randomUUID().slice(0, 8);

  const toolsListRequest = {
    jsonrpc: "2.0",
    id: requestId,
    method: "tools/list",
  };

  const headers = new Headers();
  if (sessionId) {
    headers.set("Mcp-Session-Id", sessionId);
  }
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");

  return new Request(server.url, {
    method: "POST",
    headers,
    body: JSON.stringify(toolsListRequest),
  });
}

type ToolCallRequestOptions = {
  sessionId?: string;
  serverUrl: string;
  toolName: string;
  args: unknown;
};

/**
 * Build an HTTP Request to make a JSON RPC request
 */
export function buildToolCallRequest(options: ToolCallRequestOptions) {
  const { sessionId, serverUrl, toolName, args } = options;

  const requestId = crypto.randomUUID().slice(0, 8);

  const createToolCallRequest = {
    jsonrpc: "2.0",
    id: requestId,
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const headers = new Headers();
  if (sessionId) {
    headers.set("Mcp-Session-Id", sessionId);
  }
  // NOTE - Do not want the complexity of handling a streaming response, so we only accept json
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");

  return new Request(serverUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(createToolCallRequest),
  });
}
