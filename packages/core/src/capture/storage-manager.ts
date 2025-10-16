import type { CaptureRecord } from "@fiberplane/mcp-gateway-types";
import { logger } from "../logger";
import type { StorageBackend, StorageWriteResult } from "./storage-backend.js";

/**
 * Storage manager
 *
 * Coordinates multiple storage backends, allowing them to work
 * independently and in parallel.
 */
export class StorageManager {
  private backends: Map<string, StorageBackend> = new Map();
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: storageDir is set in initialize() method
  private storageDir: string | null = null;
  private initialized = false;

  /**
   * Register a storage backend
   *
   * @param backend - The storage backend to register
   */
  registerBackend(backend: StorageBackend): void {
    if (this.initialized) {
      throw new Error(
        "Cannot register backends after initialization. Call registerBackend before initialize().",
      );
    }

    this.backends.set(backend.name, backend);
    logger.debug("Storage backend registered", { name: backend.name });
  }

  /**
   * Initialize all registered backends
   *
   * @param storageDir - Base storage directory
   */
  async initialize(storageDir: string): Promise<void> {
    if (this.initialized) {
      logger.warn("Storage manager already initialized");
      return;
    }

    this.storageDir = storageDir;

    // Initialize all backends in parallel
    const initPromises = Array.from(this.backends.entries()).map(
      async ([name, backend]) => {
        await backend.initialize(storageDir);
        logger.info("Storage backend initialized", { name });
      },
    );

    await Promise.all(initPromises);
    this.initialized = true;
    logger.info("Storage manager initialized", {
      backends: Array.from(this.backends.keys()),
      storageDir,
    });
  }

  /**
   * Write a capture record to all registered backends
   *
   * All backends write in parallel. If any backend fails, the entire
   * write operation fails.
   *
   * @param record - The capture record to write
   * @returns Map of backend names to write results
   */
  async write(record: CaptureRecord): Promise<Map<string, StorageWriteResult>> {
    if (!this.initialized) {
      throw new Error(
        "Storage manager not initialized. Call initialize() first.",
      );
    }

    const results = new Map<string, StorageWriteResult>();

    // Write to all backends in parallel
    const writePromises = Array.from(this.backends.entries()).map(
      async ([name, backend]) => {
        const result = await backend.write(record);
        results.set(name, result);
      },
    );

    await Promise.all(writePromises);
    return results;
  }

  /**
   * Close all registered backends
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.backends.values()).map(
      async (backend) => {
        if (backend.close) {
          await backend.close();
        }
      },
    );

    await Promise.all(closePromises);
    this.initialized = false;
    logger.info("Storage manager closed");
  }

  /**
   * Get a specific backend by name
   *
   * @param name - Backend name
   * @returns The backend, or undefined if not found
   */
  getBackend(name: string): StorageBackend | undefined {
    return this.backends.get(name);
  }

  /**
   * Get all registered backend names
   */
  getBackendNames(): string[] {
    return Array.from(this.backends.keys());
  }
}

// Global storage manager instance
let globalStorageManager: StorageManager | null = null;

/**
 * Get or create the global storage manager
 */
export function getStorageManager(): StorageManager {
  if (!globalStorageManager) {
    globalStorageManager = new StorageManager();
  }
  return globalStorageManager;
}

/**
 * Reset the global storage manager (for testing)
 */
export function resetStorageManager(): void {
  globalStorageManager = null;
}
