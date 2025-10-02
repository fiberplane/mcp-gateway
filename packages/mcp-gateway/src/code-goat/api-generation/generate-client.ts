import { toCamelCase, toPascalCase } from "./utils";

// biome-ignore lint/suspicious/noExplicitAny: add actual type later
type MCPServer = any;

export function generateApiClient(servers: MCPServer[]): string {
  let moduleCode = `// Generated MCP Tools API - Runtime Implementation\n\n`;

  // Generate an object for each server namespace
  const serverImplementations: string[] = [];

  for (const server of servers) {
    const toolImplementations: string[] = [];
    const camelCaseServerName = toPascalCase(server.name);
    for (const tool of server.tools) {
      const camelCaseToolName = toCamelCase(tool.name);
      // Each tool becomes an async function that calls __rpcCall
      toolImplementations.push(`
  ${camelCaseToolName}: async (input) => {
    return await __rpcCall('${camelCaseServerName}', '${camelCaseToolName}', input);
  }`);
    }

    // Create the server namespace object
    serverImplementations.push(`
const ${camelCaseServerName} = {${toolImplementations.join(",\n")}
};`);
  }

  moduleCode += serverImplementations.join("\n\n");

  // Export all server namespaces in a single mcpTools object
  const serverNames = servers.map((s) => toPascalCase(s.name));
  moduleCode += `\n\n// Export combined API\nconst mcpTools = {\n`;
  moduleCode += serverNames.map((name) => `  ${name}`).join(",\n");
  moduleCode += `\n};\n`;

  return moduleCode;
}
