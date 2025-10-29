import type { LogEntry } from "@fiberplane/mcp-gateway-types";
import { z } from "zod";

// MCP request parameter schemas
const toolsCallParamsSchema = z.object({
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()).optional(),
});

const resourcesReadParamsSchema = z.object({
  uri: z.string(),
});

const promptsGetParamsSchema = z.object({
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()).optional(),
});

// MCP response result schemas
const initializeResultSchema = z.object({
  serverInfo: z.object({
    name: z.string(),
    version: z.string(),
  }),
});

const toolsListResultSchema = z.object({
  tools: z.array(z.object({ name: z.string() })),
});

const toolsCallResultSchema = z.object({
  content: z.array(
    z.object({
      type: z.string(),
      text: z.string().optional(),
    }),
  ),
});

const resourcesListResultSchema = z.object({
  resources: z.array(
    z.object({
      name: z.string(),
      uri: z.string(),
    }),
  ),
});

const resourceTemplatesListResultSchema = z.object({
  resourceTemplates: z.array(
    z.object({
      name: z.string(),
      uriTemplate: z.string(),
    }),
  ),
});

const promptsListResultSchema = z.object({
  prompts: z.array(z.object({ name: z.string() })),
});

const promptsGetResultSchema = z.object({
  description: z.string().optional(),
  messages: z.array(z.unknown()),
});

// Format request-specific details
export function formatRequestDetails(log: LogEntry): string {
  if (!log.request?.params) return "";

  // tools/call: show tool name and args
  if (log.method === "tools/call") {
    const parsed = toolsCallParamsSchema.safeParse(log.request.params);
    if (!parsed.success) return "";

    const { name: toolName, arguments: args } = parsed.data;
    const argStr = Object.entries(args || {})
      .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
      .join(", ");
    const content = ` ${toolName}${argStr ? `(${argStr})` : ""}`;
    return content.length > 20 ? `${content.slice(0, 20)}...` : content;
  }

  // resources/read: show URI
  if (log.method === "resources/read") {
    const parsed = resourcesReadParamsSchema.safeParse(log.request.params);
    if (!parsed.success) return "";

    const content = ` ${parsed.data.uri}`;
    return content.length > 20 ? `${content.slice(0, 20)}...` : content;
  }

  // prompts/get: show prompt name and arguments
  if (log.method === "prompts/get") {
    const parsed = promptsGetParamsSchema.safeParse(log.request.params);
    if (!parsed.success) return "";

    const { name, arguments: args } = parsed.data;
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

  // initialize: show server name and version
  if (log.method === "initialize") {
    const parsed = initializeResultSchema.safeParse(log.response.result);
    if (!parsed.success) return "";

    const { serverInfo } = parsed.data;
    return `→ ${serverInfo.name}@${serverInfo.version}`;
  }

  // tools/list: show count and first few tool names
  if (log.method === "tools/list") {
    const parsed = toolsListResultSchema.safeParse(log.response.result);
    if (!parsed.success) return "";

    const { tools } = parsed.data;
    if (tools.length === 0) return "0 tools";

    const preview = tools
      .slice(0, 3)
      .map((t) => t.name)
      .join(", ");
    const more = tools.length > 3 ? `, +${tools.length - 3}` : "";
    return `${tools.length} tools: ${preview}${more}`;
  }

  // tools/call: show result text (truncated)
  if (log.method === "tools/call") {
    const parsed = toolsCallResultSchema.safeParse(log.response.result);
    if (!parsed.success) return "";

    const textContent = parsed.data.content.find(
      (c) => c.type === "text",
    )?.text;
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
    const parsed = resourcesListResultSchema.safeParse(log.response.result);
    if (!parsed.success) return "";

    const { resources } = parsed.data;
    if (resources.length === 0) return "0 resources";

    const preview = resources
      .slice(0, 2)
      .map((r) => r.name)
      .join(", ");
    const more = resources.length > 2 ? `, +${resources.length - 2}` : "";
    const content = `${resources.length} resources: ${preview}${more}`;
    return content.length > 20 ? `${content.slice(0, 20)}...` : content;
  }

  // resources/templates/list: show count and first few template names
  if (log.method === "resources/templates/list") {
    const parsed = resourceTemplatesListResultSchema.safeParse(
      log.response.result,
    );
    if (!parsed.success) return "";

    const { resourceTemplates } = parsed.data;
    if (resourceTemplates.length === 0) return "0 templates";

    const preview = resourceTemplates
      .slice(0, 2)
      .map((t) => t.name)
      .join(", ");
    const more =
      resourceTemplates.length > 2 ? `, +${resourceTemplates.length - 2}` : "";
    const content = `${resourceTemplates.length} templates: ${preview}${more}`;
    return content.length > 20 ? `${content.slice(0, 20)}...` : content;
  }

  // prompts/list: show count and first few prompt names
  if (log.method === "prompts/list") {
    const parsed = promptsListResultSchema.safeParse(log.response.result);
    if (!parsed.success) return "";

    const { prompts } = parsed.data;
    if (prompts.length === 0) return "0 prompts";

    const preview = prompts
      .slice(0, 2)
      .map((p) => p.name)
      .join(", ");
    const more = prompts.length > 2 ? `, +${prompts.length - 2}` : "";
    const content = `${prompts.length} prompts: ${preview}${more}`;
    return content.length > 20 ? `${content.slice(0, 20)}...` : content;
  }

  // prompts/get: show prompt name and message count
  if (log.method === "prompts/get") {
    const parsed = promptsGetResultSchema.safeParse(log.response.result);
    if (!parsed.success) return "";

    const { description, messages } = parsed.data;
    const messageCount = messages.length;

    const content = description
      ? `"${description}" (${messageCount} ${messageCount === 1 ? "message" : "messages"})`
      : `${messageCount} ${messageCount === 1 ? "message" : "messages"}`;
    return content.length > 17 ? `${content.slice(0, 17)}...` : content;
  }

  return "";
}
