/**
 * Registry for evaluation server HTTP handlers
 *
 * This allows the evaluator to create handlers upfront when creating temp servers,
 * and the proxy routes to look them up without recreating them on every request.
 */

const evaluationHandlers = new Map<string, (request: Request) => Promise<Response>>();

/**
 * Register an evaluation handler for a server
 */
export function registerEvaluationHandler(
  serverName: string,
  handler: (request: Request) => Promise<Response>,
): void {
  evaluationHandlers.set(serverName, handler);
}

/**
 * Get an evaluation handler for a server
 */
export function getEvaluationHandler(
  serverName: string,
): ((request: Request) => Promise<Response>) | undefined {
  return evaluationHandlers.get(serverName);
}

/**
 * Remove an evaluation handler (cleanup after evaluation completes)
 */
export function unregisterEvaluationHandler(serverName: string): void {
  evaluationHandlers.delete(serverName);
}

/**
 * Clear all evaluation handlers
 */
export function clearEvaluationHandlers(): void {
  evaluationHandlers.clear();
}
