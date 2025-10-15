import type { ViewMode } from "./store";

/**
 * Shortcut key definition
 */
export interface Shortcut {
  /** The key name (from useKeyboard) */
  key: string;
  /** Display label for the key */
  label: string;
  /** Description of what the shortcut does */
  description: string;
  /** Which contexts this shortcut is active in */
  context?: "global" | ViewMode | "modal";
}

/**
 * Command definition that can be triggered by a shortcut
 */
export interface Command {
  /** Unique command ID */
  id: string;
  /** Display label */
  label: string;
  /** Optional status info to show */
  statusInfo?: string;
  /** Keyboard shortcut */
  shortcut: string;
  /** Action to execute */
  action: () => void;
  /** Whether the command is disabled */
  disabled?: boolean;
}

/**
 * Global shortcuts registry
 * These work everywhere in the app
 */
export const globalShortcuts = {
  commandMenu: {
    key: "/",
    label: "/",
    description: "Open command menu",
    context: "global" as const,
  },
  quit: {
    key: "q",
    label: "q",
    description: "Quit application",
    context: "global" as const,
  },
  escape: {
    key: "escape",
    label: "ESC",
    description: "Go back / Close modal",
    context: "global" as const,
  },
} as const;

/**
 * Command shortcuts
 * These are the shortcuts shown in the command menu
 */
export const commandShortcuts = {
  serverManagement: {
    key: "m",
    label: "m",
    description: "Manage Servers",
  },
  activityLog: {
    key: "v",
    label: "v",
    description: "View Logs",
  },
  addServer: {
    key: "a",
    label: "a",
    description: "Add New Server",
  },
  clearLogs: {
    key: "c",
    label: "c",
    description: "Clear Logs",
  },
  help: {
    key: "h",
    label: "h",
    description: "Help",
  },
} as const;

/**
 * Get shortcut label for display (e.g., "[m]")
 */
export function formatShortcut(key: string): string {
  return `[${key}]`;
}
