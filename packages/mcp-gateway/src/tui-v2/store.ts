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
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  registry: { servers: [] },
  logs: [],
  storageDir: "",
  activeModal: null,
  viewMode: "activity-log",
  showCommandMenu: false,

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
    };

    const updatedRegistry = {
      ...registry,
      servers: [...registry.servers, newServer],
    };

    // Save to disk
    await saveRegistry(storageDir, updatedRegistry);

    // Update state
    set({ registry: updatedRegistry });
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
  closeModal: () => set({ activeModal: null }),
  setViewMode: (mode) => set({ viewMode: mode }),
  openCommandMenu: () => set({ showCommandMenu: true }),
  closeCommandMenu: () => set({ showCommandMenu: false }),
}));
