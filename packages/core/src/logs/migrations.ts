import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import type * as schema from "./schema.js";

/**
 * Migration promise cache to ensure migrations run only once per process
 * even if called concurrently from multiple places
 */
let migrationPromise: Promise<void> | null = null;

/**
 * Get the migrations folder path
 * Works in both development and production builds
 */
function getMigrationsFolder(): string {
  // Try binary location first (next to executable)
  const binaryDrizzleDir = join(process.execPath, "..", "drizzle");
  if (Bun.file(join(binaryDrizzleDir, "meta", "_journal.json")).size > 0) {
    return binaryDrizzleDir;
  }

  // In development: packages/core/src/logs/migrations.ts
  // Migrations are in: packages/core/drizzle
  const currentFile = fileURLToPath(import.meta.url);
  const packageRoot = join(dirname(currentFile), "..", "..");
  return join(packageRoot, "drizzle");
}

/**
 * Ensure database migrations have been run.
 *
 * This function is thread-safe and idempotent:
 * - First caller runs migrations
 * - Concurrent callers wait on the same promise
 * - Subsequent callers return immediately
 * - Failed migrations allow retry
 *
 * @param db - Drizzle database instance
 */
export async function ensureMigrations(
  db: BunSQLiteDatabase<typeof schema>,
): Promise<void> {
  // If migrations are already running or complete, wait/return
  if (migrationPromise) {
    return migrationPromise;
  }

  // Start migrations (only one caller gets here)
  migrationPromise = (async () => {
    try {
      const migrationsFolder = getMigrationsFolder();
      await migrate(db, { migrationsFolder });
    } catch (err) {
      // Reset promise to allow retry
      migrationPromise = null;
      throw err;
    }
  })();

  return migrationPromise;
}

/**
 * Reset migration state (for testing)
 */
export function resetMigrationState(): void {
  migrationPromise = null;
}
