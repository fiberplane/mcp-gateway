import type { LogEntry } from "../../tui/state";

// Format request-specific details
export function formatRequestDetails(log: LogEntry): string {
  if (!log.request?.params) return "";

  const params = log.request.params as Record<string, unknown>;

  // tools/call: show tool name and args
  if (log.method === "tools/call") {
    const toolName = params.name as string;
    const args = params.arguments as Record<string, unknown>;
    const argStr = Object.entries(args || {})
      .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
      .join(", ");
    return ` ${toolName}${argStr ? `(${argStr})` : ""}`;
  }

  // resources/read: show URI
  if (log.method === "resources/read") {
    const uri = params.uri as string;
    return ` ${uri}`;
  }

  return "";
}

// Format response-specific details
export function formatResponseDetails(log: LogEntry): string {
  if (!log.response || "error" in log.response) return "";

  const result = log.response.result as Record<string, unknown>;

  // initialize: show server name and version
  if (log.method === "initialize") {
    const serverInfo = result.serverInfo as { name: string; version: string };
    return ` → ${serverInfo.name}@${serverInfo.version}`;
  }

  // tools/list: show count and first few tool names
  if (log.method === "tools/list") {
    const tools = result.tools as Array<{ name: string }>;
    const toolNames = tools.slice(0, 3).map((t) => t.name);
    const more = tools.length > 3 ? `, +${tools.length - 3}` : "";
    return ` ${tools.length} tools: ${toolNames.join(", ")}${more}`;
  }

  // tools/call: show result text (truncated)
  if (log.method === "tools/call") {
    const content = result.content as Array<{ type: string; text?: string }>;
    const textContent = content?.find((c) => c.type === "text")?.text;
    if (textContent) {
      const truncated =
        textContent.length > 40
          ? `${textContent.slice(0, 40)}...`
          : textContent;
      return ` "${truncated}"`;
    }
  }

  // resources/list: show count
  if (log.method === "resources/list") {
    const resources = result.resources as unknown[];
    return ` ${resources?.length || 0} resources`;
  }

  // prompts/list: show count
  if (log.method === "prompts/list") {
    const prompts = result.prompts as unknown[];
    return ` ${prompts?.length || 0} prompts`;
  }

  return "";
}
