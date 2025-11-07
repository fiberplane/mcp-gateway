import type { ServerInfo } from "@fiberplane/mcp-gateway-types";
import { RefreshCw, Server } from "lucide-react";
import { useState } from "react";
import { useServerModal } from "../contexts/ServerModalContext";
import { useTimeAgo } from "../hooks/use-time-ago";
import { api } from "../lib/api";
import { formatErrorMessage } from "../lib/error-formatting";
import { Button } from "./ui/button";
import { StatusDot } from "./ui/status-dot";

interface ServerHealthBannerProps {
  server: ServerInfo;
  onRetry: () => void;
  isRetrying: boolean;
}

/**
 * Server Health Banner
 *
 * Displayed above the logs table when a server is offline.
 * Shows error details and provides a retry button for manual health checks.
 */
export function ServerHealthBanner({
  server,
  onRetry,
  isRetrying,
}: ServerHealthBannerProps) {
  const lastChecked = useTimeAgo(server.lastCheckTime);
  const lastOnline = useTimeAgo(server.lastHealthyTime);
  const { openEditServerModal } = useServerModal();
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Only show banner if server is offline
  if (server.health !== "down") {
    return null;
  }

  // Determine if this server used to work (transient failure) or never worked (config issue)
  const neverWorked = !server.lastHealthyTime;

  // Choose semantic colors for StatusDot based on server history
  const statusVariant = neverWorked ? "error" : "warning";

  // Contextual header message
  const headerMessage = neverWorked
    ? `Server "${server.name}" has never responded`
    : `Server "${server.name}" is offline`;

  // Handler to fetch full server config before opening modal
  const handleManageServer = async () => {
    try {
      setIsLoadingConfig(true);
      // Fetch full server configs to get headers
      const { servers } = await api.getServerConfigs();
      const fullConfig = servers.find((s) => s.name === server.name);

      if (fullConfig) {
        // Open modal with complete config including headers
        openEditServerModal(fullConfig);
      } else {
        // Fallback: server not found in configs (shouldn't happen)
        // Use minimal config - user can still edit but won't have existing headers
        openEditServerModal({
          name: server.name,
          url: server.url,
          type: "http",
          headers: {},
        });
      }
    } catch (_error) {
      // Fallback: show modal with minimal config
      // User can still edit but won't have existing headers
      openEditServerModal({
        name: server.name,
        url: server.url,
        type: "http",
        headers: {},
      });
    } finally {
      setIsLoadingConfig(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mb-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid">
          <div className="flex items-center gap-2 mb-3">
            <StatusDot
              variant={statusVariant}
              aria-label={
                neverWorked ? "Server never worked" : "Server used to work"
              }
            />
            <h3 className="text-sm font-semibold text-foreground">
              {headerMessage}
            </h3>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-1 ml-4">
              <p className="text-sm font-mono text-muted-foreground">
                {formatErrorMessage(server.errorCode, server.errorMessage)}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <p className="text-xs text-muted-foreground">
                  Last checked: {lastChecked || "never"}
                </p>
                {server.lastHealthyTime && (
                  <p className="text-xs text-muted-foreground">
                    Was online: {lastOnline}
                  </p>
                )}
              </div>
            </div>
            <div className="text-xs text-muted-foreground ml-4">
              <p>
                Health checks verify the server is reachable by sending an
                OPTIONS request to its configured URL.
              </p>
            </div>
            <div className="grid gap-2 grid-cols-2">
              <Button
                onClick={onRetry}
                disabled={isRetrying}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {isRetrying ? "Checking..." : "Check Health"}
              </Button>
              <Button
                onClick={handleManageServer}
                disabled={isLoadingConfig}
                variant="outline"
                className="gap-2"
              >
                <Server />
                {isLoadingConfig ? "Loading..." : "Edit"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
