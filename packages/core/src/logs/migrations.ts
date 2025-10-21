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
  // Detect if we're running as a compiled binary
  // In compiled binaries, Bun.main starts with "/$bunfs/root/" (virtual bundled filesystem)
  const isCompiledBinary = Bun.main.startsWith("/$bunfs/root/");

  if (isCompiledBinary) {
    // In compiled binary: migrations are in drizzle/ folder next to executable
    const binaryDrizzleDir = join(process.execPath, "..", "drizzle");
    const journalPath = join(binaryDrizzleDir, "meta", "_journal.json");

    try {
      const journalFile = Bun.file(journalPath);
      if (journalFile.size > 0) {
        return binaryDrizzleDir;
      }
    } catch {
      throw new Error(
        `Migrations folder not found in binary distribution at: ${binaryDrizzleDir}`,
      );
    }

    throw new Error(
      `Invalid migrations folder in binary distribution at: ${binaryDrizzleDir}`,
    );
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
      migrate(db, { migrationsFolder });
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
