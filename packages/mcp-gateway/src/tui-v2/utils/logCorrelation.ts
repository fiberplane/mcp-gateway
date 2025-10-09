import type { LogEntry } from "../../tui/state.js";

/**
 * Find the matching response for a request log entry
 */
export function findMatchingResponse(
  requestLog: LogEntry,
  logs: LogEntry[],
): LogEntry | null {
  // Notifications don't have responses
  if (!requestLog.request?.id) return null;

  return (
    logs.find(
      (log) =>
        log.direction === "response" &&
        log.response?.id === requestLog.request?.id &&
        log.sessionId === requestLog.sessionId &&
        log.serverName === requestLog.serverName,
    ) ?? null
  );
}

/**
 * Find the matching request for a response log entry
 */
export function findMatchingRequest(
  responseLog: LogEntry,
  logs: LogEntry[],
): LogEntry | null {
  if (!responseLog.response?.id) return null;

  return (
    logs.find(
      (log) =>
        log.direction === "request" &&
        log.request?.id === responseLog.response?.id &&
        log.sessionId === responseLog.sessionId &&
        log.serverName === responseLog.serverName,
    ) ?? null
  );
}

/**
 * Get the full request/response pair
 */
export function getRequestResponsePair(
  log: LogEntry,
  logs: LogEntry[],
): { request: LogEntry | null; response: LogEntry | null } {
  if (log.direction === "request") {
    return {
      request: log,
      response: findMatchingResponse(log, logs),
    };
  } else {
    return {
      request: findMatchingRequest(log, logs),
      response: log,
    };
  }
}

/**
 * Calculate time delta between request and response
 */
export function calculateTimeDelta(
  requestLog: LogEntry,
  responseLog: LogEntry,
): number {
  const requestTime = new Date(requestLog.timestamp).getTime();
  const responseTime = new Date(responseLog.timestamp).getTime();
  return responseTime - requestTime;
}

/**
 * Format time delta for display
 */
export function formatTimeDelta(deltaMs: number): string {
  if (deltaMs < 1000) {
    return `${deltaMs}ms later`;
  }
  return `${(deltaMs / 1000).toFixed(2)}s later`;
}
