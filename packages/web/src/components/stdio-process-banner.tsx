import type { StdioServer } from "@fiberplane/mcp-gateway-types";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { StatusDot } from "./ui/status-dot";

interface StdioProcessBannerProps {
  server: StdioServer;
  onRefresh: () => void;
}

/**
 * Stdio Process Status Banner
 *
 * Displays process status, PID, last error, session info, and restart button
 * for stdio servers. Shows when process is crashed or stopped.
 */
export function StdioProcessBanner({
  server,
  onRefresh,
}: StdioProcessBannerProps) {
  const [isRestarting, setIsRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);

  const { processState, sessionMode = "shared" } = server;
  const { status, pid, lastError } = processState;

  // Only show banner if process has crashed or stopped after running
  // Don't show for never-initialized servers (stopped with no lastError)
  // Don't show for isolated mode (no single process to show status for)
  if (status === "running" || status === "isolated") {
    return null;
  }

  // Never initialized - don't show banner (process starts on first request)
  if (status === "stopped" && !lastError) {
    return null;
  }

  // Determine status variant and message
  const statusVariant = status === "crashed" ? "error" : "warning";
  const statusMessage =
    status === "crashed" ? "Process crashed" : "Process stopped";

  // Check if restart is supported
  const restartSupported = sessionMode === "shared";

  // Handle restart
  const handleRestart = async () => {
    if (!restartSupported) return;

    setIsRestarting(true);
    setRestartError(null);

    try {
      await api.restartStdioServer(server.name);
      // Refresh server state after successful restart
      onRefresh();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to restart server";
      setRestartError(errorMessage);
    } finally {
      setIsRestarting(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mb-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-3">
            <StatusDot variant={statusVariant} />
            <h3 className="text-sm font-semibold text-foreground">
              {statusMessage}
            </h3>
          </div>

          {/* Server info and badges */}
          <div className="flex items-center gap-3 mb-2 ml-6">
            <span className="text-sm text-muted-foreground">{server.name}</span>
            <span className="text-xs text-muted-foreground">
              Session mode: {sessionMode}
            </span>
          </div>

          {/* Error details */}
          <div className="grid gap-4">
            {lastError && (
              <div className="grid gap-1 ml-6">
                <p className="text-sm font-mono text-muted-foreground">
                  {lastError.message}
                </p>
                {lastError.code && (
                  <p className="text-xs text-muted-foreground">
                    Exit code: {lastError.code} •{" "}
                    {new Date(lastError.timestamp).toLocaleString()}
                  </p>
                )}
                {pid && (
                  <p className="text-xs text-muted-foreground">PID: {pid}</p>
                )}
              </div>
            )}

            {/* Restart error */}
            {restartError && (
              <div className="ml-6 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                {restartError}
              </div>
            )}

            {/* Actions - only show for shared mode */}
            {restartSupported ? (
              <div className="grid gap-2">
                <Button
                  onClick={handleRestart}
                  disabled={isRestarting}
                  variant="outline"
                  className="gap-2"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isRestarting ? "animate-spin" : ""}`}
                  />
                  {isRestarting ? "Restarting..." : "Restart Process"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground ml-6">
                Restart not available in isolated mode. Terminate individual
                sessions to stop the process.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
