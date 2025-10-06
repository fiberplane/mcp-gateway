import { appendFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";

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
  } catch (error) {
    // Silently fail if can't write
  }
}

// Log to file
export function debug(...args: any[]) {
  const timestamp = new Date().toISOString();
  const message = args
    .map((a) =>
      typeof a === "object" ? JSON.stringify(a, null, 2) : String(a),
    )
    .join(" ");

  try {
    appendFileSync(DEBUG_LOG, `[${timestamp}] ${message}\n`);
  } catch (error) {
    // Silently fail if can't write
  }
}

// Get log file path
export function getDebugLogPath() {
  return DEBUG_LOG;
}
