/**
 * Format error code to human-readable message
 *
 * Maps common error codes to user-friendly messages.
 * Falls back to error message or code if no mapping exists.
 *
 * @param errorCode - Error code (e.g., "ECONNREFUSED", "ETIMEDOUT")
 * @param errorMessage - Raw error message
 * @returns Human-readable error message
 */
export function formatErrorMessage(
  errorCode?: string,
  errorMessage?: string,
): string {
  if (!errorCode) {
    return errorMessage || "Unknown error";
  }

  const errorMap: Record<string, string> = {
    ECONNREFUSED: "Connection refused",
    ETIMEDOUT: "Connection timed out",
    ENOTFOUND: "DNS lookup failed",
    TIMEOUT: "Request timed out",
    HTTP_ERROR: "Server error",
    ECONNRESET: "Connection reset",
  };

  return errorMap[errorCode] || errorCode;
}
