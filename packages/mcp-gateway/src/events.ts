import { EventEmitter } from "node:events";
import type { LogEntry } from "./types.js";

// Central event bus for TUI events
export const tuiEvents = new EventEmitter();

// Action types (following Phoenix conventions)
export type Action =
  | { type: "key_pressed"; key: string }
  | { type: "registry_updated" }
  | { type: "log_added"; entry: LogEntry }
  | { type: "form_input"; char: string }
  | { type: "form_backspace" }
  | { type: "form_next_field" }
  | { type: "form_prev_field" }
  | { type: "form_submit" }
  | { type: "delete_server_next" }
  | { type: "delete_server_prev" }
  | { type: "delete_server_confirm" }
  | { type: "modal_close" }
  | { type: "quit" };

// Dispatch helper - emits action to the event bus
export function dispatch(action: Action): void {
  tuiEvents.emit("action", action);
}

// External events → Actions
export function emitRegistryUpdate(): void {
  dispatch({ type: "registry_updated" });
}

export function emitLog(entry: LogEntry): void {
  dispatch({ type: "log_added", entry });
}
