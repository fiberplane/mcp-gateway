import type { McpServer } from "@fiberplane/mcp-gateway-types";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  type LucideIcon,
  Square,
} from "lucide-react";
import {
  getStatusDisplayVariant,
  getStatusLabel,
  type StatusVariant,
} from "../lib/server-status";

interface ServerStatusBadgeProps {
  server: McpServer;
  /** Show text label alongside icon */
  showLabel?: boolean;
}

/**
 * Icon and color configuration for each status variant
 */
const statusConfig: Record<
  StatusVariant,
  { icon: LucideIcon; colorClass: string }
> = {
  healthy: { icon: CheckCircle2, colorClass: "text-status-success" },
  unhealthy: { icon: AlertCircle, colorClass: "text-status-error" },
  running: { icon: Activity, colorClass: "text-status-info" },
  crashed: { icon: AlertCircle, colorClass: "text-status-error" },
  stopped: { icon: Square, colorClass: "text-status-neutral" },
  remote: { icon: Activity, colorClass: "text-status-info" },
};

/**
 * ServerStatusBadge displays the current status of an MCP server
 *
 * Centralizes the status display logic previously duplicated across
 * servers-page.tsx and server-details-page.tsx
 */
export function ServerStatusBadge({
  server,
  showLabel = true,
}: ServerStatusBadgeProps) {
  const variant = getStatusDisplayVariant(server);
  const { icon: Icon, colorClass } = statusConfig[variant];
  const label = getStatusLabel(variant);

  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${colorClass}`} />
      {showLabel && <span className="text-sm">{label}</span>}
    </div>
  );
}
