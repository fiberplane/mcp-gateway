/**
 * DowntimeBadge Component
 *
 * Displays downtime duration for offline servers using semantic badge tokens.
 * Severity-based coloring indicates urgency (warning < 24h, error >= 24h).
 */

import { formatDowntimeDuration } from "@/lib/duration-formatting";

interface DowntimeBadgeProps {
  /** Duration in milliseconds since server went offline */
  duration: number;
  /** Visual variant based on severity */
  variant?: "compact" | "full";
  /** Additional CSS classes */
  className?: string;
}

/**
 * DowntimeBadge - Shows how long a server has been offline
 *
 * Uses semantic badge tokens:
 * - bg-badge-warning (#fef3c7) for < 24h offline
 * - bg-badge-error (#fee2e2) for >= 24h offline
 *
 * @example
 * // Recently offline (amber/warning)
 * <DowntimeBadge duration={30 * 60 * 1000} /> // "Offline for 30 minutes"
 *
 * // Long-term offline (red/error)
 * <DowntimeBadge duration={48 * 60 * 60 * 1000} /> // "Offline for 2 days"
 */
export function DowntimeBadge({
  duration,
  variant = "full",
  className = "",
}: DowntimeBadgeProps) {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const isLongTerm = duration >= ONE_DAY;

  // Escalate to error color for extended downtime
  const badgeColor = isLongTerm ? "bg-badge-error" : "bg-badge-warning";

  const formattedDuration = formatDowntimeDuration(duration);

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium text-foreground ${badgeColor} ${className}`}
    >
      {variant === "full"
        ? `Offline for ${formattedDuration}`
        : formattedDuration}
    </span>
  );
}
