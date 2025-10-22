import type { McpServer } from "@fiberplane/mcp-gateway-types";
import type { McpServer as MCP_LiteServer } from "mcp-lite";
import { z } from "zod";

// Schema for adding a new server
const AddServerSchema = z.object({
  name: z
    .string()
    .min(1, "Server name is required")
    .max(50, "Server name must be 50 characters or less")
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/,
      "Server name must start with alphanumeric character and contain only letters, numbers, hyphens, and underscores",
    )
    .describe(
      "Unique identifier for the MCP server. Must be alphanumeric with optional hyphens/underscores.",
    ),

  url: z
    .string()
    .min(1, "URL is required")
    .refine((url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, "Must be a valid HTTP or HTTPS URL")
    .describe(
      "Complete HTTP or HTTPS URL where the MCP server is accessible, including the /mcp endpoint path if required.",
    ),

  headers: z
    .record(z.string(), z.string())
    .optional()
    .default({})
    .describe(
      "Optional HTTP headers to include with requests to this server (e.g., authorization tokens, custom headers).",
    ),
});

// Schema for removing a server
const RemoveServerSchema = z.object({
  name: z
    .string()
    .min(1, "Server name is required")
    .describe("Name of the server to remove from the gateway registry."),
});

// Schema for listing servers with optional filtering
const ListServersSchema = z.object({
  filter: z
    .enum(["all", "active", "inactive"])
    .optional()
    .default("all")
    .describe(
      "Filter servers by activity status. 'active' shows servers with recent activity, 'inactive' shows servers that haven't been used recently, 'all' shows everything.",
    ),

  format: z
    .enum(["concise", "detailed"])
    .optional()
    .default("concise")
    .describe(
      "Response format. 'concise' returns essential information only, 'detailed' includes full server configuration, statistics, and metadata.",
    ),
});

/**
 * Dependencies for server management tools
 */
export interface ServerToolsDependencies {
  /**
   * Get a server by name from the registry
   */
  getServer: (name: string) => McpServer | undefined;

  /**
   * Add a new server to the registry and persist changes
   */
  addServer: (server: McpServer) => Promise<void>;

  /**
   * Remove a server from the registry and persist changes
   */
  removeServer: (name: string) => Promise<void>;

  /**
   * Get all servers from the registry
   */
  listServers: () => Promise<McpServer[]>;
}

/**
 * Registers server management tools with the MCP server.
 * These tools allow clients to manage the gateway's server registry.
 *
 * @param mcp - The MCP server instance to register tools with
 * @param deps - Dependencies for server management operations
 */
