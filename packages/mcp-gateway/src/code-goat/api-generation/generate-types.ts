import { compile as compileJsonSchemaToTs } from "json-schema-to-typescript";
import type { McpServer } from "../../registry";
import { toCamelCase, toPascalCase } from "./utils";

export async function generateTypes(servers: Array<McpServer>) {
  let availableTools = "";
  let availableTypes = "";

  for (const server of servers) {
    // TODO - Transform McpServer to a data type that we work with better across code-mode
    const _serverName = toPascalCase(server.name);

    for (const tool of server.tools ?? []) {
      const inputJsonType = await compileJsonSchemaToTs(
        tool.inputSchema,
        `${toCamelCase(tool.name)}Input`,
        {
          format: false,
          bannerComment: " ",
        },
      );

      const outputJsonType = tool.outputSchema
        ? await compileJsonSchemaToTs(
            tool.outputSchema,
            `${toCamelCase(tool.name)}Output`,
            {
              format: false,
              bannerComment: " ",
            },
          )
        : `interface ${toCamelCase(tool.name)}Output { [key: string]: any }`;

      const InputType = inputJsonType
        .trim()
        .replace("export interface", "interface");

      const OutputType = outputJsonType
        .trim()
        .replace("export interface", "interface");

      availableTypes += `\n${InputType}`;
      availableTypes += `\n${OutputType}`;
      availableTools += `\n/*\n\t${tool.description?.trim()}\n\t*/`;
      availableTools += `\n${toCamelCase(tool.name)}: (input: ${toCamelCase(tool.name)}Input) => Promise<${toCamelCase(tool.name)}Output>;`;
      availableTools += "\n";
    }

    availableTools = `declare module "${server.name}" { \n${availableTools} }`;
  }

  // IF WE EVER WANNA NAMESPACE BY SERVER
  //
  if (serverName) {
    availableTools = `\ndeclare const ${toPascalCase(serverName)}: {${availableTools}}`;
  }

  return `
${availableTypes}
${availableTools}
      `;
}
