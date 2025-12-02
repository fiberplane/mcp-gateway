import type { McpServer } from "@fiberplane/mcp-gateway-types";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, Plus, Search, Store, Wrench } from "lucide-react";
import { useState } from "react";
import { McpServerIcon } from "@/components/ui/McpServerIcon";
import { cn } from "@/lib/utils";
import { PageLayout } from "../components/layout/page-layout";
import { PageHeader } from "../components/page-header";
import { Button, buttonVariants } from "../components/ui/button";
import { useServerModal } from "../contexts/ServerModalContext";
import { useServerConfigs } from "../hooks/use-server-configs";
import {
  MARKETPLACE_SERVERS,
  type MarketplaceServer,
} from "../lib/marketplace-data";

export function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const { data: serverConfigs } = useServerConfigs();

  // Filter marketplace servers based on search query
  const filteredServers = MARKETPLACE_SERVERS.filter((server) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      server.name.toLowerCase().includes(query) ||
      server.description.toLowerCase().includes(query)
    );
  });

  // Find matching server config if already added
  const findAddedServer = (
    marketplaceServer: MarketplaceServer,
  ): McpServer | undefined => {
    if (!serverConfigs) return undefined;
    const normalizedMarketplaceCmd = normalizeServerCommand(
      marketplaceServer.command,
    );
    return serverConfigs.servers.find((config) => {
      if (config.type === "http") {
        return normalizeServerCommand(config.url) === normalizedMarketplaceCmd;
      }
      // For stdio servers, combine command + args for comparison
      const fullCommand = [config.command, ...config.args].join(" ");
      return normalizeServerCommand(fullCommand) === normalizedMarketplaceCmd;
    });
  };

  return (
    <PageLayout icon={<Store className="h-4 w-4" />} breadcrumb="Marketplace">
      <PageHeader
        title="Popular MCP servers"
        description="Review and evaluate data from popular MCP servers"
        actions={
          showSearch ? (
            <input
              type="text"
              placeholder="Search servers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onBlur={() => {
                if (!searchQuery) setShowSearch(false);
              }}
              // biome-ignore lint/a11y/noAutofocus: Intentional UX - focus search when revealed
              autoFocus
              className="w-64 px-3 py-2 border border-input rounded-[10px] bg-secondary text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSearch(true)}
              className="rounded-[10px] h-9"
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          )
        }
      />

      {/* Server Grid */}
      <div className="@container">
        <div className="grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-5 @7xl:grid-cols-6 gap-3">
          {filteredServers.map((server) => {
            const addedServer = findAddedServer(server);
            return (
              <MarketplaceServerCard
                key={server.command}
                server={server}
                addedServer={addedServer}
              />
            );
          })}
        </div>
      </div>
      {/* Empty State */}
      {filteredServers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No servers found matching "{searchQuery}"
          </p>
        </div>
      )}
    </PageLayout>
  );
}

interface MarketplaceServerCardProps {
  server: MarketplaceServer;
  addedServer?: McpServer;
}

function MarketplaceServerCard({
  server,
  addedServer,
}: MarketplaceServerCardProps) {
  const isAdded = !!addedServer;
  const { openAddServerModal } = useServerModal();

  const handleAdd = () => {
    // Generate suggested name from server name (lowercase, hyphenated)
    const suggestedName = server.name.toLowerCase().replace(/\s+/g, "-");

    if (server.type === "http") {
      // For HTTP servers, command field contains the URL
      openAddServerModal({
        name: suggestedName,
        type: "http",
        url: server.command,
      });
    } else {
      // For stdio servers, parse command string into command + args
      const parsed = parseCommand(server.command);
      openAddServerModal({
        name: suggestedName,
        type: "stdio",
        command: parsed.command,
        args: parsed.args,
      });
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:border-accent transition-colors grid grid-rows-[auto_1fr_auto] gap-4 min-w-0">
      {/* Icon + Name + Command Row */}
      <div className="flex items-start gap-3 min-w-0">
        {/* Large Icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-md bg-muted flex items-center justify-center text-2xl">
          <McpServerIcon server={server} />
        </div>

        {/* Name + Command */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base mb-0.5">{server.name}</h3>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {server.command}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2">
        {server.description}
      </p>

      {/* Metadata Row + Action */}
      {/* Tool Count + Docs Link - Pill Style */}
      <div className="flex items-center flex-wrap gap-2">
        {server.toolCount && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-xs text-muted-foreground text-nowrap">
            <Wrench className="h-3 w-3" />
            <span className="text-foreground">{server.toolCount} tools</span>
          </span>
        )}
        {server.docsUrl && (
          <a
            href={server.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowUpRight className="h-3 w-3" />
            <span className="text-foreground">
              {getDomainFromUrl(server.docsUrl)}
            </span>
          </a>
        )}
      </div>

      <div className="flex justify-end flex-1">
        {/* Add Action */}
        {isAdded && addedServer ? (
          <Link
            to="/servers/$serverName"
            params={{ serverName: addedServer.name }}
            search={(prev) => ({ ...prev })}
            className={cn(
              buttonVariants({
                variant: "ghost",
              }),
              "h-auto px-1.5 py-1 text-sm text-status-success",
            )}
          >
            <Check className="h-3.5 w-3.5" />
            <span>Added</span>
          </Link>
        ) : (
          <Button
            variant="ghost"
            onClick={handleAdd}
            className="h-auto px-1.5 py-1 text-sm text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add</span>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Normalize server command for comparison
 * Handles npx commands
 */
function normalizeServerCommand(cmd: string): string {
  // Remove npx prefix and flags
  const normalized = cmd
    .replace(/^npx\s+(-y\s+)?/, "")
    .trim()
    .toLowerCase();

  return normalized;
}

/**
 * Parse command string into command + args
 * Example: "npx -y @modelcontextprotocol/server-linear" -> { command: "npx", args: ["-y", "@modelcontextprotocol/server-linear"] }
 */
function parseCommand(cmdString: string): { command: string; args: string[] } {
  const parts = cmdString.trim().split(/\s+/);
  const command = parts[0] || "";
  const args = parts.slice(1);

  return { command, args };
}

/**
 * Extract domain name from URL for display
 * Example: "https://linear.app/docs/mcp" -> "linear.app"
 */
function getDomainFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. prefix if present
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
