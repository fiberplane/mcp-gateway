import { type ChildProcess, spawn } from "node:child_process";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  StdioServerConfig,
} from "@fiberplane/mcp-gateway-types";
import { logger } from "../logger.js";

/**
 * Environment variables safe to pass to subprocess
 * Only essential variables that don't contain secrets
 */
const SAFE_ENV_VARS = [
  "PATH",
  "HOME",
  "USER",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TMPDIR",
  "TMP",
  "TEMP",
  "SHELL",
  "TERM",
  "COLORTERM",
  "NODE_ENV",
] as const;

/**
 * Filter environment variables to only safe ones
 * Prevents leaking Gateway secrets to subprocess
 */
function getSafeEnvironment(
  customEnv?: Record<string, string>,
): Record<string, string> {
  const safeEnv: Record<string, string> = {};

  // Copy only whitelisted variables from parent process
  for (const key of SAFE_ENV_VARS) {
    const value = process.env[key];
    if (value) {
      safeEnv[key] = value;
    }
  }

  // Allow custom env vars from config to override (admin-controlled)
  if (customEnv) {
    Object.assign(safeEnv, customEnv);
  }

  return safeEnv;
}

/**
 * Options for StdioProcess
 */
export interface StdioProcessOptions {
  config: StdioServerConfig;
  requestTimeout?: number;
  onProcessExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
  onStderr?: (data: string) => void;
}

/**
 * Response handler with timeout
 */
