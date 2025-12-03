import type { HealthCheckResult } from "@fiberplane/mcp-gateway-types";
import { getErrorMessage } from "./utils/error.js";
import { extractErrorCode } from "./utils/error-detection.js";

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

    // 2xx, 3xx, and 4xx (except 404) mean server is responding
    // 404, 5xx, or network errors mean "offline"
    if (response.status < 500 && response.status !== 404) {
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
    const errorMessage = getErrorMessage(error);
    const errorCode = extractErrorCode(error);

    return {
      status: "offline",
      errorCode,
      errorMessage,
      timestamp,
    };
  }
}
