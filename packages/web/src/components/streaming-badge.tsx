/**
 * StreamingBadge Component
 *
 * Compact badge showing streaming status with click-to-toggle behavior.
 * Displays "Live" with animated pulse when streaming is active,
 * or "Paused" when streaming is disabled.
 *
 * Features:
 * - Visual status indicator with animated pulse
 * - Click to toggle streaming on/off
 * - Accessible as a switch control
 * - Tooltip for discoverability
 */

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
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {/* Status indicator dot */}
      <span
        className={`w-2 h-2 rounded-full ${
          isStreaming ? "bg-status-success animate-pulse" : "bg-status-neutral"
        }`}
        aria-hidden="true"
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
