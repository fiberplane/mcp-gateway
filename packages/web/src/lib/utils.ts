import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LogEntry } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a unique key for a log entry
 *
 * Creates a composite key from timestamp, sessionId, and id to ensure uniqueness
 * even when logs have the same timestamp.
 */
export function getLogKey(log: LogEntry): string {
  return `${log.timestamp}-${log.metadata.sessionId}-${log.id}`;
}
