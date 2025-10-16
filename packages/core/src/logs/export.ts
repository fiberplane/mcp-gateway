import { writeFile } from "node:fs/promises";
import type { LogQueryOptions } from "@fiberplane/mcp-gateway-types";
import { logger } from "../logger";
import { getDb } from "./db.js";
import { ensureMigrations } from "./migrations.js";
import { queryLogs } from "./storage.js";

/**
 * Export statistics
 */
export interface ExportStats {
  totalRecords: number;
  filePath: string;
  fileSizeBytes: number;
  durationMs: number;
}

/**
 * Export logs to JSONL format
 *
 * This function:
 * 1. Queries logs from SQLite with optional filters
 * 2. Writes records to JSONL file (one JSON object per line)
 * 3. Returns export statistics
 *
 * @param storageDir - Path to storage directory
 * @param outputPath - Path where JSONL file should be written
 * @param options - Query options to filter exported logs
 * @returns Export statistics
 */
export async function exportLogsToJsonl(
  storageDir: string,
  outputPath: string,
  options: LogQueryOptions = {},
): Promise<ExportStats> {
  const startTime = Date.now();

  try {
    // Initialize database
    const db = getDb(storageDir);
    await ensureMigrations(db);

    // Query all matching logs (no limit by default)
    const queryOptions = { ...options, limit: options.limit || 10000 };
    const result = await queryLogs(db, queryOptions);

    // Convert records to JSONL
    const jsonlContent = result.data
      .map((record) => JSON.stringify(record))
      .join("\n");

    // Write to file
    await writeFile(outputPath, `${jsonlContent}\n`, "utf8");

    const fileSizeBytes = Buffer.byteLength(jsonlContent, "utf8");
    const stats: ExportStats = {
      totalRecords: result.data.length,
      filePath: outputPath,
      fileSizeBytes,
      durationMs: Date.now() - startTime,
    };

    logger.info("Export completed", { ...stats });
    return stats;
  } catch (error) {
    logger.error("Export failed", {
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : String(error),
      outputPath,
    });
    throw error;
  }
}

/**
 * Export logs with streaming for large datasets
 *
 * This function:
 * 1. Streams logs from SQLite in batches
 * 2. Writes records to JSONL file incrementally
 * 3. Handles very large exports without loading everything into memory
 *
 * @param storageDir - Path to storage directory
 * @param outputPath - Path where JSONL file should be written
 * @param options - Query options to filter exported logs
 * @param batchSize - Number of records per batch (default: 1000)
 * @returns Export statistics
 */
export async function exportLogsToJsonlStream(
  storageDir: string,
  outputPath: string,
  options: LogQueryOptions = {},
  batchSize = 1000,
): Promise<ExportStats> {
  const startTime = Date.now();
  let totalRecords = 0;
  let fileSizeBytes = 0;

  try {
    // Initialize database
    const db = getDb(storageDir);
    await ensureMigrations(db);

    // Open file for writing
    const file = Bun.file(outputPath);
    const writer = file.writer();

    // Query logs in batches
    let hasMore = true;
    let oldestTimestamp: string | null = null;

    while (hasMore) {
      const queryOptions: LogQueryOptions = {
        ...options,
        limit: batchSize,
        before: oldestTimestamp || undefined,
        order: "desc",
      };

      const result = await queryLogs(db, queryOptions);

      // Write batch to file
      for (const record of result.data) {
        const line = `${JSON.stringify(record)}\n`;
        writer.write(line);
        fileSizeBytes += Buffer.byteLength(line, "utf8");
      }

      totalRecords += result.data.length;
      hasMore = result.pagination.hasMore;
      oldestTimestamp = result.pagination.oldestTimestamp;
    }

    // Finalize file
    await writer.end();

    const stats: ExportStats = {
      totalRecords,
      filePath: outputPath,
      fileSizeBytes,
      durationMs: Date.now() - startTime,
    };

    logger.info("Streaming export completed", { ...stats });
    return stats;
  } catch (error) {
    logger.error("Streaming export failed", {
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : String(error),
      outputPath,
    });
    throw error;
  }
}

/**
 * Export logs to JSON array format
 *
 * Exports all matching logs as a single JSON array.
 * Warning: Not suitable for large datasets.
 *
 * @param storageDir - Path to storage directory
 * @param outputPath - Path where JSON file should be written
 * @param options - Query options to filter exported logs
 * @returns Export statistics
 */
export async function exportLogsToJson(
  storageDir: string,
  outputPath: string,
  options: LogQueryOptions = {},
): Promise<ExportStats> {
  const startTime = Date.now();

  try {
    // Initialize database
    const db = getDb(storageDir);
    await ensureMigrations(db);

    // Query all matching logs
    const queryOptions = { ...options, limit: options.limit || 10000 };
    const result = await queryLogs(db, queryOptions);

    // Convert to JSON array
    const jsonContent = JSON.stringify(result.data, null, 2);

    // Write to file
    await writeFile(outputPath, jsonContent, "utf8");

    const fileSizeBytes = Buffer.byteLength(jsonContent, "utf8");
    const stats: ExportStats = {
      totalRecords: result.data.length,
      filePath: outputPath,
      fileSizeBytes,
      durationMs: Date.now() - startTime,
    };

    logger.info("JSON export completed", { ...stats });
    return stats;
  } catch (error) {
    logger.error("JSON export failed", {
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : String(error),
      outputPath,
    });
    throw error;
  }
}
