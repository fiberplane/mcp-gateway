import type { ResponseBodyCaptureMode } from "../types.js";

/**
 * Determines if response body should be captured based on environment configuration
 * and response status.
 */
export function shouldCaptureResponseBody(
  captureMode: ResponseBodyCaptureMode | undefined,
  isError: boolean,
): boolean {
  const mode = captureMode || "none"; // Default to none for security

  switch (mode) {
    case "all":
      return true;
    case "errors":
      return isError;
    default:
      return false;
  }
}

/**
 * Gets the response body capture mode from environment variables
 */
export function getResponseBodyCaptureMode(
  env: Record<string, string>,
): ResponseBodyCaptureMode {
  return (env.MCP_RESPONSE_BODY_CAPTURE as ResponseBodyCaptureMode) || "none";
}

/**
 * Gets the configurable content size limit from environment variables
 * @param env environment variables
 * @returns Size limit in bytes (default: 61440 = 60KB)
 */
export function getContentSizeLimit(env: Record<string, string>): number {
  const limit = env.MCP_CONTENT_SIZE_LIMIT;
  console.info("[tracing] Getting content size limit", { limit });
  if (limit) {
    const parsed = Number.parseInt(limit, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 61440; // Default 60KB in bytes
}
