/**
 * Extract error code from various error types
 *
 * Uses three-layer fallback to handle different runtime environments:
 *
 * Layer 1: Bun-specific error.code property
 * - Bun uses camelCase error codes (e.g., "ConnectionRefused")
 * - Most reliable detection method in Bun runtime
 *
 * Layer 2: Standard Error.name property
 * - Handles cases like TimeoutError from AbortSignal.timeout()
 * - Cross-runtime compatible (works in Node.js, Bun, browsers)
 *
 * Layer 3: Error message string matching
 * - Final fallback for Node.js-style POSIX error codes (ECONNREFUSED, ETIMEDOUT, etc.)
 * - Catches errors propagated from underlying network libraries
 * - Required because error structure varies across fetch implementations
 *
 * This multi-layer approach ensures reliable error detection across:
 * - Different runtimes (Bun, Node.js)
 * - Different fetch implementations
 * - Different network stack error sources
 *
 * @param error - Error object to extract code from
 * @returns Error code string (e.g., "ECONNREFUSED", "TIMEOUT", "UNKNOWN")
 */
export function extractErrorCode(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  let errorCode = "UNKNOWN";

  // Layer 1: Bun-specific error.code property (e.g., "ConnectionRefused")
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string | number }).code;
    if (code === "ConnectionRefused") {
      errorCode = "ECONNREFUSED";
    } else if (typeof code === "string" && code.includes("TIMEOUT")) {
      errorCode = "TIMEOUT";
    }
  }

  // Layer 2: Standard Error.name property (e.g., "TimeoutError")
  if (errorCode === "UNKNOWN" && error instanceof Error) {
    if (error.name === "TimeoutError") {
      errorCode = "TIMEOUT";
    }
  }

  // Layer 3: Error message string matching for Node.js-style POSIX codes
  if (errorCode === "UNKNOWN") {
    if (errorMessage.includes("ECONNREFUSED")) {
      errorCode = "ECONNREFUSED";
    } else if (errorMessage.includes("ETIMEDOUT")) {
      errorCode = "ETIMEDOUT";
    } else if (errorMessage.includes("ENOTFOUND")) {
      errorCode = "ENOTFOUND";
    } else if (errorMessage.includes("aborted")) {
      errorCode = "TIMEOUT";
    } else if (errorMessage.includes("ECONNRESET")) {
      errorCode = "ECONNRESET";
    }
  }

  return errorCode;
}
