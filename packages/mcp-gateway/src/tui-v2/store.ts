import { create } from 'zustand';
import type { Registry } from '../registry';
import type { LogEntry } from '../tui/state';

interface AppStore {
  // State
  registry: Registry;
  logs: LogEntry[];

  // Actions (minimal for now)
  setRegistry: (registry: Registry) => void;
  addLog: (entry: LogEntry) => void;
  clearLogs: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  // Initial state
  registry: { servers: [] },
  logs: [],

  // Actions
  setRegistry: (registry) => set({ registry }),
  addLog: (entry) => set(state => ({ logs: [...state.logs, entry] })),
  clearLogs: () => set({ logs: [] }),
}));
