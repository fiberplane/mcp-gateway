import { checkServerHealth, type Gateway } from "@fiberplane/mcp-gateway-core";
import type {
  HealthStatus,
  LogEntry,
  Registry,
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

export type ViewMode = "activity-log" | "server-management";

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
  health: HealthStatus;
  lastHealthCheck?: string;
}

interface AppStore {
  // State
  servers: UIServer[];
  logs: LogEntry[];
  storageDir: string;
  port: number;
  gateway: Gateway | null;
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

  // Actions
  initialize: (
    servers: UIServer[],
    storageDir: string,
    port: number,
    gateway: Gateway,
  ) => void;
  addServer: (name: string, url: string) => Promise<void>;
  removeServer: (name: string) => Promise<void>;
  setServers: (servers: UIServer[]) => void;
  updateServerHealth: (
    name: string,
    health: HealthStatus,
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
  };
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  servers: [],
  logs: [],
  storageDir: "",
  port: 3333,
  gateway: null,
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

  // Actions
  initialize: (servers, storageDir, port, gateway) =>
    set({ servers, storageDir, port, gateway }),

  addServer: async (name, url) => {
    const { gateway, servers } = get();

    if (!gateway) {
      throw new Error("Gateway not initialized");
    }

    // Normalize inputs
    const normalizedUrl = new URL(url).toString().replace(/\/$/, "");
    const normalizedName = name.toLowerCase().trim();

    // Check if server already exists
    if (servers.some((s) => s.name === normalizedName)) {
      throw new Error(`Server '${name}' already exists`);
    }

    // Perform health check BEFORE persisting (to ensure we have health status)
    const health = await checkServerHealth(normalizedUrl);
    const lastHealthCheck = new Date().toISOString();

    // Add server via storage API (which handles persistence)
    await gateway.storage.addServer({
      name: normalizedName,
      url: normalizedUrl,
      type: "http",
      headers: {},
    });

    // Create UI server with complete health info
    const uiServer: UIServer = {
      name: normalizedName,
      url: normalizedUrl,
      type: "http",
      headers: {},
      health,
      lastHealthCheck,
    };

    // Update UI state with complete data
    set({ servers: [...servers, uiServer] });

    // Emit event only after all UI updates are complete
    // This prevents race condition where registry reload overwrites health status
    emitRegistryUpdate();
  },

  removeServer: async (name) => {
    const { gateway, servers } = get();

    if (!gateway) {
      throw new Error("Gateway not initialized");
    }

    // Remove server via storage API (which handles persistence)
    await gateway.storage.removeServer(name);

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
}));
