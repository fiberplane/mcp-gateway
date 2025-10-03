/**
 * A temporary type to capture JSON Schemas
 * @todo - Could try importing a proper type from `json-schema-to-typescript` package
 *         but I got a type mismatched when I tried, and wanted to push ahead with the code goat prototype
 */
// biome-ignore lint/suspicious/noExplicitAny: add json schema type later
export type TempJsonSchemaType = Record<string, any>;

export type CodeModeTool = {
  /** The camelCase name of the McpServer */
  name: string;
  description: string;
  inputSchema: TempJsonSchemaType;
  outputSchema: TempJsonSchemaType;
};

export interface CodeModeServer {
  /** The PascalCase name of the McpServer */
  name: string;
  /** The transformed list of of the McpServer's tools */
  tools: Array<CodeModeTool>;
}
