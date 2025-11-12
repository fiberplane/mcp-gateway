import {
  JSON_RPC_ERRORS,
  type JsonRpcRequest,
  type JsonRpcResponse,
  RestartNotSupportedError,
  type StdioProcessState,
  type StdioServerConfig,
} from "@fiberplane/mcp-gateway-types";
import { logger } from "../logger.js";
import { getErrorMessage } from "../utils/error.js";
import { StderrBuffer } from "./stderr-buffer.js";
import { StdioProcess } from "./stdio-process.js";

/**
 * Manages a stdio server and its sessions
 *
 * Supports two modes:
 * - shared: Single subprocess shared by all sessions (default)
 * - isolated: One subprocess per session (session IDs required)
 */
export class StdioSessionManager {
  // Shared mode: single process
  private sharedProcess: StdioProcess | null = null;

  // Isolated mode: map of session ID → process
  private isolatedSessions = new Map<string, StdioProcess>();

  // Session tracking
  private activeSessions = new Set<string>();

  // Session limits and LRU tracking (isolated mode only)
  private readonly maxIsolatedSessions = 100;
  private sessionLastActivity = new Map<string, number>();

  // Shared stderr buffer (for shared mode)
  private stderrBuffer = new StderrBuffer();

  // Shared process state (for shared mode)
  private sharedProcessState: StdioProcessState = {
    status: "stopped",
    pid: null,
    lastError: null,
    stderrLogs: [],
  };

  // Session mode
  private readonly sessionMode: "shared" | "isolated";

  constructor(private readonly config: StdioServerConfig) {
    this.sessionMode = config.sessionMode ?? "shared";
  }

