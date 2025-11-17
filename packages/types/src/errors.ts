/**
 * JSON-RPC 2.0 Error Codes
 *
 * Standard codes: -32700 to -32600
 * Server errors: -32099 to -32000 (implementation-defined)
 *
 * @see https://www.jsonrpc.org/specification#error_object
 */
export const JSON_RPC_ERRORS = {
  // Standard JSON-RPC 2.0 errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // Server errors (implementation-defined range: -32000 to -32099)
  SERVER_ERROR: -32000,
  PROCESS_CRASHED: -32001,
  SESSION_CRASHED: -32002,
  TIMEOUT: -32003,
  STDIO_NOT_CONFIGURED: -32004,
  SESSION_NOT_FOUND: -32005,
} as const;

export type JsonRpcErrorCode =
  (typeof JSON_RPC_ERRORS)[keyof typeof JSON_RPC_ERRORS];

/**
 * Get human-readable error name from code
 */
export function getErrorName(code: number): string {
  const entry = Object.entries(JSON_RPC_ERRORS).find(([_, c]) => c === code);
  return entry ? entry[0] : "UNKNOWN_ERROR";
}

/**
 * Error thrown when restart operation is not supported for the server configuration
 */
export class RestartNotSupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestartNotSupportedError";
  }
}
