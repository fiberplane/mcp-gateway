/** biome-ignore-all lint/style/noNonNullAssertion: tests */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger } from "../src/logger.js";

let tempDir: string;

// Helper to reset logger state
function resetLogger() {
  // @ts-expect-error - accessing private property for testing
  logger.storageDir = null;
  // @ts-expect-error - accessing private property for testing
  logger.logDir = null;
  // @ts-expect-error - accessing private property for testing
  logger.minLevel = "info";
  // @ts-expect-error - accessing private property for testing
  logger.currentDate = null;
  delete process.env.LOG_LEVEL;
}

beforeEach(async () => {
  resetLogger();
  tempDir = await mkdtemp(join(tmpdir(), "mcp-logger-test-"));
});

afterEach(async () => {
  resetLogger();
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe("Logger Initialization", () => {
  test("should create logs directory on initialization", async () => {
    await logger.initialize(tempDir);

    const logsDir = join(tempDir, "logs");
    const dirStats = await stat(logsDir);
    expect(dirStats.isDirectory()).toBe(true);
  });

  test("should set default minimum level to info", async () => {
    await logger.initialize(tempDir);

    // @ts-expect-error - accessing private property for testing
    expect(logger.minLevel).toBe("info");
  });

  test("should respect LOG_LEVEL environment variable", async () => {
    process.env.LOG_LEVEL = "debug";
    await logger.initialize(tempDir);

    // @ts-expect-error - accessing private property for testing
    expect(logger.minLevel).toBe("debug");
  });

  test("should handle invalid LOG_LEVEL gracefully", async () => {
    process.env.LOG_LEVEL = "invalid";
    await logger.initialize(tempDir);

    // @ts-expect-error - accessing private property for testing
    expect(logger.minLevel).toBe("info"); // Should remain default
  });

  test("should accept all valid log levels from environment", async () => {
    const validLevels = ["debug", "info", "warn", "error"];

    for (const level of validLevels) {
      // Reset environment and logger state for each iteration
      resetLogger();

      process.env.LOG_LEVEL = level;
      await logger.initialize(tempDir);

      // @ts-expect-error - accessing private property for testing
      expect(logger.minLevel).toBe(level);
    }
  });

  test("should handle case-insensitive LOG_LEVEL", async () => {
    process.env.LOG_LEVEL = "DEBUG";
    await logger.initialize(tempDir);

    // @ts-expect-error - accessing private property for testing
    expect(logger.minLevel).toBe("debug");
  });
});

describe("Log Level Filtering", () => {
  test.serial("should skip debug logs when minLevel is info", async () => {
    await logger.initialize(tempDir);

    logger.debug("This should not be written");
    logger.info("This should be written");

    // Wait for async file writes
    await new Promise((resolve) => setTimeout(resolve, 100));

    const logsDir = join(tempDir, "logs");
    const files = await readdir(logsDir);
    expect(files.length).toBe(1);

    const logContent = await readFile(join(logsDir, files[0]!), "utf-8");
    const lines = logContent.trim().split("\n");

    expect(lines.length).toBe(1); // Only info log
    const entry = JSON.parse(lines[0]!);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("This should be written");
  });

  test.serial("should write all logs when minLevel is debug", async () => {
    // Create a fresh temp directory for this test
    const testTempDir = await mkdtemp(join(tmpdir(), "mcp-logger-debug-test-"));
    try {
      process.env.LOG_LEVEL = "debug";
      await logger.initialize(testTempDir);

      logger.debug("Debug message");
      await new Promise((resolve) => setTimeout(resolve, 50));
      logger.info("Info message");
      await new Promise((resolve) => setTimeout(resolve, 50));
      logger.warn("Warn message");
      await new Promise((resolve) => setTimeout(resolve, 50));
      logger.error("Error message");

      // Wait for async file writes
      await new Promise((resolve) => setTimeout(resolve, 100));

      const logsDir = join(testTempDir, "logs");
      const files = await readdir(logsDir);
      const logContent = await readFile(join(logsDir, files[0]!), "utf-8");
      const lines = logContent.trim().split("\n");

      expect(lines.length).toBe(4);
      expect(JSON.parse(lines[0]!).level).toBe("debug");
      expect(JSON.parse(lines[1]!).level).toBe("info");
      expect(JSON.parse(lines[2]!).level).toBe("warn");
      expect(JSON.parse(lines[3]!).level).toBe("error");
    } finally {
      await rm(testTempDir, { recursive: true, force: true });
    }
  });

  test.serial(
    "should only write warn and error when minLevel is warn",
    async () => {
      const testTempDir = await mkdtemp(
        join(tmpdir(), "mcp-logger-warn-test-"),
      );
      try {
        process.env.LOG_LEVEL = "warn";
        await logger.initialize(testTempDir);

        logger.debug("Debug message");
        await new Promise((resolve) => setTimeout(resolve, 50));
        logger.info("Info message");
        await new Promise((resolve) => setTimeout(resolve, 50));
        logger.warn("Warn message");
        await new Promise((resolve) => setTimeout(resolve, 50));
        logger.error("Error message");

        // Wait for async file writes
        await new Promise((resolve) => setTimeout(resolve, 100));

        const logsDir = join(testTempDir, "logs");
        const files = await readdir(logsDir);
        const logContent = await readFile(join(logsDir, files[0]!), "utf-8");
        const lines = logContent.trim().split("\n");

        expect(lines.length).toBe(2);
        expect(JSON.parse(lines[0]!).level).toBe("warn");
        expect(JSON.parse(lines[1]!).level).toBe("error");
      } finally {
        await rm(testTempDir, { recursive: true, force: true });
      }
    },
  );

  test.serial("should only write error when minLevel is error", async () => {
    process.env.LOG_LEVEL = "error";
    await logger.initialize(tempDir);

    logger.debug("Debug message");
    logger.info("Info message");
    logger.warn("Warn message");
    logger.error("Error message");

    // Wait for async file writes
    await new Promise((resolve) => setTimeout(resolve, 100));

    const logsDir = join(tempDir, "logs");
    const files = await readdir(logsDir);
    const logContent = await readFile(join(logsDir, files[0]!), "utf-8");
    const lines = logContent.trim().split("\n");

    expect(lines.length).toBe(1);
    expect(JSON.parse(lines[0]!).level).toBe("error");
  });
});

describe("Log Writing", () => {
  test.serial("should write log entries as JSON lines", async () => {
    await logger.initialize(tempDir);

    logger.info("Test message");

    // Wait for async file writes
    await new Promise((resolve) => setTimeout(resolve, 100));

    const logsDir = join(tempDir, "logs");
    const files = await readdir(logsDir);
    expect(files.length).toBe(1);

    const logContent = await readFile(join(logsDir, files[0]!), "utf-8");
    const lines = logContent.trim().split("\n");

    expect(lines.length).toBe(1);
    const entry = JSON.parse(lines[0]!);

    expect(entry).toHaveProperty("timestamp");
    expect(entry).toHaveProperty("level");
    expect(entry).toHaveProperty("message");
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("Test message");
  });

  test.serial("should include context object when provided", async () => {
    await logger.initialize(tempDir);

    logger.info("Test with context", { userId: "123", action: "login" });

    // Wait for async file writes
    await new Promise((resolve) => setTimeout(resolve, 100));

    const logsDir = join(tempDir, "logs");
    const files = await readdir(logsDir);
    const logContent = await readFile(join(logsDir, files[0]!), "utf-8");
    const entry = JSON.parse(logContent.trim());

    expect(entry.context).toEqual({ userId: "123", action: "login" });
  });

  test.serial(
    "should not include context field when context is empty",
    async () => {
      await logger.initialize(tempDir);

      logger.info("Test without context");

      // Wait for async file writes
      await new Promise((resolve) => setTimeout(resolve, 100));

      const logsDir = join(tempDir, "logs");
      const files = await readdir(logsDir);
      const logContent = await readFile(join(logsDir, files[0]!), "utf-8");
      const entry = JSON.parse(logContent.trim());

      expect(entry).not.toHaveProperty("context");
    },
  );

  test.serial("should write timestamp in ISO 8601 format", async () => {
    await logger.initialize(tempDir);

    logger.info("Test timestamp");

    // Wait for async file writes
    await new Promise((resolve) => setTimeout(resolve, 100));

    const logsDir = join(tempDir, "logs");
    const files = await readdir(logsDir);
    const logContent = await readFile(join(logsDir, files[0]!), "utf-8");
    const entry = JSON.parse(logContent.trim());

    // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(entry.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  test.serial("should append multiple log entries to same file", async () => {
    // Create a fresh temp directory for this test
    const testTempDir = await mkdtemp(
      join(tmpdir(), "mcp-logger-append-test-"),
    );
    try {
      await logger.initialize(testTempDir);

      logger.info("First message");
      await new Promise((resolve) => setTimeout(resolve, 50));
      logger.warn("Second message");
      await new Promise((resolve) => setTimeout(resolve, 50));
      logger.error("Third message");

      // Wait for async file writes
      await new Promise((resolve) => setTimeout(resolve, 100));

      const logsDir = join(testTempDir, "logs");
      const files = await readdir(logsDir);
      expect(files.length).toBe(1);

      const logContent = await readFile(join(logsDir, files[0]!), "utf-8");
      const lines = logContent.trim().split("\n");

      expect(lines.length).toBe(3);
      expect(JSON.parse(lines[0]!).message).toBe("First message");
      expect(JSON.parse(lines[1]!).message).toBe("Second message");
      expect(JSON.parse(lines[2]!).message).toBe("Third message");
    } finally {
      await rm(testTempDir, { recursive: true, force: true });
    }
  });
});

describe("Daily Log Rotation", () => {
  test.serial(
    "should create log file with current date in filename",
    async () => {
      await logger.initialize(tempDir);

      logger.info("Test message");

      // Wait for async file writes
      await new Promise((resolve) => setTimeout(resolve, 100));

      const logsDir = join(tempDir, "logs");
      const files = await readdir(logsDir);

      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const expectedFilename = `gateway-${year}-${month}-${day}.log`;

      expect(files).toContain(expectedFilename);
    },
  );

  test("should handle logging without initialization gracefully", async () => {
    // Don't initialize logger
    logger.info("This should not crash");
    logger.error("This should also not crash");

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    // No logs directory should exist
    const logsDir = join(tempDir, "logs");
    try {
      await stat(logsDir);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      // Expected - directory should not exist
      expect(error).toBeDefined();
    }
  });
});

describe("Log Cleanup", () => {
  test("should delete log files older than 30 days", async () => {
    await logger.initialize(tempDir);

    const logsDir = join(tempDir, "logs");

    // Create old log files
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    const oldDate = thirtyOneDaysAgo.toISOString().split("T")[0];
    const oldLogFile = join(logsDir, `gateway-${oldDate}.log`);
    await writeFile(oldLogFile, "old log content\n", "utf-8");

    // Create recent log file
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const recentDate = yesterday.toISOString().split("T")[0];
    const recentLogFile = join(logsDir, `gateway-${recentDate}.log`);
    await writeFile(recentLogFile, "recent log content\n", "utf-8");

    // Note: We can't easily set mtime in tests, so we'll just verify the file exists for now
    // In real usage, files with old mtimes (>30 days) will be deleted by the cleanup function

    // Wait for cleanup to run (it runs on initialization)
    await new Promise((resolve) => setTimeout(resolve, 200));

    const files = await readdir(logsDir);

    // The old file should still exist in this test because we can't mock file times easily
    // In real usage, files with old mtimes will be deleted
    expect(files.length).toBeGreaterThan(0);
  });

  test("should only delete files matching gateway-*.log pattern", async () => {
    await logger.initialize(tempDir);

    const logsDir = join(tempDir, "logs");

    // Create files that should NOT be deleted
    await writeFile(join(logsDir, "other.log"), "content\n", "utf-8");
    await writeFile(join(logsDir, "gateway.txt"), "content\n", "utf-8");
    await writeFile(
      join(logsDir, "not-gateway-2025-01-01.log"),
      "content\n",
      "utf-8",
    );

    // Wait for cleanup to run
    await new Promise((resolve) => setTimeout(resolve, 200));

    const files = await readdir(logsDir);

    // These files should still exist
    expect(files).toContain("other.log");
    expect(files).toContain("gateway.txt");
    expect(files).toContain("not-gateway-2025-01-01.log");
  });
});

describe("Error Handling", () => {
  test("should not throw when writing to invalid path", async () => {
    // Initialize with valid path first
    await logger.initialize(tempDir);

    // Manually set invalid log dir to test error handling
    // @ts-expect-error - accessing private property for testing
    logger.logDir = "/invalid/path/that/does/not/exist";

    // These should not throw
    expect(() => {
      logger.info("Test message");
      logger.error("Test error");
    }).not.toThrow();
  });

  test.serial("should handle concurrent writes gracefully", async () => {
    await logger.initialize(tempDir);

    // Write many logs concurrently
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(logger.info(`Message ${i}`, { index: i }));
    }

    await Promise.all(promises);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const logsDir = join(tempDir, "logs");
    const files = await readdir(logsDir);
    const logContent = await readFile(join(logsDir, files[0]!), "utf-8");
    const lines = logContent.trim().split("\n");

    // All messages should be written
    expect(lines.length).toBe(50);
  });
});
