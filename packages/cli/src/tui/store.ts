import {
  loadRegistry,
  logger,
  saveRegistry,
} from "@fiberplane/mcp-gateway-core";
import type { ClientManager } from "@fiberplane/mcp-gateway-core";
import type {
  LogEntry,
  PromotedTool,
  Registry,
  ServerHealth,
} from "@fiberplane/mcp-gateway-types";
import { create } from "zustand";
import { emitRegistryUpdate } from "../events";

type ModalType =
  | "add-server"
  | "delete-server"
  | "server-details"
  | "mcp-instructions"
  | "activity-log-detail"
  | null;

export type ViewMode = "activity-log" | "server-management" | "optimization";

export interface Toast {
  message: string;
  type: "success" | "error" | "info";
}

/**
 * UI-specific server representation
 * Contains only what the UI needs to display
 */
export interface UIServer {
  name: string;
  url: string;
  type: "http";
  headers: Record<string, string>;
  health: ServerHealth;
  lastHealthCheck?: string;
  authUrl?: string;
  authError?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
}

/**
 * Optimization data for a single tool
 */
export interface ToolOptimization {
  toolName: string;
  promoted: PromotedTool | null;
  candidateCount: number;
  promptCount: number;
  lastOptimized?: string;
}

/**
 * Optimization data for an entire server
 */
export interface ServerOptimization {
  serverName: string;
  toolCount: number;
  optimizedCount: number;
  tools: Map<string, ToolOptimization>;
}

/**
 * Live progress tracking for optimization runs
 */
export interface OptimizationProgress {
  serverName: string;
  phase: "generating" | "evaluating" | "promoting" | "complete";
  currentTool: string;
  totalTools: number;
  completedTools: number;
  currentProgress: number; // 0-100 for current tool
}

interface AppStore {
  // State
  servers: UIServer[];
  registry: Registry | null; // Actual registry object shared with HTTP server
  logs: LogEntry[];
  storageDir: string;
  port: number;
  clientManager?: ClientManager; // MCP client manager (only present when --enable-mcp-client is used)
  activeModal: ModalType;
  viewMode: ViewMode;
  showCommandMenu: boolean;
  serverToDelete: string | null;
  selectedLog: LogEntry | null;
  toast: Toast | null;

  // Activity Log view state
  activityLogSelectedIndex: number;
  activityLogScrollPosition: number;
  activityLogFollowMode: boolean;

  // Server Management view state
  serverManagementSelectedIndex: number;
  serverManagementShowConfig: string | null;

  // Optimization state
  optimizations: Map<string, ServerOptimization>;
  optimizationProgress: OptimizationProgress | null;

  // Actions
  initialize: (servers: UIServer[], registry: Registry, storageDir: string, port: number) => void;
  addServer: (name: string, url: string) => Promise<void>;
  removeServer: (name: string) => Promise<void>;
  setServers: (servers: UIServer[]) => void;
  updateServerHealth: (
    name: string,
    health: ServerHealth,
    lastHealthCheck: string,
  ) => void;
  addLog: (entry: LogEntry) => void;
  clearLogs: () => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  setViewMode: (mode: ViewMode) => void;
  openCommandMenu: () => void;
  closeCommandMenu: () => void;
  setServerToDelete: (serverName: string | null) => void;
  setSelectedLog: (log: LogEntry | null) => void;
  showToast: (message: string, type: Toast["type"]) => void;
  clearToast: () => void;

  // Activity Log view actions
  setActivityLogSelectedIndex: (
    index: number | ((prev: number) => number),
  ) => void;
  setActivityLogScrollPosition: (position: number) => void;
  setActivityLogFollowMode: (enabled: boolean) => void;

  // Server Management view actions
  setServerManagementSelectedIndex: (
    index: number | ((prev: number) => number),
  ) => void;
  setServerManagementShowConfig: (serverName: string | null) => void;

  // Optimization actions
  loadOptimizations: () => Promise<void>;
  setOptimizationProgress: (progress: OptimizationProgress | null) => void;
}

/**
 * Helper: Transform Registry server to UIServer
 */
