/**
 * Simple client for calling the gateway's MCP optimization tools
 */

interface McpRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

interface McpResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Call a tool on the gateway's MCP server
 */
export async function callGatewayTool(
  port: number,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const request: McpRequest = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const response = await fetch(`http://localhost:${port}/gateway/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Gateway MCP request failed: ${response.statusText}`);
  }

  const data = (await response.json()) as McpResponse;

  if (data.error) {
    throw new Error(`MCP error: ${data.error.message}`);
  }

  // Parse the text content from the response
  if (data.result?.content?.[0]?.text) {
    return JSON.parse(data.result.content[0].text);
  }

  return null;
}
