import { create } from "zustand";
import { saveRegistry } from "../storage";
import type { Registry } from "../registry";
import type { LogEntry } from "../tui/state";

interface AppStore {
  // State
  registry: Registry;
  logs: LogEntry[];
  storageDir: string;

  // Actions
  initialize: (registry: Registry, storageDir: string) => void;
  addServer: (name: string, url: string) => Promise<void>;
  removeServer: (name: string) => Promise<void>;
  setRegistry: (registry: Registry) => void;
  addLog: (entry: LogEntry) => void;
  clearLogs: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  registry: { servers: [] },
  logs: [],
  storageDir: "",

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
}));
