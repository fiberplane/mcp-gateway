import type { HealthCheckResult } from "@fiberplane/mcp-gateway-types";

export async function checkServerHealth(
  url: string,
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Try OPTIONS first (lightweight), fallback to HEAD
    const response = await fetch(url, {
      method: "OPTIONS",
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    const responseTimeMs = Date.now() - startTime;
    const timestamp = Date.now();

    // 2xx, 3xx, 4xx all mean server is responding
    // Only 5xx or network errors mean "down"
    if (response.status < 500) {
      return {
        status: "online",
        responseTimeMs,
        timestamp,
      };
    }

    return {
      status: "offline",
      errorCode: "HTTP_ERROR",
      errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      timestamp,
    };
  } catch (error) {
    // Network errors, timeouts, DNS failures = offline
    const timestamp = Date.now();
    const errorMessage = error instanceof Error ? error.message : String(error);
    let errorCode = "UNKNOWN";

    /**
     * Error code detection uses three-layer fallback to handle different runtime environments:
     *
     * Layer 1: Bun-specific error.code property
     * - Bun uses camelCase error codes (e.g., "ConnectionRefused")
     * - This is the most reliable detection method in Bun runtime
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
     */

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

    return {
      status: "offline",
      errorCode,
      errorMessage,
      timestamp,
    };
  }
}