  /**
   * Initialize the subprocess (shared mode only)
   */
  async initialize(): Promise<void> {
    if (this.sharedProcess?.isRunning) {
      logger.debug("Shared process already running", {
        server: this.config.name,
      });
      return;
    }

    logger.info("Initializing stdio session manager (shared mode)", {
      server: this.config.name,
    });

    this.sharedProcess = new StdioProcess({
      config: this.config,
      requestTimeout: this.config.timeout,
      onProcessExit: (code, signal) => {
        this.sharedProcessState = {
          status: "crashed",
          pid: null,
          lastError: {
            message: `Process exited with code ${code}, signal ${signal}`,
            code: code?.toString() || signal || "UNKNOWN",
            timestamp: Date.now(),
          },
          stderrLogs: this.stderrBuffer.getLines(),
        };

        logger.error("Shared stdio process crashed", {
          server: this.config.name,
          code,
          signal,
        });

        // No auto-restart - server stays crashed until manual restart
      },
      onStderr: (data) => {
        this.stderrBuffer.push(data);
        this.sharedProcessState.stderrLogs = this.stderrBuffer.getLines();
      },
    });

    // Send MCP initialize request to verify server is ready
    try {
      logger.debug("Sending initialize request to verify readiness", {
        server: this.config.name,
      });

      const initRequest: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: "init-check",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "mcp-gateway",
            version: "1.0.0",
          },
        },
      };

      // Wait up to 60 seconds for initialization (handles npx download, cold starts, etc.)
      const response = (await Promise.race([
        this.sharedProcess.send(initRequest),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Initialize timeout")), 60000),
        ),
      ])) as JsonRpcResponse;

      if (response.error) {
        throw new Error(
          `Initialize failed: ${response.error.message || "Unknown error"}`,
        );
      }

      // Successfully initialized
      this.sharedProcessState = {
        status: "running",
        pid: this.sharedProcess.pid ?? -1,
        lastError: null,
        stderrLogs: this.stderrBuffer.getLines(),
      };

      logger.info("Shared stdio process initialized successfully", {
        server: this.config.name,
        pid: this.sharedProcess.pid,
      });
    } catch (error) {
      logger.error("Failed to initialize stdio process", {
        server: this.config.name,
        error: getErrorMessage(error),
      });

      // Update state to show crash (for UI banner display)
      this.sharedProcessState = {
        status: "crashed",
        pid: null,
        lastError: {
          message:
            error instanceof Error
              ? error.message
              : "Failed to initialize process",
          code: "INIT_FAILED",
          timestamp: Date.now(),
        },
        stderrLogs: this.stderrBuffer.getLines(),
      };

      // Clean up failed process
      if (this.sharedProcess) {
        await this.sharedProcess.terminate();
        this.sharedProcess = null;
      }

      throw new Error(
        `Failed to initialize stdio process: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Send request from a session
   *
   * Delegates to mode-specific implementation
   */
  async send(
    sessionId: string | undefined,
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    if (this.sessionMode === "shared") {
      return this.sendShared(sessionId, request);
    } else {
      return this.sendIsolated(sessionId, request);
    }
  }

  /**
   * Send request in shared mode (single process for all sessions)
   */
  private async sendShared(
    sessionId: string | undefined,
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    // Check if crashed - return error instead of auto-restarting
    if (this.sharedProcessState.status === "crashed") {
      return {
        jsonrpc: "2.0",
        error: {
          code: JSON_RPC_ERRORS.PROCESS_CRASHED,
          message: "Server crashed. Use restart endpoint to recover.",
          data: {
            serverName: this.config.name,
            lastError: this.sharedProcessState.lastError,
          },
        },
        id: request.id ?? null,
      };
    }

    // Process should already be initialized eagerly (no lazy initialization for shared mode)
    if (!this.sharedProcess || !this.sharedProcess.isRunning) {
      logger.error(
        "Shared process not running - should have been initialized",
        {
          server: this.config.name,
          status: this.sharedProcessState.status,
        },
      );
      return {
        jsonrpc: "2.0",
        error: {
          code: JSON_RPC_ERRORS.SERVER_ERROR,
          message: "Process not initialized. Server may be starting up.",
          data: {
            serverName: this.config.name,
          },
        },
        id: request.id ?? null,
      };
    }

    logger.debug("Sending request to shared stdio process", {
      server: this.config.name,
      method: request.method,
      id: request.id,
      sessionId,
    });

    try {
      // For shared mode: namespace JSON-RPC ids by session to prevent collision
      // Multiple clients often use the same id (e.g., 0 for initialize)
      const originalId = request.id;
      const namespacedRequest =
        originalId !== undefined && originalId !== null && sessionId
          ? { ...request, id: `${sessionId}:${originalId}` }
          : request;

      const response = await this.sharedProcess.send(namespacedRequest);

      // Restore original id in response
      if (
        originalId !== undefined &&
        originalId !== null &&
        response.id !== null &&
        response.id !== undefined
      ) {
        response.id = originalId;
      }

      logger.debug("Received response from shared stdio process", {
        server: this.config.name,
        id: request.id,
        sessionId,
      });

      return response;
    } catch (error) {
      logger.error("Request to shared stdio process failed", {
        server: this.config.name,
        method: request.method,
        error: getErrorMessage(error),
      });

      return {
        jsonrpc: "2.0",
        error: {
          code: JSON_RPC_ERRORS.SERVER_ERROR,
          message: error instanceof Error ? error.message : "Request failed",
          data: {
            serverName: this.config.name,
            method: request.method,
          },
        },
        id: request.id ?? null,
      };
    }
  }

  /**
   * Send request in isolated mode (one process per session)
   */
  private async sendIsolated(
    sessionId: string | undefined,
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    // For initialize: session ID should be provided by proxy layer
    // Proxy generates session ID for initialize requests without one
    // For other methods: require sessionId
    if (!sessionId) {
      return {
        jsonrpc: "2.0",
        error: {
          code: JSON_RPC_ERRORS.INVALID_REQUEST,
          message: "Mcp-Session-Id header required for isolated mode requests",
        },
        id: request.id ?? null,
      };
    }

    // Get or create session process
    let sessionProcess = this.isolatedSessions.get(sessionId);

    if (!sessionProcess) {
      // Only create new session for initialize method
      // Non-initialize methods on missing sessions indicate session was terminated
      if (request.method !== "initialize") {
        return {
          jsonrpc: "2.0",
          error: {
            code: JSON_RPC_ERRORS.SESSION_NOT_FOUND,
            message:
              "Session not found. It may have been evicted due to session limit (max 100), terminated due to server restart, or removed due to config change. Please initialize a new session.",
            data: {
              serverName: this.config.name,
              sessionId,
              maxSessions: this.maxIsolatedSessions,
            },
          },
          id: request.id ?? null,
        };
      }

      // Check if we need to evict LRU session before creating new one
      if (this.isolatedSessions.size >= this.maxIsolatedSessions) {
        this.evictLeastRecentlyUsedSession();
      }

      // Create new session for initialize
      logger.info("Creating new isolated session", {
        server: this.config.name,
        sessionId,
      });

      sessionProcess = this.createIsolatedSession(sessionId);
      this.isolatedSessions.set(sessionId, sessionProcess);
      this.activeSessions.add(sessionId);
      this.sessionLastActivity.set(sessionId, Date.now());
    }

    // Check if crashed
    if (!sessionProcess.isRunning) {
      return {
        jsonrpc: "2.0",
        error: {
          code: JSON_RPC_ERRORS.SESSION_CRASHED,
          message: "Session crashed. Start a new session with a different ID.",
          data: {
            serverName: this.config.name,
            sessionId,
          },
        },
        id: request.id ?? null,
      };
    }

    logger.debug("Sending request to isolated session", {
      server: this.config.name,
      sessionId,
      method: request.method,
      id: request.id,
    });

    // Update last activity timestamp
    this.sessionLastActivity.set(sessionId, Date.now());

    try {
      const response = await sessionProcess.send(request);

      logger.debug("Received response from isolated session", {
        server: this.config.name,
        sessionId,
        id: request.id,
      });

      return response;
    } catch (error) {
      logger.error("Request to isolated session failed", {
        server: this.config.name,
        sessionId,
        method: request.method,
        error: getErrorMessage(error),
      });

      return {
        jsonrpc: "2.0",
        error: {
          code: JSON_RPC_ERRORS.SERVER_ERROR,
          message: error instanceof Error ? error.message : "Request failed",
          data: {
            serverName: this.config.name,
            sessionId,
            method: request.method,
          },
        },
        id: request.id ?? null,
      };
    }
  }

  /**
   * Evict least recently used session to make room for new one
   */
  private evictLeastRecentlyUsedSession(): void {
    let oldestSessionId: string | null = null;
    let oldestTime = Number.POSITIVE_INFINITY;

    // Find session with oldest last activity time
    for (const [sessionId, lastActivity] of this.sessionLastActivity) {
      if (lastActivity < oldestTime) {
        oldestTime = lastActivity;
        oldestSessionId = sessionId;
      }
    }

    if (oldestSessionId) {
      logger.warn("Evicting least recently used session due to limit", {
        server: this.config.name,
        sessionId: oldestSessionId,
        maxSessions: this.maxIsolatedSessions,
        lastActivity: new Date(oldestTime).toISOString(),
      });

      // Terminate and remove session
      const process = this.isolatedSessions.get(oldestSessionId);
      if (process) {
        process.terminate();
      }
      this.isolatedSessions.delete(oldestSessionId);
      this.activeSessions.delete(oldestSessionId);
      this.sessionLastActivity.delete(oldestSessionId);
    }
  }

  /**
   * Create an isolated session process
   */
  private createIsolatedSession(sessionId: string): StdioProcess {
    return new StdioProcess({
      config: this.config,
      requestTimeout: this.config.timeout,
      onProcessExit: (code, signal) => {
        logger.error("Isolated session crashed", {
          server: this.config.name,
          sessionId,
          code,
          signal,
        });
        // Don't auto-restart, just mark as crashed
        // Process stays in map but isRunning will be false
      },
      onStderr: (data) => {
        logger.debug("Stderr from isolated session", {
          server: this.config.name,
          sessionId,
          data: data.trim(),
        });
      },
    });
  }

  /**
   * Get process state (shared mode) or aggregate state (isolated mode)
   */
  getProcessState(): StdioProcessState {
    if (this.sessionMode === "shared") {
      // Update PID if process is running
      if (this.sharedProcess?.isRunning && this.sharedProcess.pid) {
        this.sharedProcessState.status = "running";
        this.sharedProcessState.pid = this.sharedProcess.pid;
        this.sharedProcessState.lastError = null;
      }
      return this.sharedProcessState;
    } else {
      // For isolated mode, return session-based state (not process-based)
      return {
        status: "isolated",
        sessionCount: this.isolatedSessions.size,
        pid: null,
        lastError: null,
        stderrLogs: [],
      };
    }
  }

  /**
   * Get active session count
   */
  getSessionCount(): number {
    if (this.sessionMode === "shared") {
      return this.activeSessions.size;
    } else {
      return this.isolatedSessions.size;
    }
  }

  /**
   * Get active session IDs
   */
  getSessionIds(): string[] {
    if (this.sessionMode === "shared") {
      return Array.from(this.activeSessions);
    } else {
      return Array.from(this.isolatedSessions.keys());
    }
  }

  /**
   * Stop the subprocess (alias for terminate)
   */
  async stop(): Promise<void> {
    return this.terminate();
  }

  /**
   * Manually restart the subprocess (for recovery after crash)
   * Only works in shared mode
   */
  async restart(): Promise<void> {
    if (this.sessionMode !== "shared") {
      throw new RestartNotSupportedError(
        "Restart not supported in isolated mode - terminate individual sessions instead",
      );
    }

    logger.info("Manually restarting stdio server (shared mode)", {
      server: this.config.name,
      previousState: this.sharedProcessState.status,
    });

    // Terminate if running
    if (this.sharedProcess) {
      await this.sharedProcess.terminate();
    }

    // Clear state
    this.sharedProcessState = {
      status: "stopped",
      pid: null,
      lastError: null,
      stderrLogs: this.stderrBuffer.getLines(),
    };

    // Re-initialize
    await this.initialize();

    logger.info("Manual restart complete", {
      server: this.config.name,
      newState: this.sharedProcessState.status,
      pid: this.sharedProcessState.pid,
    });
  }

  /**
   * Terminate the subprocess(es)
   */
  async terminate(): Promise<void> {
    logger.info("Terminating stdio session manager", {
      server: this.config.name,
      mode: this.sessionMode,
      activeSessions: this.getSessionCount(),
    });

    if (this.sessionMode === "shared") {
      if (this.sharedProcess) {
        await this.sharedProcess.terminate();
      }

      this.sharedProcessState = {
        status: "stopped",
        pid: null,
        lastError: null,
        stderrLogs: this.stderrBuffer.getLines(),
      };
    } else {
      // Terminate all isolated sessions
      for (const [sessionId, process] of this.isolatedSessions) {
        logger.debug("Terminating isolated session", {
          server: this.config.name,
          sessionId,
        });
        await process.terminate();
      }
      this.isolatedSessions.clear();
    }

    this.activeSessions.clear();
  }

  /**
   * Force kill the subprocess(es)
   */
  kill(): void {
    logger.warn("Force killing stdio process(es)", {
      server: this.config.name,
      mode: this.sessionMode,
    });

    if (this.sessionMode === "shared") {
      if (this.sharedProcess) {
        this.sharedProcess.kill();
      }

      this.sharedProcessState = {
        status: "stopped",
        pid: null,
        lastError: {
          message: "Process was force killed",
          code: "SIGKILL",
          timestamp: Date.now(),
        },
        stderrLogs: this.stderrBuffer.getLines(),
      };
    } else {
      for (const process of this.isolatedSessions.values()) {
        process.kill();
      }
      this.isolatedSessions.clear();
    }

    this.activeSessions.clear();
  }

  /**
   * Check if process/session is healthy
   */
  isHealthy(): boolean {
    if (this.sessionMode === "shared") {
      return this.sharedProcess?.isRunning ?? false;
    } else {
      return Array.from(this.isolatedSessions.values()).some(
        (p) => p.isRunning,
      );
    }
  }
}
