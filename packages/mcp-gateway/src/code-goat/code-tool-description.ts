import type { McpServer } from "../registry";
import { generateTypes } from "./api-generation/generate-types";
import { toCodeModeServer } from "./types";

export const CODE_GOAT_TOOL_NAME = "execute_code";

/**
 * Helper for creating the code mode tool description, given the type definitions for the mcpTools module
 */
export function createCodeToolDescriptionFromTypes(typeDefinitions: string) {
  return {
    name: CODE_GOAT_TOOL_NAME,
    description: `Execute JavaScript code with access to MCP tools via the mcpTools object.

Available API:
\`\`\`typescript
${typeDefinitions}
\`\`\`

Example usage:
\`\`\`javascript
// Call tools using mcpTools.<serverName>.<toolName>()
const result = await mcpTools.TheWeatherChannel.getWeather({ location: "San Francisco" });
console.log("Weather:", result);
\`\`\``,
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description:
            "JavaScript code to execute. Use the mcpTools object to call MCP tools.",
        },
      },
      required: ["code"],
    },
  };
}

/**
 * Helper for creating the latest code mode tool description, given the latest cached tools from the server
 */
export async function createCodeToolDescriptionFromServers(
  servers: McpServer[],
) {
  // Generate TypeScript type definitions
  const typeDefinitions = await generateTypes(servers.map(toCodeModeServer));

  return createCodeToolDescriptionFromTypes(typeDefinitions);
}
