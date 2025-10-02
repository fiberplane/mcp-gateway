/**
 * Code Goat - MCP Gateway Code Mode Module
 *
 * This module provides a "code mode" layer for MCP gateways that:
 * 1. Generates TypeScript API definitions from MCP tool schemas
 * 2. Creates a JavaScript runtime API for executing code
 * 3. Executes user code with access to MCP tools
 * 4. Routes tool calls back to actual MCP servers
 *
 * This is an eval-based PROTOTYPE - not suitable for production use.
 */

import { generateApiClient } from "./api-generation/generate-client";
import { generateTypes } from "./api-generation/generate-types";
import {
  type ExecutionContext,
  type ExecutionResult,
  executeCode,
} from "./executor";

// Re-export core types
export type { ExecutionContext, ExecutionResult };

/**
 * Represents a single MCP tool with its schema
 */
export interface MCPTool {
  name: string;
  description: string;
  // biome-ignore lint/suspicious/noExplicitAny: JSON schema can be any object shape
  inputSchema: Record<string, any>;
  // biome-ignore lint/suspicious/noExplicitAny: JSON schema can be any object shape
  outputSchema?: Record<string, any>;
}

/**
 * Represents an MCP server with its tools
 */
export interface MCPServer {
  name: string;
  tools: MCPTool[];
}

/**
 * Configuration for code mode
 */
export interface CodeModeConfig {
  /** List of MCP servers with their tools */
  servers: MCPServer[];

  /** Function that routes tool calls to actual MCP servers */
  rpcHandler: (
    serverName: string,
    toolName: string,
    args: unknown,
  ) => Promise<unknown>;

  /** Optional timeout for code execution in milliseconds */
  timeout?: number;
}

/**
 * Code mode instance
 */
export interface CodeMode {
  /** TypeScript type definitions for all available tools */
  typeDefinitions: string;

  /** JavaScript runtime API code */
  runtimeApi: string;

  /** Execute user code with access to MCP tools */
  executeCode: (userCode: string) => Promise<ExecutionResult>;

  /** Get the tool schema for the execute_code tool */
  getExecuteCodeToolSchema: () => ExecuteCodeToolSchema;
}

/**
 * Schema for the execute_code tool
 */
export interface ExecuteCodeToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: {
      code: {
        type: string;
        description: string;
      };
    };
    required: string[];
  };
}

/**
 * Creates a code mode instance from MCP servers
 *
 * @param config - Configuration including servers and RPC handler
 * @returns Code mode instance ready to execute user code
 */
export async function createCodeMode(
  config: CodeModeConfig,
): Promise<CodeMode> {
  // Flatten all tools from all servers
  const allTools = config.servers.flatMap((server) => server.tools);

  // Generate TypeScript type definitions
  const typeDefinitions = await generateTypes(allTools);

  // Generate JavaScript runtime API
  const runtimeApi = generateApiClient(config.servers);

  // Create execution context
  const executionContext: ExecutionContext = {
    runtimeApi,
    rpcHandler: config.rpcHandler,
    timeout: config.timeout,
  };

  return {
    typeDefinitions,
    runtimeApi,

    executeCode: async (userCode: string) => {
      return await executeCode(userCode, executionContext);
    },

    getExecuteCodeToolSchema: () => ({
      name: "execute_code",
      description: `Execute JavaScript code with access to MCP tools via the mcpTools object.

Available API:
\`\`\`typescript
${typeDefinitions}
\`\`\`

Example usage:
\`\`\`javascript
// Call tools using mcpTools.<serverName>.<toolName>()
const result = await mcpTools.weatherServer.getWeather({ location: "San Francisco" });
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
    }),
  };
}

export { generateApiClient } from "./api-generation/generate-client";
// Re-export utility functions for advanced usage
export { generateTypes } from "./api-generation/generate-types";
export { executeCode } from "./executor";
