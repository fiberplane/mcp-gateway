import { toCamelCase, toPascalCase } from "./utils";

// biome-ignore lint/suspicious/noExplicitAny: add actual type later
type MCPServer = any;

export function generateApiClient(servers: MCPServer[]): string {
  let moduleCode = `// Generated MCP Tools API - Runtime Implementation\n\n`;

  // Generate an object for each server namespace
  const serverImplementations: string[] = [];

  Bun.write("servers.json", JSON.stringify(servers, null, 2));

  for (const server of servers) {
    const toolImplementations: string[] = [];
    const pascalServerName = toPascalCase(server.name);
    console.log("server.tools", server.tools);

    for (const tool of server.tools) {
      const camelCaseToolName = toCamelCase(tool.name);
      // Each tool becomes an async function that calls __rpcCall
      toolImplementations.push(`
  ${camelCaseToolName}: async (input) => {
    return await __rpcCall('${pascalServerName}', '${camelCaseToolName}', input);
  }`);
    }

    serverImplementations.push(`
${toolImplementations.join(",\n")}
`);

    // Create the server namespace object - COMMENTED OUT BECAUSE WE NEED TO SYNCHRONIZE MODULE DEFINITIONS IN TYPES WITH ACTUAL CLIENT DEFINITION
    //     serverImplementations.push(`
    // const ${camelCaseServerName} = {${toolImplementations.join(",\n")}
    // };`);
  }


  // Export all server namespaces in a single mcpTools object
  // const serverNames = servers.map((s) => toPascalCase(s.name));
  moduleCode += `\n\n// Export combined API\nconst mcpTools = {\n`;

  moduleCode += serverImplementations.join("\n\n");

  // moduleCode +=
  // moduleCode += serverNames.map((name) => `  ${name}`).join(",\n");
  moduleCode += `\n};\n`;

  return moduleCode;
}
