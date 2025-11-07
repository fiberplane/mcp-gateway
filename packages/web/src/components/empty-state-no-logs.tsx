import type { ServerInfo } from "@fiberplane/mcp-gateway-types";
import { AlertCircle, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useState } from "react";
import { useHealthCheck } from "../hooks/use-health-check";
import { useTimeAgo } from "../hooks/use-time-ago";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { Button } from "./ui/button";

/**
 * Escape shell argument for safe CLI command generation
 * Wraps argument in double quotes and escapes special characters
 */
function escapeShellArg(arg: string): string {
  return `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/`/g, "\\`")}"`;
}

/**
 * Format error code to human-readable message
 */
function formatErrorMessage(errorCode?: string, errorMessage?: string): string {
  if (!errorCode) {
    return errorMessage || "Unknown error";
  }

  const errorMap: Record<string, string> = {
    ECONNREFUSED: "Connection refused",
    ETIMEDOUT: "Connection timed out",
    ENOTFOUND: "DNS lookup failed",
    TIMEOUT: "Request timed out",
    HTTP_ERROR: "Server error",
    ECONNRESET: "Connection reset",
  };

  return errorMap[errorCode] || errorCode;
}

/**
 * Server card component for offline servers (uses hooks)
 */
function OfflineServerCard({
  server,
  onRetry,
  isRetrying,
}: {
  server: ServerInfo;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const lastChecked = useTimeAgo(server.lastCheckTime);

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-status-error" />
            <span className="text-sm font-semibold text-foreground">
              {server.name}
            </span>
          </div>
          <p className="text-sm text-status-error mb-1">
            {formatErrorMessage(server.errorCode, server.errorMessage)}
          </p>
          <p className="text-xs text-muted-foreground">
            Last checked: {lastChecked || "never"}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={isRetrying}
        >
          {isRetrying ? "Checking..." : "Retry"}
        </Button>
      </div>
    </div>
  );
}

export function EmptyStateNoLogs({ servers }: { servers: ServerInfo[] }) {
  const { copy, copiedId } = useCopyToClipboard<string>();
  const { mutate: checkHealth, isPending: isCheckingHealth } = useHealthCheck();
  const [showAllOnline, setShowAllOnline] = useState(false);
  const [showOfflineSection, setShowOfflineSection] = useState(true);

  const gatewayOrigin = window.location.origin;

  // Split servers by health status
  // Treat undefined/unknown health as "online" for onboarding UX
  const onlineServers = servers.filter((s) => s.health !== "down");
  const offlineServers = servers.filter((s) => s.health === "down");

  const handleCopy = async (command: string, serverName: string) => {
    await copy(command, serverName);
  };

  // All servers offline
  if (offlineServers.length === servers.length && servers.length > 0) {
    return (
      <div className="flex flex-col p-10 max-w-3xl mx-auto">
        <div className="rounded-lg border border-border bg-muted/30 p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                All servers are offline
              </h2>
              <p className="text-sm text-muted-foreground">
                None of your servers are currently responding. Check the details
                below and retry.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {offlineServers.map((server) => (
              <OfflineServerCard
                key={server.name}
                server={server}
                onRetry={() => checkHealth(server.name)}
                isRetrying={isCheckingHealth}
              />
            ))}
          </div>
        </div>

        <div className="bg-muted/30 border border-muted rounded-lg p-4">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> Make sure your MCP servers are running and
            accessible at their configured URLs
          </p>
        </div>
      </div>
    );
  }

  // All servers online
  if (onlineServers.length === servers.length && servers.length > 0) {
    const displayServers = showAllOnline
      ? onlineServers
      : onlineServers.slice(0, 3);
    const hasMore = onlineServers.length > 3;

    return (
      <div className="flex flex-col p-10 max-w-3xl mx-auto">
        <div className="rounded-lg border border-border bg-muted/30 p-6 mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Start capturing MCP traffic
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Run these commands to connect your MCP client to Claude Code through
            the gateway:
          </p>

          <div className="space-y-3">
            {displayServers.map((server) => {
              const command = `claude mcp add --transport http ${escapeShellArg(server.name)} \\\n  ${escapeShellArg(`${gatewayOrigin}/s/${encodeURIComponent(server.name)}/mcp`)}`;
              const isCopied = copiedId === server.name;

              return (
                <div
                  key={server.name}
                  className="bg-card border border-border rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-status-success" />
                    <span className="text-sm font-semibold text-foreground">
                      {server.name}
                    </span>
                  </div>
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

          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAllOnline(!showAllOnline)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mt-4"
            >
              {showAllOnline ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show {onlineServers.length - 3} more servers
                </>
              )}
            </button>
          )}
        </div>

        <div className="bg-muted/30 border border-muted rounded-lg p-4">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> Run <code className="font-mono">/mcp</code>{" "}
            in Claude Code to verify your servers are connected
          </p>
        </div>
      </div>
    );
  }

  // Mixed state (some online, some offline)
  const displayOnlineServers = showAllOnline
    ? onlineServers
    : onlineServers.slice(0, 3);
  const hasMoreOnline = onlineServers.length > 3;

  return (
    <div className="flex flex-col p-10 max-w-3xl mx-auto">
      {/* Online servers section */}
      <div className="rounded-lg border border-border bg-muted/30 p-6 mb-6">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Start capturing MCP traffic
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Run these commands to connect your MCP client to Claude Code through
          the gateway:
        </p>

        <div className="space-y-3">
          {displayOnlineServers.map((server) => {
            const command = `claude mcp add --transport http ${escapeShellArg(server.name)} \\\n  ${escapeShellArg(`${gatewayOrigin}/s/${encodeURIComponent(server.name)}/mcp`)}`;
            const isCopied = copiedId === server.name;

            return (
              <div
                key={server.name}
                className="bg-card border border-border rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-status-success" />
                  <span className="text-sm font-semibold text-foreground">
                    {server.name}
                  </span>
                </div>
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

        {hasMoreOnline && (
          <button
            type="button"
            onClick={() => setShowAllOnline(!showAllOnline)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mt-4"
          >
            {showAllOnline ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show {onlineServers.length - 3} more servers
              </>
            )}
          </button>
        )}
      </div>

      {/* Offline servers section (collapsible) */}
      {offlineServers.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-6 mb-6">
          <button
            type="button"
            onClick={() => setShowOfflineSection(!showOfflineSection)}
            className="w-full flex items-center justify-between mb-4"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">
                {offlineServers.length} server
                {offlineServers.length !== 1 ? "s" : ""} offline
              </h3>
            </div>
            {showOfflineSection ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {showOfflineSection && (
            <div className="space-y-3">
              {offlineServers.map((server) => (
                <OfflineServerCard
                  key={server.name}
                  server={server}
                  onRetry={() => checkHealth(server.name)}
                  isRetrying={isCheckingHealth}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-muted/30 border border-muted rounded-lg p-4">
        <p className="text-xs text-muted-foreground">
          💡 <strong>Tip:</strong> Run <code className="font-mono">/mcp</code>{" "}
          in Claude Code to verify your servers are connected
        </p>
      </div>
    </div>
  );
}
