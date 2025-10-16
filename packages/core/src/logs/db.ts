import { Database } from "bun:sqlite";
import { join } from "node:path";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.js";

/**
 * Database connection cache
 * Key: storage directory path
 * Value: Drizzle database instance
 */
const dbCache = new Map<string, BunSQLiteDatabase<typeof schema>>();

/**
 * Get or create a Drizzle database connection for the given storage directory.
 *
 * Uses singleton pattern - one connection per storage directory.
 *
 * @param storageDir - Path to storage directory (e.g., ~/.mcp-gateway/capture)
 * @returns Drizzle database instance
 */
export function getDb(storageDir: string): BunSQLiteDatabase<typeof schema> {
  // Return cached connection if exists
  const cached = dbCache.get(storageDir);
  if (cached) {
    return cached;
  }

  // Create new connection
  const dbPath = join(storageDir, "logs.db");
  const sqlite = new Database(dbPath, { create: true });
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
