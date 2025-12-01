import { ArrowUpRight, Check, Plus, Search, Store } from "lucide-react";
import { useState } from "react";
import { PageLayout } from "../components/layout/page-layout";
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
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
      server.description.toLowerCase().includes(query) ||
      server.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  // Check if a server is already added by comparing commands
  const isServerAdded = (marketplaceServer: MarketplaceServer): boolean => {
    if (!serverConfigs) return false;
    const normalizedMarketplaceCmd = normalizeServerCommand(
      marketplaceServer.command,
    );
    return serverConfigs.servers.some((config) => {
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredServers.map((server) => {
          const added = isServerAdded(server);
          return (
            <MarketplaceServerCard
              key={server.command}
              server={server}
              isAdded={added}
            />
          );
        })}
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
  isAdded: boolean;
}

function MarketplaceServerCard({
  server,
  isAdded,
}: MarketplaceServerCardProps) {
  const { openAddServerModal } = useServerModal();

  const handleAdd = () => {
    // Parse command string into command + args
    const parsed = parseCommand(server.command);

    // Generate suggested name from server name (lowercase, hyphenated)
    const suggestedName = server.name.toLowerCase().replace(/\s+/g, "-");

    // Open modal with pre-filled data
    openAddServerModal({
      name: suggestedName,
      type: server.type,
      ...(server.type === "stdio" && {
        command: parsed.command,
        args: parsed.args,
      }),
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:border-accent transition-colors">
      {/* Icon + Name + Command Row */}
      <div className="flex items-start gap-3 mb-3">
        {/* Large Icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-md bg-muted flex items-center justify-center text-2xl">
          {server.icon || "📦"}
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
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {server.description}
      </p>

      {/* Metadata Row + Action */}
      <div className="flex items-center justify-between">
        {/* Tool Count + GitHub Link */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {server.toolCount && (
            <span>
              <span className="font-medium text-foreground">
                {server.toolCount}
              </span>{" "}
              tools
            </span>
          )}
          {server.githubUrl && (
            <a
              href={server.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 hover:text-foreground transition-colors"
            >
              GitHub
              <ArrowUpRight className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Add Action */}
        {isAdded ? (
          <div className="flex items-center gap-1 text-xs text-status-success">
            <Check className="h-3 w-3" />
            <span>Added</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          >
            <Plus className="h-3 w-3" />
            <span>Add</span>
          </button>
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
