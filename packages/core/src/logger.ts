import { appendFile, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { ensureStorageDir } from "./utils/storage";

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
  private minLevel: LogLevel = "info"; // Default: skip debug logs

  /**
   * Initialize the logger with the storage directory
   */
  async initialize(storageDir: string): Promise<void> {
    this.storageDir = storageDir;
    this.logDir = join(storageDir, "logs");
    this.currentDate = this.getDateString();

    // Set minimum log level from environment variable
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    if (
      envLevel === "debug" ||
      envLevel === "info" ||
      envLevel === "warn" ||
      envLevel === "error"
    ) {
      this.minLevel = envLevel;
    }

    // Ensure log directory exists
    await ensureStorageDir(this.logDir);

    // Clean up old logs (non-blocking)
    this.cleanupOldLogs().catch((error) => {
      // Silently fail - don't block initialization
      // biome-ignore lint/suspicious/noConsole: actually want to print to console
      console.error("Failed to cleanup old logs:", error);
    });
  }

  /**
   * Check if a log level should be written based on minimum level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.minLevel];
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

    // Check if this log level should be written
    if (!this.shouldLog(level)) {
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
      // HACK - Don't log errors in test environment (this was a quickfix, sorry)
      if (!this.isTestEnvironment()) {
        // biome-ignore lint/suspicious/noConsole: actually want to print to console
        console.error("Failed to write log:", error);
      }
    }
  }

  private isTestEnvironment(): boolean {
    return (
      process.env.NODE_ENV === "test" ||
      process.env.BTEST === "1" || // Bun sets this during tests
      (typeof Bun !== "undefined" && Bun.env.TEST === "true")
    );
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
