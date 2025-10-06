import { create } from "zustand";
import type { Registry } from "../registry";
import type { LogEntry } from "../tui/state";

interface AppStore {
  // State
  registry: Registry;
  logs: LogEntry[];
  storageDir: string;

  // Actions (minimal for now)
  initialize: (registry: Registry, storageDir: string) => void;
  setRegistry: (registry: Registry) => void;
  addLog: (entry: LogEntry) => void;
  clearLogs: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  // Initial state
  registry: { servers: [] },
  logs: [],
  storageDir: "",

  // Actions
  initialize: (registry, storageDir) => set({ registry, storageDir }),
  setRegistry: (registry) => set({ registry }),
  addLog: (entry) => set((state) => ({ logs: [...state.logs, entry] })),
  clearLogs: () => set({ logs: [] }),
}));
