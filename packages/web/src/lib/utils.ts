import type { ApiLogEntry } from "@fiberplane/mcp-gateway-types";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a unique key for a log entry
 *
 * Creates a composite key from timestamp, sessionId, id, and direction to ensure uniqueness.
 * Direction is included to handle SSE events where multiple events can have identical
 * timestamp, sessionId, and id (often null for stateless events).
 */
export function getLogKey(log: ApiLogEntry): string {
  return `${log.timestamp}-${log.metadata.sessionId}-${log.id}-${log.direction}`;
}
