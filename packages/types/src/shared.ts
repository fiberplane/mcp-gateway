import type { JsonRpcRequest, JsonRpcResponse } from "./schemas";

// Gateway is defined in @fiberplane/mcp-gateway-core but we cannot import it here
// due to circular dependency: types → core → types. Instead we use 'unknown' as the type.
// This is intentional and correct - consumers should cast to Gateway type when needed.
// Gateway type is properly known in packages that don't have the circular import issue.

// Context holds configuration and dependencies (read-only)
export type Context = {
  storageDir: string;
  port: number;
  // Gateway instance for TUI initialization
  // Type is 'unknown' due to circular dependency constraints (see explanation above)
  gateway?: unknown;
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
