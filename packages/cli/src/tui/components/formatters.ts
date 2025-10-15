import type { LogEntry } from "@fiberplane/mcp-gateway-types";

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
    const content = ` ${toolName}${argStr ? `(${argStr})` : ""}`;
    return content.length > 20 ? `${content.slice(0, 20)}...` : content;
  }

  // resources/read: show URI
  if (log.method === "resources/read") {
    const uri = params.uri as string;
    const content = ` ${uri}`;
    return content.length > 20 ? `${content.slice(0, 20)}...` : content;
  }

  // prompts/get: show prompt name and arguments
  if (log.method === "prompts/get") {
    const name = params.name as string;
    const args = params.arguments as Record<string, unknown> | undefined;
    if (args && Object.keys(args).length > 0) {
      const argStr = Object.entries(args)
        .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
        .join(", ");
      const content = ` ${name}(${argStr})`;
      return content.length > 20 ? `${content.slice(0, 20)}...` : content;
    }
    const content = ` ${name}`;
    return content.length > 20 ? `${content.slice(0, 20)}...` : content;
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
    return `→ ${serverInfo.name}@${serverInfo.version}`;
  }

  // tools/list: show count and first few tool names
  if (log.method === "tools/list") {
    const tools = result.tools as Array<{ name: string }>;
    const toolNames = tools.slice(0, 3).map((t) => t.name);
    const more = tools.length > 3 ? `, +${tools.length - 3}` : "";
    return `${tools.length} tools: ${toolNames.join(", ")}${more}`;
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
      return `"${truncated}"`;
    }
  }

  // resources/list: show count and first few resource names
  if (log.method === "resources/list") {
    const resources = result.resources as Array<{ name: string; uri: string }>;
    const count = resources?.length || 0;
    if (count === 0) return "0 resources";

    const resourceNames = resources.slice(0, 2).map((r) => r.name);
    const more = count > 2 ? `, +${count - 2}` : "";
    const content = `${count} resources: ${resourceNames.join(", ")}${more}`;
    return content.length > 20 ? `${content.slice(0, 20)}...` : content;
  }

  // resources/templates/list: show count and first few template names
  if (log.method === "resources/templates/list") {
    const templates = result.resourceTemplates as Array<{
      name: string;
      uriTemplate: string;
    }>;
    const count = templates?.length || 0;
    if (count === 0) return "0 templates";

    const templateNames = templates.slice(0, 2).map((t) => t.name);
    const more = count > 2 ? `, +${count - 2}` : "";
    const content = `${count} templates: ${templateNames.join(", ")}${more}`;
    return content.length > 20 ? `${content.slice(0, 20)}...` : content;
  }

  // prompts/list: show count and first few prompt names
  if (log.method === "prompts/list") {
    const prompts = result.prompts as Array<{ name: string }>;
    const count = prompts?.length || 0;
    if (count === 0) return "0 prompts";

    const promptNames = prompts.slice(0, 2).map((p) => p.name);
    const more = count > 2 ? `, +${count - 2}` : "";
    const content = `${count} prompts: ${promptNames.join(", ")}${more}`;
    return content.length > 20 ? `${content.slice(0, 20)}...` : content;
  }

  // prompts/get: show prompt name and message count
  if (log.method === "prompts/get") {
    const description = result.description as string | undefined;
    const messages = result.messages as Array<unknown>;
    const messageCount = messages?.length || 0;

    const content = description
      ? `"${description}" (${messageCount} ${messageCount === 1 ? "message" : "messages"})`
      : `${messageCount} ${messageCount === 1 ? "message" : "messages"}`;
    return content.length > 17 ? `${content.slice(0, 17)}...` : content;
  }

  return "";
}
