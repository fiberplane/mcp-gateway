/**
 * Request tracker interface for tracking request/response pairs
 *
 * Used by the Gateway to track requests and calculate duration when responses arrive.
 * This allows proper duration calculation for JSON-RPC request/response pairs.
 */
export interface RequestTracker {
  /**
   * Track a request by ID and method
   * Called when a request is captured
   *
   * @param id - The request ID
   * @param method - The request method
   */
  trackRequest(id: string | number, method: string): void;

  /**
   * Calculate duration and cleanup tracking for a request
   * Called when the response arrives
   *
   * @param id - The request ID
   * @returns Duration in milliseconds
   */
  calculateDuration(id: string | number): number;

  /**
   * Get the method for a tracked request
   *
   * @param id - The request ID
   * @returns The method name or undefined if not tracked
   */
  getMethod(id: string | number): string | undefined;

  /**
   * Check if a request is being tracked
   *
   * @param id - The request ID
   * @returns True if the request is tracked
   */
  hasRequest(id: string | number): boolean;
}
