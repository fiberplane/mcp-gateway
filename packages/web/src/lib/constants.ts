/**
 * Application-wide constants for polling intervals, timeouts, and other config values
 */

/**
 * Polling intervals in milliseconds
 * Used for auto-refresh of data from API
 */
export const POLLING_INTERVALS = {
  /** Refresh interval for server list */
  SERVERS: 5000,
  /** Refresh interval for logs (when streaming enabled) */
  LOGS: 5000,
  /** Refresh interval for sessions */
  SESSIONS: 5000,
} as const;

/**
 * Query cache configuration in milliseconds
 */
export const QUERY_CONFIG = {
  /** Time data is considered fresh (stale time) */
  STALE_TIME: 4000,
} as const;

/**
 * UI timeout values in milliseconds
 */
export const TIMEOUTS = {
  /** Tooltip delay before showing */
  TOOLTIP_DELAY: 300,
  /** Copy feedback display duration */
  COPY_FEEDBACK: 2000,
} as const;
