import type { McpServer } from "@fiberplane/mcp-gateway-types";
import { normalizeUrl } from "../utils/url";
import { ServerAlreadyExistsError, ServerNotFoundError } from "./errors";

/**
 * Pure registry manipulation functions
 *
 * These functions operate on McpServer arrays without side effects.
 * They are exported primarily for testing purposes.
 *
 * External consumers should use Gateway methods instead:
 * - gateway.storage.addServer() instead of addServer()
 * - gateway.storage.removeServer() instead of removeServer()
 * - gateway.storage.getServer() instead of getServer()
 */

// Check if server exists (case-insensitive)
export function hasServer(servers: McpServer[], name: string): boolean {
  return servers.some((s) => s.name.toLowerCase() === name.toLowerCase());
}

// Pure function to add server to servers array
export function addServer(
  servers: McpServer[],
  server: Omit<McpServer, "lastActivity" | "exchangeCount">,
): McpServer[] {
  const name = server.name.toLowerCase().trim();

  if (!name) {
    throw new Error("Server name cannot be empty");
  }

  if (hasServer(servers, name)) {
    throw new ServerAlreadyExistsError(server.name);
  }

  // Handle both HTTP and stdio servers
  if (server.type === "http") {
    // TypeScript doesn't narrow Omit types, so we need to cast
    const httpServer = server as Omit<
      Extract<McpServer, { type: "http" }>,
      "lastActivity" | "exchangeCount"
    >;
    const normalized: McpServer = {
      type: "http",
      name,
      url: normalizeUrl(httpServer.url),
      headers: httpServer.headers,
      lastActivity: null,
      exchangeCount: 0,
    };
    return [...servers, normalized];
  } else {
    // TypeScript doesn't narrow Omit types, so we need to cast
    const stdioServer = server as Omit<
      Extract<McpServer, { type: "stdio" }>,
      "lastActivity" | "exchangeCount"
    >;
    const normalized: McpServer = {
      type: "stdio",
      name,
      command: stdioServer.command,
      args: stdioServer.args,
      env: stdioServer.env,
      cwd: stdioServer.cwd,
      timeout: stdioServer.timeout,
      sessionMode: stdioServer.sessionMode,
      lastActivity: null,
      exchangeCount: 0,
      processState: {
        status: "stopped",
        pid: null,
        lastError: null,
        stderrLogs: [],
      },
    };
    return [...servers, normalized];
  }
}

// Pure function to remove server from servers array
export function removeServer(servers: McpServer[], name: string): McpServer[] {
  const normalizedName = name.toLowerCase().trim();
  const filtered = servers.filter((s) => s.name !== normalizedName);

  if (filtered.length === servers.length) {
    throw new ServerNotFoundError(name);
  }

  return filtered;
}

// Convert servers array to mcp.json format
export function toMcpJson(servers: McpServer[]) {
  return {
    mcpServers: Object.fromEntries(
      servers.map((s) => {
        if (s.type === "http") {
          return [
            s.name,
            {
              type: s.type,
              url: s.url,
              headers: s.headers,
            },
          ];
        } else {
          return [
            s.name,
            {
              type: s.type,
              command: s.command,
              args: s.args,
              ...(s.env && { env: s.env }),
              ...(s.cwd && { cwd: s.cwd }),
              ...(s.timeout && { timeout: s.timeout }),
              ...(s.sessionMode && { sessionMode: s.sessionMode }),
            },
          ];
        }
      }),
    ),
  };
}

// Define the expected mcp.json structure
interface McpJsonData {
  mcpServers?: Record<
    string,
    {
      type?: string;
      url?: string;
      headers?: Record<string, string>;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
      timeout?: number;
      sessionMode?: "shared" | "isolated";
    }
  >;
}

// Convert mcp.json format to servers array
export function fromMcpJson(data: unknown): McpServer[] {
  if (!data || typeof data !== "object" || !data) {
    return [];
  }

  const typedData = data as McpJsonData;
  if (!typedData.mcpServers) {
    return [];
  }

  const servers: McpServer[] = Object.entries(typedData.mcpServers)
    .map(([name, config]): McpServer | null => {
      if (!config || typeof config !== "object") {
        return null;
      }

      const normalizedName = name.toLowerCase().trim();

      // Stdio server
      if (config.type === "stdio" && config.command && config.args) {
        const server: McpServer = {
          type: "stdio",
          name: normalizedName,
          command: config.command,
          args: config.args,
          env: config.env,
          cwd: config.cwd,
          timeout: config.timeout,
          sessionMode:
            config.sessionMode === "isolated" ? "isolated" : "shared",
          lastActivity: null,
          exchangeCount: 0,
          processState: {
            status: "stopped",
            pid: null,
            lastError: null,
            stderrLogs: [],
          },
        };
        return server;
      }

      // HTTP server (default)
      if (config.url) {
        const server: McpServer = {
          type: "http",
          name: normalizedName,
          url: config.url,
          headers: config.headers || {},
          lastActivity: null,
          exchangeCount: 0,
        };
        return server;
      }

      return null;
    })
    .filter((server): server is McpServer => server !== null);

  return servers;
}
