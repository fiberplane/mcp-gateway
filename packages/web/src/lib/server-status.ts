import type {
  McpServer,
  StdioProcessState,
} from "@fiberplane/mcp-gateway-types";

/**
 * Server status information derived from McpServer
 */
export interface ServerStatusInfo {
  /** Server is healthy (HTTP health check passed) */
  isHealthy: boolean;
  /** Server is unhealthy (HTTP health check failed) */
  isUnhealthy: boolean;
  /** Server is stdio type */
  isStdio: boolean;
  /** Process is running (stdio only) */
  isRunning: boolean;
  /** Process has crashed (stdio only) */
  isCrashed: boolean;
  /** Process is stopped (stdio only) */
  isStopped: boolean;
  /** Process state for stdio servers */
  processState: StdioProcessState | undefined;
}

/**
 * Extract status information from McpServer
 * Centralizes the logic for determining server health/process state
 */
export function getServerStatusInfo(server: McpServer): ServerStatusInfo {
  const health = server.health;
  const isStdio = server.type === "stdio";
  const processState = isStdio ? server.processState : undefined;

  return {
    isHealthy: health === "up",
    isUnhealthy: health === "down",
    isStdio,
    isRunning: processState?.status === "running",
    isCrashed: processState?.status === "crashed",
    isStopped: processState?.status === "stopped",
    processState,
  };
}

/**
 * Status display variant for UI components
 */
export type StatusVariant =
  | "healthy"
  | "unhealthy"
  | "running"
  | "crashed"
  | "stopped"
  | "remote";

/**
 * Get display variant for server status
 */
export function getStatusDisplayVariant(server: McpServer): StatusVariant {
  const { isHealthy, isUnhealthy, isRunning, isCrashed, isStopped } =
    getServerStatusInfo(server);

  if (isHealthy) return "healthy";
  if (isUnhealthy) return "unhealthy";
  if (isCrashed) return "crashed";

  // Use direct type check for proper TypeScript narrowing
  if (server.type === "stdio") {
    if (isStopped && server.processState?.lastError) return "stopped";
    if (isRunning) return "running";
    return "stopped";
  }

  return "remote";
}

/**
 * Get human-readable label for status variant
 */
export function getStatusLabel(variant: StatusVariant): string {
  switch (variant) {
    case "healthy":
      return "Healthy";
    case "unhealthy":
      return "Unhealthy";
    case "running":
      return "Running";
    case "crashed":
      return "Crashed";
    case "stopped":
      return "Stopped";
    case "remote":
      return "Remote";
  }
}
