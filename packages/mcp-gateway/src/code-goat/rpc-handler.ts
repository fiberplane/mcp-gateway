import { buildToolCallRequest } from "./mcp-utils";
import type { CodeModeServer } from "./types";

/**
 * Builds an RPC handler for code mode.
 * This is the logic that gets executed within code mode scripts by routing the script's rpc calls to tool calls against the actual MCP servers.
 *
 * @todo - Parse and decode the json rpc response
 * @todo - Handle fetch errors, non-200 status, decoding errors, etc
 */
export function buildRpcHandler(servers: CodeModeServer[], sessionId?: string) {
  return async (serverName: string, toolName: string, args: unknown) => {
    const server = servers.find((s) => s.originalName === serverName);
    if (!server) {
      console.error("Could not find server in internal registry:", serverName);
      throw new Error("Could not find server in internal registry");
    }

    // Create the JSON RPC request to the actual MCP server
    const toolCallRequest = buildToolCallRequest({
      serverUrl: server.url,
      sessionId,
      toolName,
      args,
    });

    const toolCallResponse = await fetch(toolCallRequest);

    // TODO - Parse the response
    // biome-ignore lint/suspicious/noExplicitAny: prototyping
    const responseMessage: any = await toolCallResponse.json();

    return (
      responseMessage?.result?.structuredContent ||
      responseMessage?.result?.content
    );
  };
}
