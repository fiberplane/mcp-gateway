import { appendFile, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { ensureStorageDir } from "./storage.js";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

class Logger {
  private storageDir: string | null = null;
  private currentDate: string | null = null;
  private logDir: string | null = null;

  /**
   * Initialize the logger with the storage directory
   */
  async initialize(storageDir: string): Promise<void> {
    this.storageDir = storageDir;
    this.logDir = join(storageDir, "logs");
    this.currentDate = this.getDateString();

    // Ensure log directory exists
    await ensureStorageDir(this.logDir);

    // Clean up old logs (non-blocking)
    this.cleanupOldLogs().catch((error) => {
      // Silently fail - don't block initialization
      console.error("Failed to cleanup old logs:", error);
    });
  }

  /**
   * Get current date string in YYYY-MM-DD format
   */
  private getDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Get the current log file path
   */
  private getLogFilePath(): string {
    if (!this.logDir) {
      throw new Error("Logger not initialized. Call initialize() first.");
    }

    const currentDate = this.getDateString();

    // Check if we need to rotate to a new day
    if (this.currentDate !== currentDate) {
      this.currentDate = currentDate;
    }

    return join(this.logDir, `gateway-${currentDate}.log`);
  }

  /**
   * Write a log entry to file
   */
  private async writeLog(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.storageDir) {
      // Logger not initialized, silently skip
      return;
    }

    try {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...(context && Object.keys(context).length > 0 ? { context } : {}),
      };

      const logLine = `${JSON.stringify(entry)}\n`;
      const logFile = this.getLogFilePath();

      await appendFile(logFile, logLine, "utf-8");
    } catch (error) {
      // Silently fail - don't throw errors from logger
      console.error("Failed to write log:", error);
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.writeLog("debug", message, context).catch(() => {
      // Ignore errors
    });
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.writeLog("info", message, context).catch(() => {
      // Ignore errors
    });
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.writeLog("warn", message, context).catch(() => {
      // Ignore errors
    });
  }

  /**
   * Log an error message
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.writeLog("error", message, context).catch(() => {
      // Ignore errors
    });
  }

  /**
   * Clean up log files older than 30 days
   */
  private async cleanupOldLogs(): Promise<void> {
    if (!this.logDir) {
      return;
    }

    try {
      const files = await readdir(this.logDir);
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.startsWith("gateway-") || !file.endsWith(".log")) {
          continue;
        }

        const filePath = join(this.logDir, file);
        const stats = await stat(filePath);

        if (stats.mtimeMs < thirtyDaysAgo) {
          await unlink(filePath);
        }
      }
    } catch (_error) {
      // Silently fail - cleanup is not critical
    }
  }
}

// Export singleton instance
export const logger = new Logger();
