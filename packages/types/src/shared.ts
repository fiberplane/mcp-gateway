import type { JsonRpcRequest, JsonRpcResponse } from "./schemas";

// Context holds configuration and dependencies (read-only)
export type Context = {
  storageDir: string;
  port: number;
  gateway?: unknown; // Gateway type (imported here would create circular dependency, so use unknown)
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
};
