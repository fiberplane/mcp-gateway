import type { ApiLogEntry } from "@fiberplane/mcp-gateway-types";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a unique key for a log entry
 *
 * Creates a composite key from timestamp, sessionId, and id to ensure uniqueness
 * even when logs have the same timestamp.
 */
export function getLogKey(log: ApiLogEntry): string {
  return `${log.timestamp}-${log.metadata.sessionId}-${log.id}`;
}
