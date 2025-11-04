import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
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
  const currentFile = fileURLToPath(import.meta.url);

  // Development: packages/core/src/logs/migrations.ts
  // Look for migrations in: packages/core/drizzle
  const devMigrationsPath = join(dirname(currentFile), "..", "..", "drizzle");

  // Check if we're in development mode (source files)
  if (currentFile.includes("/src/")) {
    return devMigrationsPath;
  }

  // Production (bundled): dist/cli.js or dist/index.js
  // Migrations copied to: drizzle/ (at package root, sibling to dist/)
  // Walk up from dist/ to package root
  const distDir = dirname(currentFile);
  const packageRoot = join(distDir, "..");
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
  db: LibSQLDatabase<typeof schema>,
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
