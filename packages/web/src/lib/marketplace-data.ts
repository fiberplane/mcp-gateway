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
  githubUrl?: string;
  tags?: string[];
  category?: "productivity" | "development" | "data" | "ai" | "other";
  /** Server type - almost all marketplace servers are stdio */
  type: "stdio" | "http";
}

export const MARKETPLACE_SERVERS: MarketplaceServer[] = [
  {
    name: "Linear",
    description:
      "Manage Linear issues, projects, and teams directly through MCP",
    command: "npx -y @modelcontextprotocol/server-linear",
    type: "stdio",
    icon: "📐",
    toolCount: 15,
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    tags: ["project-management", "issues", "teams"],
    category: "productivity",
  },
  {
    name: "Notion",
    description: "Access and manage Notion pages, databases, and content",
    command: "npx -y @notionhq/mcp-server-notion",
    type: "stdio",
    icon: "✍️",
    toolCount: 12,
    githubUrl: "https://github.com/notionhq/mcp-server-notion",
    tags: ["notes", "database", "collaboration"],
    category: "productivity",
  },
  {
    name: "GitHub",
    description: "Interact with GitHub repositories, issues, and pull requests",
    command: "npx -y @modelcontextprotocol/server-github",
    type: "stdio",
    icon: "🐙",
    toolCount: 20,
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    tags: ["git", "code-review", "ci-cd"],
    category: "development",
  },
  {
    name: "Figma",
    description: "Access Figma designs, components, and collaborate on designs",
    command: "npx -y @figma/mcp-server-figma",
    type: "stdio",
    icon: "🎨",
    toolCount: 8,
    githubUrl: "https://github.com/figma/mcp-server-figma",
    tags: ["design", "ui-ux", "collaboration"],
    category: "development",
  },
  {
    name: "Slack",
    description: "Send messages, manage channels, and interact with Slack",
    command: "npx -y @modelcontextprotocol/server-slack",
    type: "stdio",
    icon: "💬",
    toolCount: 10,
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    tags: ["messaging", "collaboration", "notifications"],
    category: "productivity",
  },
  {
    name: "PostgreSQL",
    description: "Query and manage PostgreSQL databases",
    command: "npx -y @modelcontextprotocol/server-postgres",
    type: "stdio",
    icon: "🐘",
    toolCount: 7,
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    tags: ["database", "sql", "data"],
    category: "data",
  },
  {
    name: "Google Drive",
    description: "Access and manage Google Drive files and folders",
    command: "npx -y @modelcontextprotocol/server-gdrive",
    type: "stdio",
    icon: "📁",
    toolCount: 9,
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    tags: ["storage", "files", "collaboration"],
    category: "productivity",
  },
  {
    name: "Filesystem",
    description:
      "Read, write, and manage local filesystem with security controls",
    command: "npx -y @modelcontextprotocol/server-filesystem",
    type: "stdio",
    icon: "🗂️",
    toolCount: 6,
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    tags: ["filesystem", "local", "files"],
    category: "development",
  },
  {
    name: "Brave Search",
    description: "Search the web using Brave Search API",
    command: "npx -y @modelcontextprotocol/server-brave-search",
    type: "stdio",
    icon: "🔍",
    toolCount: 3,
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    tags: ["search", "web", "api"],
    category: "data",
  },
  {
    name: "Memory",
    description: "Persistent knowledge graph memory system for AI assistants",
    command: "npx -y @modelcontextprotocol/server-memory",
    type: "stdio",
    icon: "🧠",
    toolCount: 5,
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    tags: ["memory", "knowledge-graph", "ai"],
    category: "ai",
  },
  {
    name: "Puppeteer",
    description: "Browser automation and web scraping with Puppeteer",
    command: "npx -y @modelcontextprotocol/server-puppeteer",
    type: "stdio",
    icon: "🎭",
    toolCount: 8,
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    tags: ["automation", "scraping", "browser"],
    category: "development",
  },
  {
    name: "Sequential Thinking",
    description: "Extended reasoning and step-by-step problem solving",
    command: "npx -y @modelcontextprotocol/server-sequential-thinking",
    type: "stdio",
    icon: "🤔",
    toolCount: 4,
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    tags: ["reasoning", "ai", "thinking"],
    category: "ai",
  },
];
