/**
 * Marketplace data - curated list of popular MCP servers
 *
 * This is a hardcoded list of MCP servers that will be displayed in the marketplace.
 * In the future, this could be fetched from a backend API.
 */

export interface MarketplaceServer {
  name: string;
  description: string;
  /** Full command string (e.g., "npx -y @modelcontextprotocol/server-linear") */
  command: string;
  icon?: string; // Emoji or icon identifier (will be replaced with proper icons later)
  toolCount?: number;
  /** Documentation URL for the server */
  docsUrl?: string;
  category?: "productivity" | "development" | "data" | "ai" | "other";
  /** Server type - almost all marketplace servers are stdio */
  type: "stdio" | "http";
}

export const MARKETPLACE_SERVERS: MarketplaceServer[] = [
  {
    name: "Linear",
    description:
      "Manage Linear issues, projects, and teams directly through MCP",
    command: "https://mcp.linear.app/mcp",
    type: "http",
    icon: "linear",
    toolCount: 23,
    docsUrl: "https://linear.app/docs/mcp",
    category: "productivity",
  },
  {
    name: "Notion",
    description: "Access and manage Notion pages, databases, and content",
    command: "https://mcp.notion.com/mcp",
    type: "http",
    icon: "notion",
    toolCount: 15,
    docsUrl: "https://developers.notion.com/docs/mcp",
    category: "productivity",
  },
  {
    name: "GitHub",
    description: "Interact with GitHub repositories, issues, and pull requests",
    command: "https://api.githubcopilot.com/mcp/",
    type: "http",
    icon: "github",
    toolCount: 51,
    docsUrl: "https://github.com/github/github-mcp-server",
    category: "development",
  },
  {
    name: "Figma",
    description: "Access Figma designs, components, and collaborate on designs",
    command: "https://mcp.figma.com/mcp",
    type: "http",
    icon: "figma",
    toolCount: 8,
    docsUrl:
      "https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server",
    category: "development",
  },
  {
    name: "Context7",
    description: "Up-to-date Docs for LLMs and AI code editors",
    command: "https://mcp.context7.com/mcp",
    type: "http",
    icon: "context7",
    toolCount: 2,
    docsUrl: "https://context7.com/docs/overview",
    category: "productivity",
  },
  {
    name: "Neon",
    description:
      "Interact with your Neon Postgres databases in natural language.",
    command: "https://mcp.neon.tech/mcp",
    type: "http",
    icon: "neon",
    toolCount: 27,
    docsUrl: "https://mcp.neon.tech/",
    category: "data",
  },
  {
    name: "ShadCN",
    description:
      "Shadcn is a library of components for building modern web applications.",
    command: "npx shadcn@latest mcp",
    type: "stdio",
    icon: "shadcn",
    toolCount: 10,
    docsUrl: "https://ui.shadcn.com/docs/mcp",
    category: "development",
  },
  {
    name: "Prisma",
    description: "Prisma is a database toolkit for Node.js and TypeScript.",
    command: "https://mcp.prisma.io/mcp",
    type: "http",
    icon: "prisma",
    toolCount: 13,
    docsUrl: "https://www.prisma.io/docs/postgres/integrations/mcp-server",
    category: "data",
  },
  {
    name: "Astro",
    description: "Astro is a static site builder for the modern web.",
    command: "https://mcp.astro.build/mcp",
    type: "http",
    icon: "astro",
    toolCount: 1,
    docsUrl: "https://mcp.docs.astro.build/",
    category: "development",
  },
  {
    name: "Asana",
    description: "Asana is a project management tool for teams.",
    command: "https://mcp.asana.com/sse",
    type: "http",
    icon: "asana",
    toolCount: 44,
    docsUrl: "https://developers.asana.com/docs/using-asanas-mcp-server",
    category: "productivity",
  },
];
