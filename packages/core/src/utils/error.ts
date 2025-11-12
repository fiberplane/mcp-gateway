/**
 * Extract error message from unknown error type
 *
 * Handles Error instances and falls back to string conversion
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
