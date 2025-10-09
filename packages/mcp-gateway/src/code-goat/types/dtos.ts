import type { McpServer, McpServerTool } from "../../registry";
import { toCamelCase, toPascalCase } from "../api-generation/utils";
import type { CodeModeServer, CodeModeTool } from "./types";

const GENERIC_OUTPUT_SCHEMA = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {},
  additionalProperties: true,
});

export function toCodeModeServer(server: McpServer): CodeModeServer {
  return {
    url: server.url,
    originalName: server.name,
    codeName: toPascalCase(server.name),
    tools: server.tools?.map(toCodeModeServerTool) ?? [],
  };
}

export function toCodeModeServerTool(tool: McpServerTool): CodeModeTool {
  return {
    originalName: tool.name,
    codeName: toCamelCase(tool.name),
    description: tool.description,
    inputSchema: tool.inputSchema,
    // HACK - Translate outputSchema to be Record<string, any>
    //        This does not guarantee structured output of the tool call,
    //        it may be smarter to warn / not allow tools without output schemas
    outputSchema: tool.outputSchema ?? GENERIC_OUTPUT_SCHEMA,
  };
}
