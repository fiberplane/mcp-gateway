import type { CodeModeServer, CodeModeTool } from "../types";

const __SERVER_DEFINITIONS_TEMPLATE_TAG = "%server-definitions%";

const CLIENT_CODE_TEMPLATE = `
// Generated MCP Tools API - Runtime Implementation

// Export combined API
const mcpTools = {
${__SERVER_DEFINITIONS_TEMPLATE_TAG}
}
`.trim();

/**
 * Construct modules that can make an RPC call to a server's tool
 *
 * Returns typescript code that an LLM can use to script against an MCP server like:
 *   `mcpTools.<ServerName>.<toolName>(<args>)`
 *
 * ```ts
 * const mcpTools = {
 *   // `toServerNamespaceObject` constructs this object
 *   ServerName: {
 *     // `toolToObjectProperty` constructs this property on the object
 *     toolName: async (input) => {
 *       return await __rpcCall("serverName", "toolName", input);
 *     }
 *   }
 * }
 * ```
 *
 */
export function generateApiClient(servers: CodeModeServer[]): string {
  let moduleCode = CLIENT_CODE_TEMPLATE;

  // Generate an object for each server namespace
  const serverImplementations: string[] = [];

  for (const server of servers) {
    const toolImplementations: string[] = [];
    for (const tool of server.tools) {
      // Each tool becomes an async function that calls __rpcCall
      toolImplementations.push(toolToObjectProperty(server, tool));
    }

    // Create the server namespace object
    serverImplementations.push(
      toServerNamespaceObject(server, toolImplementations),
    );
  }

  // Export all server namespaces in a single mcpTools object
  moduleCode = moduleCode.replace(
    __SERVER_DEFINITIONS_TEMPLATE_TAG,
    serverImplementations.join(",\n\n"),
  );

  return moduleCode;
}

function toServerNamespaceObject(
  server: CodeModeServer,
  toolImplementations: string[],
): string {
  return `
  ${server.codeName}: {
    ${toolImplementations.join(",\n")}
  }`;
}

function toolToObjectProperty(server: CodeModeServer, tool: CodeModeTool) {
  return `
    ${tool.codeName}: async (input) => {
      return await __rpcCall('${server.originalName}', '${tool.originalName}', input);
    }`;
}
