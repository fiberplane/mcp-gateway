import { create } from "zustand";
import type { Registry } from "../registry";
import { saveRegistry } from "../storage";
import type { LogEntry } from "../tui/state";

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

interface AppStore {
  // State
  registry: Registry;
  logs: LogEntry[];
  storageDir: string;
  port: number;
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
  initialize: (registry: Registry, storageDir: string, port: number) => void;
  addServer: (name: string, url: string) => Promise<void>;
  removeServer: (name: string) => Promise<void>;
  setRegistry: (registry: Registry) => void;
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

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  registry: { servers: [] },
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

  // Actions
  initialize: (registry, storageDir, port) =>
    set({ registry, storageDir, port }),

  addServer: async (name, url) => {
    const { registry, storageDir } = get();

    // Normalize inputs
    const normalizedUrl = new URL(url).toString().replace(/\/$/, "");
    const normalizedName = name.toLowerCase().trim();

    // Check if server already exists
    if (registry.servers.some((s) => s.name === normalizedName)) {
      throw new Error(`Server '${name}' already exists`);
    }

    // Add server
    const newServer = {
      name: normalizedName,
      url: normalizedUrl,
      type: "http" as const,
      headers: {},
      lastActivity: null,
      exchangeCount: 0,
      health: "unknown" as const,
    };

    // Mutate the registry.servers array directly so the HTTP server sees the change
    registry.servers.push(newServer);

    // Save to disk
    await saveRegistry(storageDir, registry);

    // Trigger re-render by creating a new state object
    set({ registry: { ...registry } });

    // Trigger immediate health check for the new server
    // Import dynamically to avoid circular dependencies
    const { checkServerHealth } = await import("../health.js");
    const health = await checkServerHealth(normalizedUrl);
    const lastHealthCheck = new Date().toISOString();

    // Update the server with health status (mutate in place)
    const server = registry.servers.find((s) => s.name === normalizedName);
    if (server) {
      server.health = health;
      server.lastHealthCheck = lastHealthCheck;
      // Trigger re-render
      set({ registry: { ...registry } });
    }
  },

  removeServer: async (name) => {
    const { registry, storageDir } = get();

    // Mutate the registry.servers array directly so the HTTP server sees the change
    const index = registry.servers.findIndex((s) => s.name === name);
    if (index !== -1) {
      registry.servers.splice(index, 1);
    }

    await saveRegistry(storageDir, registry);
    // Trigger re-render
    set({ registry: { ...registry } });
  },

  setRegistry: (registry) => set({ registry }),
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
