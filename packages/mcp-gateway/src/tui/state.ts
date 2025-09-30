import type { Registry } from "../registry.js";
import type { JsonRpcRequest, JsonRpcResponse } from "../schemas.js";

// Context holds configuration and dependencies (read-only)
export type Context = {
  storageDir: string;
  onExit?: () => void;
};

// UI mode
export type UiMode = "menu" | "modal";

// Modal content types
export type ModalContent =
  | "mcp_instructions"
  | "add_server_form"
  | "delete_server_form";

// Form field definition
export type FormField = {
  name: string;
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
};

// Form state for modal forms
export type FormState = {
  fields: FormField[];
  focusedFieldIndex: number;
};

// Delete server selection state
export type DeleteServerState = {
  selectedIndex: number;
  showConfirm: boolean;
};

// Log entry for request/response logging
export type LogEntry = {
  timestamp: string;
  serverName: string;
  sessionId: string;
  method: string;
  httpStatus: number;
  duration: number;
  direction: "request" | "response";
  errorMessage?: string;
  request?: JsonRpcRequest;
  response?: JsonRpcResponse;
};

// State represents the current UI state
export type State = {
  registry: Registry;
  running: boolean;
  mode: UiMode;
  logs: LogEntry[];
  modalContent?: ModalContent;
  formState?: FormState;
  deleteServerState?: DeleteServerState;
};
