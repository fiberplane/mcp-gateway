import { create } from "zustand";
import type { Registry } from "../registry";
import { saveRegistry } from "../storage";
import type { LogEntry } from "../tui/state";

type ModalType =
  | "add-server"
  | "delete-server"
  | "server-details"
  | "mcp-instructions"
  | null;

export type ViewMode = "activity-log" | "server-management";

interface AppStore {
  // State
  registry: Registry;
  logs: LogEntry[];
  storageDir: string;
  activeModal: ModalType;
  viewMode: ViewMode;
  showCommandMenu: boolean;
  serverToDelete: string | null;

  // Actions
  initialize: (registry: Registry, storageDir: string) => void;
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
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  registry: { servers: [] },
  logs: [],
  storageDir: "",
  activeModal: null,
  viewMode: "activity-log",
  showCommandMenu: false,
  serverToDelete: null,

  // Actions
  initialize: (registry, storageDir) => set({ registry, storageDir }),

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

    const updatedRegistry = {
      ...registry,
      servers: [...registry.servers, newServer],
    };

    // Save to disk
    await saveRegistry(storageDir, updatedRegistry);

    // Update state
    set({ registry: updatedRegistry });

    // Trigger immediate health check for the new server
    // Import dynamically to avoid circular dependencies
    const { checkServerHealth } = await import("../health.js");
    const health = await checkServerHealth(normalizedUrl);
    const lastHealthCheck = new Date().toISOString();

    // Update the server with health status
    const registryWithHealth = {
      ...updatedRegistry,
      servers: updatedRegistry.servers.map((s) =>
        s.name === normalizedName ? { ...s, health, lastHealthCheck } : s,
      ),
    };

    // Update state with health info
    set({ registry: registryWithHealth });
  },

  removeServer: async (name) => {
    const { registry, storageDir } = get();

    const updatedRegistry = {
      ...registry,
      servers: registry.servers.filter((s) => s.name !== name),
    };

    await saveRegistry(storageDir, updatedRegistry);
    set({ registry: updatedRegistry });
  },

  setRegistry: (registry) => set({ registry }),
  addLog: (entry) => set((state) => ({ logs: [...state.logs, entry] })),
  clearLogs: () => set({ logs: [] }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null, serverToDelete: null }),
  setViewMode: (mode) => set({ viewMode: mode }),
  openCommandMenu: () => set({ showCommandMenu: true }),
  closeCommandMenu: () => set({ showCommandMenu: false }),
  setServerToDelete: (serverName) => set({ serverToDelete: serverName }),
}));
