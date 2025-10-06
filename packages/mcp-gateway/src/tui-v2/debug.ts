import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const DEBUG_LOG = join(homedir(), ".mcp-gateway", "tui-debug.log");

// Initialize debug log (clear on startup)
export function initDebugLog() {
  try {
    // Ensure directory exists
    mkdirSync(dirname(DEBUG_LOG), { recursive: true });
    // Clear log and write header
    writeFileSync(
      DEBUG_LOG,
      `=== TUI Debug Log Started: ${new Date().toISOString()} ===\n`,
    );
  } catch (_error) {
    // Silently fail if can't write
  }
}

// Log to file
// biome-ignore lint/suspicious/noExplicitAny: Debug function needs to accept any type
export function debug(...args: any[]) {
  const timestamp = new Date().toISOString();
  const message = args
    .map((a) =>
      typeof a === "object" ? JSON.stringify(a, null, 2) : String(a),
    )
    .join(" ");

  try {
    appendFileSync(DEBUG_LOG, `[${timestamp}] ${message}\n`);
  } catch (_error) {
    // Silently fail if can't write
  }
}

// Get log file path
export function getDebugLogPath() {
  return DEBUG_LOG;
}
