import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

/**
 * Database connection cache for query operations
 *
 * NOTE: This cache is used by query.ts, export.ts, and recovery.ts for read operations.
 * The capture/write path (LocalStorageBackend) owns its own connection and does NOT use this cache.
 *
 * Key: storage directory path
 * Value: Drizzle database instance
 */
const dbCache = new Map<string, LibSQLDatabase<typeof schema>>();

/**
 * Get or create a Drizzle database connection for the given storage directory.
 *
 * Uses singleton pattern - one connection per storage directory.
 *
 * NOTE: This is used by query/export/recovery operations, NOT by the capture path.
 * LocalStorageBackend owns its own connection for write operations.
 *
 * @param storageDir - Path to storage directory (e.g., ~/.mcp-gateway/capture)
 * @returns Drizzle database instance
 */
export async function getDb(
  storageDir: string,
): Promise<LibSQLDatabase<typeof schema>> {
  // Return cached connection if exists
  const cached = dbCache.get(storageDir);
  if (cached) {
    return cached;
  }

  // Create new connection
  // Support in-memory database for tests
  const dbPath =
    storageDir === ":memory:"
      ? "file::memory:"
      : `file:${join(storageDir, "logs.db")}`;
  const client = createClient({ url: dbPath });

  // Configure SQLite for performance and concurrency via PRAGMA statements
  // Enable WAL mode for better concurrency (multiple readers, single writer)
  // WAL (Write-Ahead Logging) allows concurrent reads while writes are happening
  await client.execute("PRAGMA journal_mode = WAL;");

  // Set busy timeout to 5 seconds to wait for locks instead of failing immediately
  await client.execute("PRAGMA busy_timeout = 5000;");

  // Use NORMAL synchronous mode for better performance (WAL provides safety)
  await client.execute("PRAGMA synchronous = NORMAL;");

  // Create Drizzle instance with proper libsql adapter
  const db = drizzle(client, { schema });

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
