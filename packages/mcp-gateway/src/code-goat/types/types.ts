/**
 * A temporary type to capture JSON Schemas
 * @todo - Could try importing a proper type from `json-schema-to-typescript` package
 *         but I got a type mismatched when I tried, and wanted to push ahead with the code goat prototype
 */
// biome-ignore lint/suspicious/noExplicitAny: add json schema type later
export type TempJsonSchemaType = Record<string, any>;

export type CodeModeTool = {
  /** The name of the tool itself on the actual MCP server */
  originalName: string;
  /** The camelCase name of the tool */
  codeName: string;
  description: string;
  inputSchema: TempJsonSchemaType;
  outputSchema: TempJsonSchemaType;
};

export interface CodeModeServer {
  /** The name of the server inside the gateway's registry */
  originalName: string;
  /** The PascalCase name of the McpServer */
  codeName: string;
  /** The transformed list of of the McpServer's tools */
  tools: Array<CodeModeTool>;
}
