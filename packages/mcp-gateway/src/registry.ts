// Health status for servers
export type ServerHealth = "up" | "down" | "unknown";

// Pure data types for MCP servers and registry
export interface McpServer {
  name: string;
  url: string;
  type: "http";
  headers: Record<string, string>;
  lastActivity: string | null;
  exchangeCount: number;
  health?: ServerHealth;
  lastHealthCheck?: string;
}

export interface Registry {
  servers: McpServer[];
}

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
export function hasServer(registry: Registry, name: string): boolean {
  return registry.servers.some(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  );
}

// Pure function to add server to registry
export function addServer(
  registry: Registry,
  server: Omit<McpServer, "lastActivity" | "exchangeCount">,
): Registry {
  const normalized = {
    ...server,
    name: server.name.toLowerCase().trim(),
    url: normalizeUrl(server.url),
    lastActivity: null,
    exchangeCount: 0,
  };

  if (hasServer(registry, normalized.name)) {
    throw new Error(`Server '${server.name}' already exists`);
  }

  if (!normalized.name) {
    throw new Error("Server name cannot be empty");
  }

  return {
    servers: [...registry.servers, normalized],
  };
}

// Pure function to remove server from registry
export function removeServer(registry: Registry, name: string): Registry {
  const normalizedName = name.toLowerCase().trim();
  const filtered = registry.servers.filter((s) => s.name !== normalizedName);

  if (filtered.length === registry.servers.length) {
    throw new Error(`Server '${name}' not found`);
  }

  return {
    servers: filtered,
  };
}

// Pure function to update server activity
export function updateServerActivity(
  registry: Registry,
  name: string,
  activity: { lastActivity: string; exchangeCount?: number },
): Registry {
  const servers = registry.servers.map((server) => {
    if (server.name === name.toLowerCase().trim()) {
      return {
        ...server,
        lastActivity: activity.lastActivity,
        exchangeCount: activity.exchangeCount ?? server.exchangeCount,
      };
    }
    return server;
  });

  return { servers };
}

// Convert registry to mcp.json format
export function toMcpJson(registry: Registry) {
  return {
    mcpServers: Object.fromEntries(
      registry.servers.map((s) => [
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

// Convert mcp.json format to registry
export function fromMcpJson(data: unknown): Registry {
  if (!data || typeof data !== "object" || !data) {
    return { servers: [] };
  }

  const typedData = data as McpJsonData;
  if (!typedData.mcpServers) {
    return { servers: [] };
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

  return { servers };
}

// Get server by name
export function getServer(registry: Registry, name: string): McpServer | null {
  const normalizedName = name.toLowerCase().trim();
  return registry.servers.find((s) => s.name === normalizedName) || null;
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
