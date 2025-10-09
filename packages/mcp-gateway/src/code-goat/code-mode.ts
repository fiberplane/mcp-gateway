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
import { executeCode } from "./executor/evil";
import type { ExecutionContext, ExecutionResult } from "./executor/types";
import { buildRpcHandler } from "./rpc-handler";
import { toCodeModeServer } from "./types";
import { logger } from "../logger.js";

/**
 * Configuration for code mode
 */
export interface CodeModeConfig {
  /** List of MCP servers with their tools */
  servers: McpServer[];

  /**
   * Optional session id for the current MCP session,
   * useful for making rpc calls to actual MCP servers
   * (to execute tools from within code mode scripts)
   */
  sessionId?: string;

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

  /** Execution context for code mode, includes the RPC handler */
  executionContext: ExecutionContext;

  /** Execute user code with access to MCP tools */
  executeCode: (userCode: string) => Promise<ExecutionResult>;

  /** Get the tool schema for the code execution tool */
  getExecuteCodeToolSchema: () => ExecuteCodeToolSchema;
}

/**
 * Schema for the code execution tool
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
  logger.debug("Generated typeDefinitions", { typeDefinitions });

  // Generate JavaScript runtime API
  const runtimeApi = generateApiClient(servers);

  // FIXME - Logging runtime api code to a file for debugging
  logger.debug("Generated runtimeApi", { runtimeApi });

  // Create execution context
  const executionContext: ExecutionContext = {
    runtimeApi,
    rpcHandler: buildRpcHandler(servers, config.sessionId),
    timeout: config.timeout,
  };

  return {
    typeDefinitions,
    runtimeApi,
    executionContext,

    executeCode: async (userCode: string) => {
      return await executeCode(userCode, executionContext);
    },

    getExecuteCodeToolSchema: () =>
      createCodeToolDescriptionFromTypes(typeDefinitions),
  };
}