export function createServerTools(
  mcp: MCP_LiteServer,
  deps: ServerToolsDependencies,
): void {
  mcp.tool("add_server", {
    description: `Adds a new MCP server to the gateway's registry, making it accessible for proxying requests. This tool validates the server configuration and ensures the server name is unique within the registry.

The gateway will route MCP requests to registered servers based on the URL pattern /:serverName/mcp. For example, a server named 'weather' will be accessible at /weather/mcp on the gateway.

Prerequisites:
- The target MCP server must be running and accessible at the provided URL
- The server name must be unique (case-insensitive) within the gateway registry
- The URL must be a valid HTTP/HTTPS endpoint that responds to MCP requests

Use this tool when you need to connect the gateway to a new MCP server. The server will be immediately available for use once added. If headers are provided, they will be included with every request to that server (useful for authentication).

Common use cases:
- Adding a newly deployed MCP server to the gateway
- Registering third-party MCP services with authentication
- Setting up development/testing servers with custom configurations

The tool will return success confirmation with the server's configuration details, or an error if the server name already exists or the URL is invalid.`,
    inputSchema: AddServerSchema,
    handler: async (args) => {
      try {
        // Validate that server doesn't already exist
        if (deps.getServer(args.name)) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Server '${args.name}' already exists in the registry. Use remove_server first if you want to replace it, or choose a different name.`,
              },
            ],
            isError: true,
          };
        }

        // Add server to registry
        await deps.addServer({
          name: args.name,
          url: args.url,
          type: "http",
          headers: args.headers || {},
        } as McpServer);

        return {
          content: [
            {
              type: "text",
              text: `✅ Successfully added server '${args.name}'

**Server Details:**
- Name: ${args.name}
- URL: ${args.url}
- Type: HTTP
- Headers: ${Object.keys(args.headers || {}).length} configured
- Status: Ready for requests

The server is now available at the gateway endpoint: /${args.name}/mcp`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to add server: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    },
  });

  mcp.tool("remove_server", {
    description: `Removes an MCP server from the gateway's registry, making it no longer accessible for request proxying. This is a destructive operation that immediately disconnects the server from the gateway.

When a server is removed:
- All incoming requests to /:serverName/mcp will return 404 Not Found
- The server's configuration and statistics are permanently deleted
- Any active sessions to that server will be terminated
- Captured request/response data is preserved in storage for analysis

Use this tool when:
- Decommissioning an MCP server that's no longer needed
- Cleaning up test/development servers from the registry
- Preparing to reconfigure a server (remove then add with new settings)
- Removing servers that are permanently offline or misconfigured

Safety considerations:
- This operation cannot be undone through the gateway tools
- Ensure no clients are actively using the server before removal
- Consider the impact on any automated systems that depend on this server
- Historical capture data will remain available for analysis even after removal

The tool will confirm successful removal or provide an error if the server doesn't exist. After removal, the server name becomes available for reuse with add_server.`,
    inputSchema: RemoveServerSchema,
    handler: async (args) => {
      try {
        // Check if server exists
        const existingServer = deps.getServer(args.name);
        if (!existingServer) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Server '${args.name}' not found in the registry. Use list_servers to see available servers.`,
              },
            ],
            isError: true,
          };
        }

        // Remove server from registry
        await deps.removeServer(args.name);

        return {
          content: [
            {
              type: "text",
              text: `✅ Successfully removed server '${args.name}'

**Removed Server:**
- Name: ${existingServer.name}
- URL: ${existingServer.url}
- Last Activity: ${existingServer.lastActivity || "Never"}
- Total Requests: ${existingServer.exchangeCount}

The server is no longer accessible at /${args.name}/mcp. Historical capture data has been preserved for analysis.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to remove server: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
            },
          ],
          isError: true,
        };
      }
    },
  });

  mcp.tool("list_servers", {
    description: `Lists all MCP servers registered with the gateway, providing an overview of the current server configuration and status. This is essential for understanding what servers are available and their operational state.

The tool supports filtering and formatting options to optimize the response for different use cases:

**Filter Options:**
- 'all' (default): Shows every registered server regardless of activity
- 'active': Shows only servers that have processed requests recently (within the last hour)
- 'inactive': Shows servers that haven't been used recently or have never processed requests

**Format Options:**
- 'concise' (default): Returns essential information (name, URL, status) for quick overview
- 'detailed': Returns comprehensive information including configuration, statistics, headers, and timing data

Use this tool to:
- Get an overview of all configured MCP servers in the gateway
- Check which servers are actively processing requests
- Identify servers that may need attention (inactive or misconfigured)
- Prepare for server management operations (add/remove decisions)
- Monitor the overall health of your MCP server ecosystem

The response includes operational metrics like request counts, last activity timestamps, and configuration details to help you understand server usage patterns and identify potential issues.

For large deployments, use the 'concise' format first to get an overview, then query specific servers in 'detailed' mode for deeper analysis.`,
    inputSchema: ListServersSchema,
    handler: async (args) => {
      const servers = await deps.listServers();

      if (servers.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "📭 No servers registered in the gateway.\n\nUse add_server to register your first MCP server.",
            },
          ],
        };
      }

      // Apply filtering
      let filteredServers = servers;
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      if (args.filter === "active") {
        filteredServers = servers.filter(
          (server) =>
            server.lastActivity &&
            new Date(server.lastActivity).getTime() > oneHourAgo,
        );
      } else if (args.filter === "inactive") {
        filteredServers = servers.filter(
          (server) =>
            !server.lastActivity ||
            new Date(server.lastActivity).getTime() <= oneHourAgo,
        );
      }

      // Format response based on requested detail level
      if (args.format === "concise") {
        const serverList = filteredServers
          .map((server) => {
            const status = server.lastActivity
              ? new Date(server.lastActivity).getTime() > oneHourAgo
                ? "🟢 Active"
                : "🟡 Inactive"
              : "⚫ Never used";

            return `**${server.name}**
  URL: ${server.url}
  Status: ${status}
  Requests: ${server.exchangeCount}`;
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `📊 **Gateway Server Registry** (${filteredServers.length} of ${servers.length} servers)

${serverList}

💡 Use format=detailed for comprehensive server information.`,
            },
          ],
        };
      } else {
        // Detailed format
        const serverDetails = filteredServers
          .map((server) => {
            const lastActivity = server.lastActivity
              ? new Date(server.lastActivity).toLocaleString()
              : "Never";

            const status = server.lastActivity
              ? new Date(server.lastActivity).getTime() > oneHourAgo
                ? "🟢 Active"
                : "🟡 Inactive"
              : "⚫ Never used";

            const headerCount = Object.keys(server.headers).length;
            const headersList =
              headerCount > 0
                ? Object.keys(server.headers)
                    .map(
                      (key) =>
                        `    ${key}: ${server.headers[key]?.substring(0, 20)}${(server.headers[key]?.length || 0) > 20 ? "..." : ""}`,
                    )
                    .join("\n")
                : "    None configured";

            return `**${server.name}**
  URL: ${server.url}
  Type: ${server.type}
  Status: ${status}

  **Statistics:**
  - Total Requests: ${server.exchangeCount}
  - Last Activity: ${lastActivity}
  - Gateway Endpoint: /${server.name}/mcp

  **Configuration:**
  - Headers (${headerCount}):
${headersList}`;
          })
          .join(`\n\n${"─".repeat(50)}\n\n`);

        return {
          content: [
            {
              type: "text",
              text: `📊 **Detailed Gateway Server Registry**

Showing ${filteredServers.length} of ${servers.length} servers (filter: ${args.filter})

${"─".repeat(50)}

${serverDetails}

${"─".repeat(50)}

**Summary:**
- Total Servers: ${servers.length}
- Active (last hour): ${servers.filter((s) => s.lastActivity && new Date(s.lastActivity).getTime() > oneHourAgo).length}
- Total Requests Processed: ${servers.reduce((sum, s) => sum + s.exchangeCount, 0)}`,
            },
          ],
        };
      }
    },
  });
}