interface ResponseHandler {
  resolve: (response: JsonRpcResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Manages a stdio-based MCP server subprocess
 *
 * Handles:
 * - Process lifecycle (spawn, kill, restart)
 * - Newline-delimited JSON-RPC communication
 * - Request/response correlation via JSON-RPC ID
 * - Timeout handling
 * - Stderr capture for debugging
 */
export class StdioProcess {
  private process: ChildProcess | null = null;
  private buffer = "";
  // Note: JSON-RPC 2.0 allows id: null (though typically for notifications).
  // We handle it here for spec compliance, though it's unusual in responses.
  private responseHandlers = new Map<string | number | null, ResponseHandler>();
  private readonly requestTimeout: number;

  // Health monitoring
  private lastResponseTime = Date.now();
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly hangTimeout = 120000; // 2 minutes

  constructor(private readonly options: StdioProcessOptions) {
    this.requestTimeout = options.requestTimeout || 30000;
    this.spawn();
  }

  /**
   * Spawn the subprocess
   */
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Called in constructor
  private spawn(): void {
    const { config } = this.options;

    logger.debug("Spawning stdio process", {
      command: config.command,
      args: config.args,
      cwd: config.cwd,
    });

    this.process = spawn(config.command, config.args, {
      cwd: config.cwd,
      env: getSafeEnvironment(config.env),
      stdio: ["pipe", "pipe", "pipe"], // stdin, stdout, stderr
    });

    // Handle stdout (JSON-RPC responses)
    this.process.stdout?.setEncoding("utf8");
    this.process.stdout?.on("data", (data: string) => {
      this.buffer += data;
      this.processBuffer();
    });

    // Handle stderr (log output)
    this.process.stderr?.setEncoding("utf8");
    this.process.stderr?.on("data", (data: string) => {
      logger.debug("Stderr from subprocess", {
        server: config.name,
        data: data.trim(),
      });
      this.options.onStderr?.(data);
    });

    // Handle process exit
    this.process?.on("exit", (code, signal) => {
      logger.error("Stdio process exited", {
        server: config.name,
        code,
        signal,
      });

      const error = new Error(`Process exited: code=${code}, signal=${signal}`);

      // Reject all pending requests with try-catch to prevent loop abortion
      for (const [id, handler] of this.responseHandlers) {
        try {
          clearTimeout(handler.timeout);
          handler.reject(error);
        } catch (err) {
          logger.debug("Handler rejection threw", { id, error: err });
        }
      }
      this.responseHandlers.clear();

      this.options.onProcessExit?.(code, signal);
    });

    // Handle spawn errors
    this.process?.on("error", (err) => {
      logger.error("Failed to spawn subprocess", {
        server: config.name,
        error: err.message,
      });

      // Notify parent to update process state
      this.options.onProcessExit?.(null, null);

      // Reject all pending requests
      const spawnError = new Error(`Spawn failed: ${err.message}`);
      for (const [id, handler] of this.responseHandlers) {
        try {
          clearTimeout(handler.timeout);
          handler.reject(spawnError);
        } catch (handlerError) {
          logger.debug("Handler rejection threw", { id, error: handlerError });
        }
      }
      this.responseHandlers.clear();
    });

    logger.info("Spawned stdio process", {
      server: config.name,
      pid: this.process.pid,
    });

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Start monitoring process health (detect hung processes)
   *
   * Only triggers when there are outstanding requests - idle time is not a hang.
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      // Only check for hangs when there are pending requests
      // Idle processes should not be killed
      if (this.responseHandlers.size === 0) {
        return;
      }

      const timeSinceResponse = Date.now() - this.lastResponseTime;

      if (timeSinceResponse > this.hangTimeout) {
        logger.warn("Process appears hung - no responses", {
          server: this.options.config.name,
          timeSinceResponseMs: timeSinceResponse,
          hangTimeoutMs: this.hangTimeout,
          pendingRequests: this.responseHandlers.size,
        });

        // Force kill hung process
        this.kill();
        this.options.onProcessExit?.(null, "SIGHUNG" as NodeJS.Signals);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Process buffered stdout data (newline-delimited JSON)
   */
  private processBuffer(): void {
    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (!line) {
        newlineIndex = this.buffer.indexOf("\n");
        continue;
      }

      // Update last response time for health monitoring
      this.lastResponseTime = Date.now();

      try {
        const message = JSON.parse(line);

        if (this.isResponse(message)) {
          // Warn if response has null ID (unusual but valid per JSON-RPC 2.0)
          if (message.id === null) {
            logger.warn("Received response with null ID (unusual)", {
              server: this.options.config.name,
              message,
            });
          }

          const handler = this.responseHandlers.get(message.id);
          if (handler) {
            clearTimeout(handler.timeout);
            this.responseHandlers.delete(message.id);
            handler.resolve(message);
          } else {
            logger.warn("Received response with unknown ID", {
              server: this.options.config.name,
              id: message.id,
            });
          }
        } else if (this.isNotification(message)) {
          // Server-initiated notification (no id field or id: null)
          logger.debug("Received notification", {
            server: this.options.config.name,
            method: message.method,
          });
        } else {
          logger.warn("Received unexpected message format", {
            server: this.options.config.name,
            message,
          });
        }
      } catch (err) {
        logger.error("Failed to parse JSON from subprocess", {
          server: this.options.config.name,
          line,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      newlineIndex = this.buffer.indexOf("\n");
    }
  }

  /**
   * Check if message is a JSON-RPC response
   */
  private isResponse(message: unknown): message is JsonRpcResponse {
    return (
      typeof message === "object" &&
      message !== null &&
      "jsonrpc" in message &&
      message.jsonrpc === "2.0" &&
      "id" in message &&
      ("result" in message || "error" in message)
    );
  }

  /**
   * Check if message is a JSON-RPC notification
   * Notifications either lack an 'id' field or have id: null
   */
  private isNotification(message: unknown): message is JsonRpcRequest {
    return (
      typeof message === "object" &&
      message !== null &&
      "jsonrpc" in message &&
      message.jsonrpc === "2.0" &&
      "method" in message &&
      (!("id" in message) || message.id === null) // Per JSON-RPC 2.0 spec, notifications either lack an 'id' or have 'id: null'
    );
  }

  /**
   * Send a JSON-RPC request to the subprocess
   */
  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.process || this.process.exitCode !== null) {
      throw new Error("Process not running");
    }

    // Notifications (no id) don't expect responses
    if (request.id === undefined || request.id === null) {
      const line = `${JSON.stringify(request)}\n`;
      this.process.stdin?.write(line, "utf8");
      // Return a dummy response for notifications
      return Promise.resolve({
        jsonrpc: "2.0",
        result: null,
        id: null,
      });
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      // request.id is guaranteed to be string | number after null/undefined check above
      const requestId = request.id as string | number;

      const safeReject = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.responseHandlers.delete(requestId);
        reject(error);
      };

      const safeResolve = (response: JsonRpcResponse) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.responseHandlers.delete(requestId);
        resolve(response);
      };

      const timeout = setTimeout(() => {
        safeReject(new Error(`Request timeout after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      this.responseHandlers.set(requestId, {
        resolve: safeResolve,
        reject: safeReject,
        timeout,
      });

      const line = `${JSON.stringify(request)}\n`;
      const written = this.process?.stdin?.write(line, "utf8");

      if (written === false) {
        // Backpressure handling: wait for drain event
        this.process?.stdin?.once("drain", () => {
          logger.debug("Stdin drained", {
            server: this.options.config.name,
          });
        });
      }
    });
  }

  /**
   * Get process ID
   */
  get pid(): number | undefined {
    return this.process?.pid;
  }

  /**
   * Check if process is running
   */
  get isRunning(): boolean {
    return !!this.process && this.process.exitCode === null;
  }

  /**
   * Gracefully terminate the process
   */
  async terminate(): Promise<void> {
    if (!this.process || this.process.exitCode !== null) {
      return;
    }

    logger.info("Terminating stdio process", {
      server: this.options.config.name,
      pid: this.process.pid,
    });

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Cancel all pending requests before terminating
    const terminationError = new Error("Server shutting down");
    for (const [id, handler] of this.responseHandlers) {
      try {
        clearTimeout(handler.timeout);
        handler.reject(terminationError);
      } catch (err) {
        logger.debug("Handler rejection threw during termination", {
          id,
          error: err,
        });
      }
    }
    this.responseHandlers.clear();

    // Send shutdown notification (MCP spec compliance)
    try {
      await this.send({
        jsonrpc: "2.0",
        method: "shutdown",
        id: `shutdown-${Date.now()}`,
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      logger.debug("Shutdown notification failed", {
        server: this.options.config.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // SIGTERM
    this.process?.kill("SIGTERM");

    // Wait for exit, or force kill after 5s
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process && this.process.exitCode === null) {
          logger.warn("Process didn't exit after SIGTERM, sending SIGKILL", {
            server: this.options.config.name,
          });
          this.process.kill("SIGKILL");
        }
        resolve();
      }, 5000);

      this.process?.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * Force kill the process
   */
  kill(): void {
    if (this.process && this.process.exitCode === null) {
      logger.warn("Force killing stdio process", {
        server: this.options.config.name,
        pid: this.process.pid,
      });
      this.process.kill("SIGKILL");
    }
  }
}
