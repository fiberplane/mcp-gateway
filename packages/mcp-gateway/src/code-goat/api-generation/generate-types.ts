import { compile as compileJsonSchemaToTs } from "json-schema-to-typescript";
import type { CodeModeServer } from "../types";
import { toPascalCase } from "./utils";

export async function generateTypes(servers: Array<CodeModeServer>) {
  let availableTools = "";

  for (const server of servers) {
    let serverTools = "";
    // TODO - Transform McpServer to a data type that we work with better across code-mode
    // const _serverName = toPascalCase(server.name);

    for (const tool of server.tools ?? []) {
      const toolInterfaceName = toPascalCase(tool.codeName);

      const inputJsonType = await compileJsonSchemaToTs(
        tool.inputSchema,
        `${toolInterfaceName}Input`,
        {
          format: false,
          bannerComment: " ",
        },
      );

      const outputJsonType = tool.outputSchema
        ? await compileJsonSchemaToTs(
            tool.outputSchema,
            `${toolInterfaceName}Output`,
            {
              format: false,
              bannerComment: " ",
            },
          )
        : `export interface ${toolInterfaceName}Output { [key: string]: any }`;

      const InputType = inputJsonType.trim();
      const OutputType = outputJsonType.trim();

      serverTools += `${enforceMinLeftPad(InputType, 6)}\n`;
      serverTools += `${enforceMinLeftPad(OutputType, 6)}\n`;
      // TODO - Escape `*/` from the tool description
      serverTools += `
    /**
     * ${tool.description?.trim()}
     */`;
      serverTools += `
    export function ${tool.codeName}(input: ${toolInterfaceName}Input): Promise<${toolInterfaceName}Output>;
`;
    }

    availableTools += `
declare namespace ${server.codeName} {
  ${serverTools}
}`;
  }

  return `
${availableTools}
      `;
}

/**
 * Ensures that every line in `input` has at least `padSize` leading spaces.
 *
 * @param input   The string to be processed (may contain line breaks).
 * @param padSize The minimum number of spaces that must precede each line.
 *
 * @returns A new string where every line begins with `padSize` or more spaces.
 */
export function enforceMinLeftPad(input: string, padSize: number): string {
  // Build a regex that matches from the start of the line up to (but not including)
  // padSize spaces.
  // Example: for padSize = 4 → /^ {0,3}/
  const leadingSpaceRegex = new RegExp(`^ {0,${padSize - 1}}`);

  const padString = " ".repeat(padSize);

  return input
    .split("\n")
    .map((line) => {
      // If the line already starts with at least `padSize` spaces, we leave it untouched.
      if (line.startsWith(padString)) return line;

      // Replace the matched prefix (0‑padSize+1 spaces) with exactly `padString`.
      return line.replace(leadingSpaceRegex, padString);
    })
    .join("\n");
}
