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

import type { ExecutionContext, ExecutionResult } from "./executor";

// Re-export core types
export type { ExecutionContext, ExecutionResult };

export { generateApiClient } from "./api-generation/generate-client";
export { generateTypes } from "./api-generation/generate-types";
export { createCodeMode } from "./code-mode";
export { executeCode } from "./executor";