export function toUIServer(server: Registry["servers"][number]): UIServer {
  return {
    name: server.name,
    url: server.url,
    type: server.type,
    headers: server.headers,
    health: server.health ?? "unknown",
    lastHealthCheck: server.lastHealthCheck,
    authUrl: server.authUrl,
    authError: server.authError,
    oauthClientId: server.oauthClientId,
    oauthClientSecret: server.oauthClientSecret,
  };
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  servers: [],
  registry: null,
  logs: [],
  storageDir: "",
  port: 3333,
  activeModal: null,
  viewMode: "activity-log",
  showCommandMenu: false,
  serverToDelete: null,
  selectedLog: null,
  toast: null,

  // Activity Log view state
  activityLogSelectedIndex: 0,
  activityLogScrollPosition: 0,
  activityLogFollowMode: true,

  // Server Management view state
  serverManagementSelectedIndex: 0,
  serverManagementShowConfig: null,

  // Optimization state
  optimizations: new Map(),
  optimizationProgress: null,

  // Actions
  initialize: (servers, registry, storageDir, port) => set({ servers, registry, storageDir, port }),

  addServer: async (name, url) => {
    const { storageDir, servers } = get();

    // Normalize inputs
    const normalizedUrl = new URL(url).toString().replace(/\/$/, "");
    const normalizedName = name.toLowerCase().trim();

    // Check if server already exists
    if (servers.some((s) => s.name === normalizedName)) {
      throw new Error(`Server '${name}' already exists`);
    }

    // Load current registry from disk
    const registry = await loadRegistry(storageDir);

    // Add server to registry
    const newServer = {
      name: normalizedName,
      url: normalizedUrl,
      type: "http" as const,
      headers: {},
      lastActivity: null,
      exchangeCount: 0,
    };
    registry.servers.push(newServer);

    // Save to disk
    await saveRegistry(storageDir, registry);

    // Emit event so HTTP server updates
    emitRegistryUpdate();

    // Add to UI state
    const uiServer: UIServer = {
      name: normalizedName,
      url: normalizedUrl,
      type: "http",
      headers: {},
      health: "unknown",
    };
    set({ servers: [...servers, uiServer] });

    // Trigger immediate health check for the new server
    const { checkServerHealth } = await import("@fiberplane/mcp-gateway-core");
    const health = await checkServerHealth(normalizedUrl);
    const lastHealthCheck = new Date().toISOString();

    // Update UI with health status
    set((state) => ({
      servers: state.servers.map((s) =>
        s.name === normalizedName ? { ...s, health, lastHealthCheck } : s,
      ),
    }));
  },

  removeServer: async (name) => {
    const { storageDir, servers } = get();

    // Load current registry from disk
    const registry = await loadRegistry(storageDir);

    // Remove server from registry
    const index = registry.servers.findIndex((s) => s.name === name);
    if (index !== -1) {
      registry.servers.splice(index, 1);
    }

    // Save to disk
    await saveRegistry(storageDir, registry);

    // Emit event so HTTP server updates
    emitRegistryUpdate();

    // Remove from UI state
    set({ servers: servers.filter((s) => s.name !== name) });
  },

  setServers: (servers) => set({ servers }),
  updateServerHealth: (name, health, lastHealthCheck) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.name === name ? { ...s, health, lastHealthCheck } : s,
      ),
    })),
  addLog: (entry) => set((state) => ({ logs: [...state.logs, entry] })),
  clearLogs: () => set({ logs: [] }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () =>
    set({ activeModal: null, serverToDelete: null, selectedLog: null }),
  setViewMode: (mode) => set({ viewMode: mode }),
  openCommandMenu: () => set({ showCommandMenu: true }),
  closeCommandMenu: () => set({ showCommandMenu: false }),
  setServerToDelete: (serverName) => set({ serverToDelete: serverName }),
  setSelectedLog: (log) => set({ selectedLog: log }),
  showToast: (message, type) => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),

  // Activity Log view actions
  setActivityLogSelectedIndex: (index) =>
    set((state) => ({
      activityLogSelectedIndex:
        typeof index === "function"
          ? index(state.activityLogSelectedIndex)
          : index,
    })),
  setActivityLogScrollPosition: (position) =>
    set({ activityLogScrollPosition: position }),
  setActivityLogFollowMode: (enabled) =>
    set({ activityLogFollowMode: enabled }),

  // Server Management view actions
  setServerManagementSelectedIndex: (index) =>
    set((state) => ({
      serverManagementSelectedIndex:
        typeof index === "function"
          ? index(state.serverManagementSelectedIndex)
          : index,
    })),
  setServerManagementShowConfig: (serverName) =>
    set({ serverManagementShowConfig: serverName }),

  // Optimization actions
  loadOptimizations: async () => {
    const { port, servers } = get();

    if (servers.length === 0) {
      set({ optimizations: new Map() });
      return;
    }

    try {
      const { callGatewayTool } = await import("./utils/gateway-mcp-client");

      // Get optimization report for all servers
      const report = await callGatewayTool(port, "get_optimization_report", {});

      // Parse the report and build optimization map
      const optimizations = new Map<string, ServerOptimization>();

      if (Array.isArray(report)) {
        for (const serverReport of report as Array<{
          serverName: string;
          toolCount: number;
          optimizedCount: number;
          tools: Array<{
            name: string;
            status: "optimized" | "baseline" | "unoptimized";
            metrics?: {
              directSuccess: number;
              indirectSuccess: number;
              negativeSuccess: number;
              overall: number;
            };
          }>;
        }>) {
          const toolsMap = new Map<string, ToolOptimization>();

          for (const tool of serverReport.tools) {
            toolsMap.set(tool.name, {
              toolName: tool.name,
              promoted: tool.status === "optimized" && tool.metrics
                ? {
                    toolName: tool.name,
                    candidateId: "unknown", // We don't have this from the report
                    promotedAt: new Date().toISOString(),
                    description: "", // We don't have this from the report
                    metrics: tool.metrics,
                  }
                : null,
              candidateCount: 0, // We don't track this in the report
              promptCount: 0, // We don't track this in the report
            });
          }

          optimizations.set(serverReport.serverName, {
            serverName: serverReport.serverName,
            toolCount: serverReport.toolCount,
            optimizedCount: serverReport.optimizedCount,
            tools: toolsMap,
          });
        }
      }

      set({ optimizations });
    } catch (error) {
      logger.error("Failed to load optimizations", { error });
      // Set empty map on error
      set({ optimizations: new Map() });
    }
  },

  setOptimizationProgress: (progress) =>
    set({ optimizationProgress: progress }),
}));
