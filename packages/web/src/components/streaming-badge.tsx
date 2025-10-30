/**
 * StreamingBadge Component
 *
 * Displays streaming status with click-to-toggle behavior.
 * Shows "Live" with animated pulse when active, or "Paused" when disabled.
 */

import { StatusDot } from "./ui/status-dot";

interface StreamingBadgeProps {
  isStreaming: boolean;
  onToggle: (enabled: boolean) => void;
}

export function StreamingBadge({ isStreaming, onToggle }: StreamingBadgeProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isStreaming}
      aria-label={`Streaming status: ${isStreaming ? "Live" : "Paused"}. Click to ${isStreaming ? "pause" : "resume"} automatic updates`}
      onClick={() => onToggle(!isStreaming)}
      title={
        isStreaming ? "Click to pause streaming" : "Click to resume streaming"
      }
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
    >
      {/* Status indicator dot */}
      <StatusDot
        variant={isStreaming ? "success" : "neutral"}
        animate={isStreaming}
      />

      {/* Status text with clarifying subtext */}
      <span className="flex items-baseline gap-1">
        <span className="text-sm font-medium">
          {isStreaming ? "Live" : "Paused"}
        </span>
        <span className="text-xs text-muted-foreground">
          {isStreaming ? "(Auto-refresh)" : "(Manual)"}
        </span>
      </span>
    </button>
  );
}
