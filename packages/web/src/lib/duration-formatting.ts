/**
 * Duration Formatting Utilities
 *
 * Formats millisecond durations into human-readable strings.
 * Used for displaying server downtime and time-since-last-online.
 */

/**
 * Format duration in compact form for badges and tabs
 *
 * @param ms - Duration in milliseconds
 * @returns Compact string like "30m", "2h", "3d"
 *
 * @example
 * formatCompactDuration(1800000) // "30m"
 * formatCompactDuration(7200000) // "2h"
 * formatCompactDuration(86400000) // "1d"
 */
export function formatCompactDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(ms / 86_400_000);
  return `${days}d`;
}

/**
 * Format duration in full form for banners and detailed displays
 *
 * @param ms - Duration in milliseconds
 * @returns Full string like "30 minutes", "2 hours", "3 days"
 *
 * @example
 * formatDowntimeDuration(1800000) // "30 minutes"
 * formatDowntimeDuration(7200000) // "2 hours"
 * formatDowntimeDuration(86400000) // "1 day"
 */
export function formatDowntimeDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;

  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""}`;

  const days = Math.floor(ms / 86_400_000);
  return `${days} day${days !== 1 ? "s" : ""}`;
}
