/**
 * Custom error classes for registry operations
 *
 * These typed errors enable proper error handling without string matching,
 * making the code more maintainable and type-safe.
 */

/**
 * Thrown when attempting to add a server that already exists
 */
export class ServerAlreadyExistsError extends Error {
  constructor(serverName: string) {
    super(`Server '${serverName}' already exists`);
    this.name = "ServerAlreadyExistsError";
  }
}

/**
 * Thrown when attempting to access a server that doesn't exist
 */
export class ServerNotFoundError extends Error {
  constructor(serverName: string) {
    super(`Server '${serverName}' not found`);
    this.name = "ServerNotFoundError";
  }
}
