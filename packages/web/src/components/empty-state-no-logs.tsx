import type { ServerInfo } from "@fiberplane/mcp-gateway-types";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useState } from "react";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { Button } from "./ui/button";

/**
 * Escape shell argument for safe CLI command generation
 * Wraps argument in double quotes and escapes special characters
 */
function escapeShellArg(arg: string): string {
  return `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/`/g, "\\`")}"`;
}

export function EmptyStateNoLogs({ servers }: { servers: ServerInfo[] }) {
  const { copy, copiedId } = useCopyToClipboard<string>();
  const [showAll, setShowAll] = useState(false);

  const gatewayOrigin = window.location.origin;
  const displayServers = showAll ? servers : servers.slice(0, 3);
  const hasMore = servers.length > 3;

  const handleCopy = async (command: string, serverName: string) => {
    await copy(command, serverName);
  };

  return (
    <div className="flex flex-col p-10 max-w-3xl mx-auto">
      {/* Heading */}
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Start capturing MCP traffic
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Run these commands to connect your MCP client to claude code through the
        gateway:
      </p>

      {/* Server Commands */}
      <div className="space-y-3 mb-4">
        {displayServers.map((server) => {
          const command = `claude mcp add --transport http ${escapeShellArg(server.name)} \\\n  ${escapeShellArg(`${gatewayOrigin}/s/${encodeURIComponent(server.name)}/mcp`)}`;
          const isCopied = copiedId === server.name;

          return (
            <div
              key={server.name}
              className="bg-accent/10 border border-accent/20 rounded-lg p-4"
            >
              {/* Server name */}
              <div className="text-sm font-semibold text-foreground mb-2">
                {server.name}
              </div>

              {/* Command */}
              <div className="flex items-start gap-3">
                <code className="text-xs font-mono text-muted-foreground flex-1 whitespace-pre-wrap break-all">
                  {command}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(command, server.name)}
                  className="shrink-0"
                >
                  {isCopied ? "Copied!" : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more/less toggle */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 self-start mb-6"
        >
          {showAll ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show {servers.length - 3} more servers
            </>
          )}
        </button>
      )}

      {/* Tip */}
      <div className="bg-muted/30 border border-muted rounded-lg p-4">
        <p className="text-xs text-muted-foreground">
          💡 <strong>Tip:</strong> Run <code className="font-mono">/mcp</code>{" "}
          in Claude Code to verify your servers are connected
        </p>
      </div>
    </div>
  );
}
