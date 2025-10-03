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

import type { McpServer } from "../registry";
import { generateApiClient } from "./api-generation/generate-client";
import { generateTypes } from "./api-generation/generate-types";
import { createCodeToolDescriptionFromTypes } from "./code-tool-description";
import {
  type ExecutionContext,
  type ExecutionResult,
  executeCode,
} from "./executor";
import { toCodeModeServer } from "./types";

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
 * Configuration for code mode
 */
export interface CodeModeConfig {
  /** List of MCP servers with their tools */
  servers: McpServer[];

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
  getExecuteCodeToolSchema: (serverName?: string) => ExecuteCodeToolSchema;
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
  // Convert servers to the type expected...
  const servers = config.servers.map((s) => toCodeModeServer(s));

  // Generate TypeScript type definitions
  const typeDefinitions = await generateTypes(servers);

  // FIXME - Logging type definitions to a file for debugging
  const isoTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const random = crypto.randomUUID().slice(0, 8);
  Bun.write(`${isoTimestamp}-typeDefinitions-${random}.ts`, typeDefinitions);

  // Generate JavaScript runtime API
  const runtimeApi = generateApiClient(servers);

  // FIXME - Logging runtime api code to a file for debugging
  Bun.write(`${isoTimestamp}-runtimeApi-${random}.ts`, runtimeApi);

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

    /**
     * @deprecated - Use the utility function `createCodeToolDescriptionFromTypes` or `createCodeToolDescriptionFromServers`
     */
    getExecuteCodeToolSchema: () =>
      createCodeToolDescriptionFromTypes(typeDefinitions),
  };
}
