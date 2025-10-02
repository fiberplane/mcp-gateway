import { compile as compileJsonSchemaToTs } from "json-schema-to-typescript";
import { toCamelCase } from "./utils";

// biome-ignore lint/suspicious/noExplicitAny: add json schema type later
type TempJsonSchemaType = Record<string, any>;

type Tool = {
  name: string;
  inputSchema: TempJsonSchemaType;
  outputSchema?: TempJsonSchemaType;
  description: string;
};

export async function generateTypes(tools: Array<Tool>) {
  let availableTools = "";
  let availableTypes = "";

  for (const tool of tools) {
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
    availableTools += `\n\t/*\n\t${tool.description?.trim()}\n\t*/`;
    availableTools += `\n\t${toCamelCase(tool.name)}: (input: ${toCamelCase(tool.name)}Input) => Promise<${toCamelCase(tool.name)}Output>;`;
    availableTools += "\n";
  }

  availableTools = `\ndeclare const codemode: {${availableTools}}`;

  return `
${availableTypes}
${availableTools}
      `;
}
