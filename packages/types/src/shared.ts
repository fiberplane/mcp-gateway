import type { Gateway } from "./gateway";
import type { JsonRpcRequest, JsonRpcResponse } from "./schemas";

// Context holds configuration and dependencies (read-only)
export type Context = {
  storageDir: string;
  port: number;
  // Gateway instance for TUI initialization
  gateway?: Gateway;
  onExit?: () => void | Promise<void>;
};

// Log entry for request/response logging
export type LogEntry = {
  timestamp: string;
  serverName: string;
  sessionId: string;
  method: string;
  httpStatus: number;
  duration: number;
  direction: "request" | "response";
  errorMessage?: string;
  request?: JsonRpcRequest;
  response?: JsonRpcResponse;
  methodDetail?: string | null; // Pre-computed human-readable detail
};

/**
 * Logger interface for dependency injection
 *
 * Used by both server and API packages for error/debug logging.
 * Implementations can provide different log levels and destinations.
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
