import type { McpServer } from "@fiberplane/mcp-gateway-types";

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

// URL normalization helper
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash
    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new Error("Invalid URL format");
  }
}

// Check if server exists (case-insensitive)
export function hasServer(servers: McpServer[], name: string): boolean {
  return servers.some((s) => s.name.toLowerCase() === name.toLowerCase());
}

// Pure function to add server to servers array
export function addServer(
  servers: McpServer[],
  server: Omit<McpServer, "lastActivity" | "exchangeCount">,
): McpServer[] {
  const normalized = {
    ...server,
    name: server.name.toLowerCase().trim(),
    url: normalizeUrl(server.url),
    lastActivity: null,
    exchangeCount: 0,
  };

  if (hasServer(servers, normalized.name)) {
    throw new Error(`Server '${server.name}' already exists`);
  }

  if (!normalized.name) {
    throw new Error("Server name cannot be empty");
  }

  return [...servers, normalized];
}

// Pure function to remove server from servers array
export function removeServer(servers: McpServer[], name: string): McpServer[] {
  const normalizedName = name.toLowerCase().trim();
  const filtered = servers.filter((s) => s.name !== normalizedName);

  if (filtered.length === servers.length) {
    throw new Error(`Server '${name}' not found`);
  }

  return filtered;
}

// Convert servers array to mcp.json format
export function toMcpJson(servers: McpServer[]) {
  return {
    mcpServers: Object.fromEntries(
      servers.map((s) => [
        s.name,
        {
          type: s.type,
          url: s.url,
          headers: s.headers,
        },
      ]),
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
    .map(([name, config]) => {
      if (!config || typeof config !== "object") {
        return null;
      }

      return {
        name: name.toLowerCase().trim(),
        type: config.type === "http" ? ("http" as const) : ("http" as const),
        url: config.url || "",
        headers: config.headers || {},
        lastActivity: null as string | null,
        exchangeCount: 0,
      };
    })
    .filter(
      (server): server is McpServer => server !== null && server.url !== "",
    );

  return servers;
}

// Validate URL format
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
