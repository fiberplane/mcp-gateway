import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { captureRecordSchema } from "@fiberplane/mcp-gateway-types";
import { logger } from "../logger";
import { getDb } from "./db.js";
import { ensureMigrations } from "./migrations.js";
import { insertLog } from "./storage.js";

/**
 * Recovery statistics
 */
export interface RecoveryStats {
  totalFiles: number;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  skippedRecords: number;
  durationMs: number;
}

/**
 * Rebuild SQLite database from JSONL capture files
 *
 * This function:
 * 1. Scans all server directories for .jsonl files
 * 2. Parses each line as a CaptureRecord
 * 3. Inserts valid records into SQLite
 * 4. Reports statistics about the recovery process
 *
 * @param storageDir - Path to storage directory
 * @param clearExisting - If true, clears existing database before recovery (default: false)
 * @returns Recovery statistics
 */
export async function recoverFromJsonl(
  storageDir: string,
  clearExisting = false,
): Promise<RecoveryStats> {
  const startTime = Date.now();
  const stats: RecoveryStats = {
    totalFiles: 0,
    totalRecords: 0,
    successfulRecords: 0,
    failedRecords: 0,
    skippedRecords: 0,
    durationMs: 0,
  };

  try {
    // Initialize database
    const db = getDb(storageDir);
    await ensureMigrations(db);

    // Clear existing data if requested
    if (clearExisting) {
      logger.info("Clearing existing database before recovery");
      await db.delete(logs).execute();
    }

    // Get all server directories
    const entries = await readdir(storageDir, { withFileTypes: true });
    const serverDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    // Process each server directory
    for (const serverName of serverDirs) {
      const serverDir = join(storageDir, serverName);
      const files = await readdir(serverDir);
      const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

      for (const file of jsonlFiles) {
        stats.totalFiles++;
        const filePath = join(serverDir, file);

        try {
          await processJsonlFile(db, filePath, stats);
        } catch (error) {
          logger.error("Failed to process JSONL file", {
            file: filePath,
            error:
              error instanceof Error
                ? { message: error.message, stack: error.stack }
                : String(error),
          });
        }
      }
    }

    stats.durationMs = Date.now() - startTime;

    logger.info("Recovery completed", { ...stats });
    return stats;
  } catch (error) {
    stats.durationMs = Date.now() - startTime;
    logger.error("Recovery failed", {
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : String(error),
      stats,
    });
    throw error;
  }
}

/**
 * Process a single JSONL file
 */
async function processJsonlFile(
  db: BunSQLiteDatabase<typeof schema>,
  filePath: string,
  stats: RecoveryStats,
): Promise<void> {
  const content = (await readFile(filePath, "utf8")) as unknown as string;
  const lines = content.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    stats.totalRecords++;

    try {
      const record = JSON.parse(line);

      // Validate record
      const result = captureRecordSchema.safeParse(record);
      if (!result.success) {
        stats.failedRecords++;
        logger.warn("Invalid capture record during recovery", {
          file: filePath,
          error: result.error,
        });
        continue;
      }

      // Insert into database
      await insertLog(db, result.data);
      stats.successfulRecords++;
    } catch (error) {
      stats.failedRecords++;
      logger.warn("Failed to parse or insert record during recovery", {
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Import missing types
 */
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "./schema.js";
import { logs } from "./schema.js";
