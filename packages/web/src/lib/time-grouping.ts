import type { ApiLogEntry } from "@fiberplane/mcp-gateway-types";
import {
  format,
  isSameDay,
  isWithinInterval,
  startOfWeek,
  subDays,
} from "date-fns";

/**
 * Time interval options for grouping logs
 */
export type TimeInterval = "day" | "hour" | "5min" | "minute";

/**
 * Configuration for a time grouping interval
 */
export interface TimeGroupConfig {
  interval: TimeInterval;
  /**
   * Format a label for the group (e.g., "Today", "Yesterday", "Monday, January 20, 2025")
   */
  formatLabel: (date: Date) => string;
  /**
   * Get a unique key for the group (used for sorting and React keys)
   */
  getGroupKey: (date: Date) => string;
}

/**
 * Smart label formatter that uses relative labels for recent dates
 * and absolute labels for older dates
 */
function formatDayLabel(date: Date): string {
  const now = new Date();
  const isToday = isSameDay(date, now);
  const isYesterday = isSameDay(date, subDays(now, 1));

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";

  // Check if within current week
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const isThisWeek = isWithinInterval(date, { start: weekStart, end: now });

  if (isThisWeek) {
    // Just show day name: "Monday", "Tuesday", etc.
    return format(date, "EEEE");
  }

  // Older dates: "Friday, January 17, 2025"
  return format(date, "EEEE, MMMM d, yyyy");
}

/**
 * Configuration for each time interval
 */
export const TIME_GROUP_CONFIGS: Record<TimeInterval, TimeGroupConfig> = {
  day: {
    interval: "day",
    formatLabel: formatDayLabel,
    getGroupKey: (date) => format(date, "yyyy-MM-dd"),
  },
  hour: {
    interval: "hour",
    formatLabel: (date) => {
      const now = new Date();
      const isToday = isSameDay(date, now);
      const isYesterday = isSameDay(date, subDays(now, 1));

      if (isToday) {
        return format(date, "'Today at' HH:00");
      }
      if (isYesterday) {
        return format(date, "'Yesterday at' HH:00");
      }
      return format(date, "MMMM d 'at' HH:00");
    },
    getGroupKey: (date) => format(date, "yyyy-MM-dd HH"),
  },
  "5min": {
    interval: "5min",
    formatLabel: (date) => {
      // Round down to nearest 5 minutes
      const rounded = new Date(
        Math.floor(date.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000),
      );
      return format(rounded, "HH:mm");
    },
    getGroupKey: (date) => {
      // Round down to nearest 5 minutes for consistent grouping
      const rounded = new Date(
        Math.floor(date.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000),
      );
      return format(rounded, "yyyy-MM-dd HH:mm");
    },
  },
  minute: {
    interval: "minute",
    formatLabel: (date) => format(date, "HH:mm"),
    getGroupKey: (date) => format(date, "yyyy-MM-dd HH:mm"),
  },
};

/**
 * Group logs by time interval
 *
 * @param logs - Array of log entries to group
 * @param interval - Time interval to group by
 * @returns Map of group keys to log arrays and the config used
 */
export function groupLogsByTime(
  logs: ApiLogEntry[],
  interval: TimeInterval,
): {
  groups: Map<string, ApiLogEntry[]>;
  config: TimeGroupConfig;
} {
  const config = TIME_GROUP_CONFIGS[interval];
  const groups = new Map<string, ApiLogEntry[]>();

  for (const log of logs) {
    const date = new Date(log.timestamp);
    const key = config.getGroupKey(date);

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    // biome-ignore lint/style/noNonNullAssertion: We just checked that the key exists
    groups.get(key)!.push(log);
  }

  return { groups, config };
}
