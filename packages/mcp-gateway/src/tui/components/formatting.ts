// ANSI escape codes for terminal control
// Use alternate screen buffer + clear screen for better isolation
export const CLEAR_SCREEN = "\x1b[2J\x1b[H";
export const RESET_COLOR = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";
export const CYAN = "\x1b[96m";
export const GREEN = "\x1b[92m";
export const YELLOW = "\x1b[93m";
export const RED = "\x1b[91m";

// Subtle method-type colors (slightly dimmed shades)
export const BLUE_DIM = "\x1b[38;5;75m"; // tools
export const PURPLE_DIM = "\x1b[38;5;141m"; // resources
export const ORANGE_DIM = "\x1b[38;5;215m"; // prompts
export const GRAY = "\x1b[38;5;245m"; // session ID

// Truncate URL for display
export function truncateUrl(url: string, maxLength: number = 30): string {
  if (url.length <= maxLength) return url;
  return `${url.slice(0, maxLength - 3)}...`;
}

// Format timestamp for display
export function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return "—";
  try {
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return "—";
  }
}

// Format relative time (e.g., "2 min ago", "1 hour ago")
export function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "—";
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatTimestamp(timestamp);
  } catch {
    return "—";
  }
}
