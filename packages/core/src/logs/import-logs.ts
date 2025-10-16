#!/usr/bin/env bun
/**
 * Import JSONL logs into SQLite database
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { recoverFromJsonl } from "./recovery.js";

const storageDir = join(homedir(), ".mcp-gateway", "captures");

console.log("📁 Storage directory:", storageDir);
console.log("🔄 Starting JSONL import...\n");

const stats = await recoverFromJsonl(storageDir, false);

console.log("\n✅ Import complete!");
console.log(`📊 Stats:
  Total files: ${stats.totalFiles}
  Total records: ${stats.totalRecords}
  Successful: ${stats.successfulRecords}
  Failed: ${stats.failedRecords}
  Skipped: ${stats.skippedRecords}
  Duration: ${stats.durationMs}ms
`);
