import type { ServerInfo } from "@fiberplane/mcp-gateway-types";
import { RefreshCw, Server } from "lucide-react";
import { useServerModal } from "../contexts/ServerModalContext";
import { useTimeAgo } from "../hooks/use-time-ago";
import { Button } from "./ui/button";

interface ServerHealthBannerProps {
  server: ServerInfo;
  onRetry: () => void;
  isRetrying: boolean;
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

  // Only show banner if server is offline
  if (server.health !== "down") {
    return null;
  }

  // Handler to fetch full server config before opening modal
  const handleManageServer = async () => {
    // TODO: Fetch full server config with headers
    // For now, create minimal config (type and headers will be fetched by modal)
    openEditServerModal({
      name: server.name,
      url: server.url,
      type: "http",
      headers: {},
    });
  };

  return (
    <div className="max-w-3xl mx-auto mb-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-status-error" />
            <h3 className="text-sm font-semibold text-foreground">
              Server "{server.name}" is offline
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
                    Last online: {lastOnline}
                  </p>
                )}
              </div>
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
                variant="outline"
                className="gap-2"
              >
                <Server />
                Edit
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
