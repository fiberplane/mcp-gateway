import { join } from "node:path";
import {
  type BetterSQLite3Database,
  drizzle,
} from "drizzle-orm/better-sqlite3";
import Database from "libsql";
import * as schema from "./schema.js";

/**
 * Database connection cache for query operations
 *
 * NOTE: This cache is used by query.ts, export.ts, and recovery.ts for read operations.
 * The capture/write path (SqliteStorageBackend) owns its own connection and does NOT use this cache.
 *
 * Key: storage directory path
 * Value: Drizzle database instance
 */
const dbCache = new Map<string, BetterSQLite3Database<typeof schema>>();

/**
 * Get or create a Drizzle database connection for the given storage directory.
 *
 * Uses singleton pattern - one connection per storage directory.
 *
 * NOTE: This is used by query/export/recovery operations, NOT by the capture path.
 * SqliteStorageBackend owns its own connection for write operations.
 *
 * @param storageDir - Path to storage directory (e.g., ~/.mcp-gateway/capture)
 * @returns Drizzle database instance
 */
export function getDb(
  storageDir: string,
): BetterSQLite3Database<typeof schema> {
  // Return cached connection if exists
  const cached = dbCache.get(storageDir);
  if (cached) {
    return cached;
  }

  // Create new connection
  const dbPath = join(storageDir, "logs.db");
  const sqlite = new Database(dbPath); // libsql auto-creates the database

  // Enable WAL mode for better concurrency (multiple readers, single writer)
  // WAL (Write-Ahead Logging) allows concurrent reads while writes are happening
  sqlite.exec("PRAGMA journal_mode = WAL;");

  // Set busy timeout to 5 seconds to wait for locks instead of failing immediately
  sqlite.exec("PRAGMA busy_timeout = 5000;");

  // Use NORMAL synchronous mode for better performance (WAL provides safety)
  sqlite.exec("PRAGMA synchronous = NORMAL;");

  // Type assertion: libsql is better-sqlite3 compatible at runtime but has different types
  // @ts-expect-error - libsql and better-sqlite3 have compatible APIs but incompatible type definitions
  const db = drizzle(sqlite, { schema });

  // Cache and return
  dbCache.set(storageDir, db);
  return db;
}

/**
 * Close all database connections.
 * Useful for testing and cleanup.
 */
export function closeAllConnections(): void {
  for (const db of dbCache.values()) {
    // Drizzle doesn't expose close method, but we can access underlying sqlite
    // @ts-expect-error - Accessing internal sqlite instance
    db.$client?.close();
  }
  dbCache.clear();
}
