import type { Tool } from "@fiberplane/mcp-gateway-types";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { z } from "zod";
import { logger } from "../logger.js";
import { loadCanonicalTools, loadPromotions } from "../optimization/storage.js";

/**
 * Create an evaluation MCP server for testing tool descriptions
 *
 * This server:
 * - Serves tools from canonical-tools.json with promoted descriptions
 * - Returns mock responses for tool calls (doesn't execute anything)
 * - Doesn't connect to upstream servers
 * - Doesn't require authentication
 */
export async function createEvaluationMcpServer(
  storageDir: string,
  originalServerName: string,
  toolName?: string,
): Promise<McpServer> {
  const mcp = new McpServer({
    name: originalServerName,
    version: "1.0.0",
    schemaAdapter: (schema) => z.toJSONSchema(schema as z.ZodType),
  });

  // Load canonical tools
  let tools: Tool[] = [];
  try {
    logger.info("Loading canonical tools for evaluation server", {
      storageDir,
      originalServerName,
    });
    tools = await loadCanonicalTools(storageDir, originalServerName);
    logger.info("Loaded canonical tools for evaluation", {
      originalServerName,
      toolCount: tools.length,
      toolNames: tools.map(t => t.name),
    });
  } catch (error) {
    logger.warn("Failed to load canonical tools for evaluation", {
      originalServerName,
      error: String(error),
    });
  }

  // If a specific tool is being evaluated, load its promoted description
  if (toolName) {
    logger.info("Loading promoted description for specific tool", {
      toolName,
      originalServerName,
    });
    const promotions = await loadPromotions(storageDir, originalServerName);
    const promotion = promotions.get(toolName);

    if (promotion) {
      logger.info("Found promotion for tool", {
        toolName,
        promotedDescription: promotion.description,
      });
      // Replace the tool's description with the promoted one
      tools = tools.map((tool) => {
        if (tool.name === toolName) {
          return {
            ...tool,
            description: promotion.description,
          };
        }
        return tool;
      });

      logger.info("Applied promoted description for evaluation", {
        toolName,
        promotedDescription: promotion.description,
      });
    } else {
      logger.warn("No promotion found for tool", {
        toolName,
        availablePromotions: Array.from(promotions.keys()),
      });
    }
  }

  // Register all tools
  logger.info("Registering tools with McpServer", {
    originalServerName,
    toolCount: tools.length,
  });
  for (const tool of tools) {
    logger.debug("Registering tool with McpServer", {
      toolName: tool.name,
      description: tool.description,
      hasInputSchema: !!tool.inputSchema,
      inputSchemaKeys: tool.inputSchema ? Object.keys(tool.inputSchema) : [],
    });
    mcp.tool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
      handler: async (params: unknown) => {
        // Mock response - just log that the tool was called
        logger.info("Evaluation tool called", {
          toolName: tool.name,
          params,
        });

        // Return a simple success response
        return {
          content: [
            {
              type: "text",
              text: `Tool ${tool.name} was called successfully (mock response for evaluation)`,
            },
          ],
        };
      },
    });
    logger.debug("Successfully registered tool", {
      toolName: tool.name,
    });
  }
  logger.info("Finished registering all tools", {
    originalServerName,
    totalRegistered: tools.length,
  });

  logger.info("Created evaluation MCP server", {
    originalServerName,
    toolCount: tools.length,
    evaluatingTool: toolName,
    toolNames: tools.map(t => t.name),
  });

  return mcp;
}

/**
 * Create HTTP handler for evaluation MCP server
 *
 * Uses STATELESS transport - each HTTP request is independent
 * Session adapters are only needed for SSE/streaming features, not basic HTTP JSON-RPC
 */
export async function createEvaluationHttpHandler(
  storageDir: string,
  originalServerName: string,
  toolName?: string,
): Promise<(request: Request) => Promise<Response>> {
  logger.info("Creating evaluation HTTP handler", {
    storageDir,
    originalServerName,
    toolName,
  });

  const mcp = await createEvaluationMcpServer(storageDir, originalServerName, toolName);

  logger.info("Created evaluation MCP server instance", {
    originalServerName,
    toolName,
  });

  // Use stateless transport (default mode for HTTP JSON-RPC)
  // Claude Code makes independent HTTP POST requests, not stateful sessions
  const transport = new StreamableHttpTransport();

  logger.info("Created StreamableHttpTransport for evaluation server", {
    originalServerName,
  });

  const handler = transport.bind(mcp);

  logger.info("Bound transport to MCP server", {
    originalServerName,
    handlerType: typeof handler,
  });

  // Wrap handler to log all requests/responses
  return async (request: Request): Promise<Response> => {
    const requestUrl = request.url;
    const requestMethod = request.method;

    let requestBody: unknown;
    let jsonRpcMethod: string | undefined;
    try {
      requestBody = await request.clone().json();
      jsonRpcMethod = (requestBody as any)?.method;
      logger.info("Evaluation handler received request", {
        originalServerName,
        url: requestUrl,
        method: requestMethod,
        jsonRpcMethod,
        jsonRpcId: (requestBody as any)?.id,
        bodyPreview: JSON.stringify(requestBody).slice(0, 200),
      });
    } catch (error) {
      logger.warn("Failed to parse request body", {
        originalServerName,
        error: String(error),
      });
    }

    const response = await handler(request);

    logger.info("Evaluation handler returning response", {
      originalServerName,
      jsonRpcMethod,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      headers: Object.fromEntries(response.headers.entries()),
    });

    // Log response body for debugging (especially critical for tools/list)
    try {
      const responseClone = response.clone();
      const responseBody = await responseClone.text();

      // Use INFO level for tools/list to make it visible
      if (jsonRpcMethod === "tools/list") {
        logger.info("TOOLS/LIST RESPONSE BODY", {
          originalServerName,
          responseBody: responseBody.slice(0, 2000), // First 2KB
          bodyLength: responseBody.length,
        });
      } else {
        logger.debug("Evaluation handler response body", {
          originalServerName,
          bodyPreview: responseBody.slice(0, 500),
          bodyLength: responseBody.length,
        });
      }
    } catch (error) {
      logger.warn("Failed to read response body", {
        originalServerName,
        error: String(error),
      });
    }

    return response;
  };
}
