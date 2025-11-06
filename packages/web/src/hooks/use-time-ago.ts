import { useEffect, useState } from "react";

/**
 * Format a timestamp as relative time (e.g., "2m ago", "5h ago")
 * Updates every second for live updates
 */
export function useTimeAgo(timestamp?: number): string {
  const [timeAgo, setTimeAgo] = useState(() => formatTimeAgo(timestamp));

  useEffect(() => {
    if (!timestamp) {
      setTimeAgo("");
      return;
    }

    // Update immediately
    setTimeAgo(formatTimeAgo(timestamp));

    // Update every second
    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(timestamp));
    }, 1000);

    return () => clearInterval(interval);
  }, [timestamp]);

  return timeAgo;
}

/**
 * Format a timestamp as relative time string
 */
function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return "";

  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(seconds / 86400);
  return `${days}d ago`;
}
