import type { Registry } from "../registry.js";
import type { Effect } from "./effects.js";
import { performEffect } from "./effects.js";
import type { Action } from "./events.js";
import { dispatch, tuiEvents } from "./events.js";
import type { Context, State } from "./state.js";
import { view } from "./view.js";

// Pure function: State + Action → New State + Effect
function update(state: State, action: Action): [State, Effect] {
  switch (action.type) {
    case "key_pressed":
      // If in modal mode (but not form), any key closes the modal
      if (state.mode === "modal" && state.modalContent === "mcp_instructions") {
        return [
          { ...state, mode: "menu", modalContent: undefined },
          { type: "none" },
        ];
      }

      switch (action.key) {
        case "a":
          return [state, { type: "add_server" }];
        case "d":
          return [state, { type: "delete_server" }];
        case "c":
          return [{ ...state, logs: [] }, { type: "none" }];
        case "m":
          return [
            { ...state, mode: "modal", modalContent: "mcp_instructions" },
            { type: "none" },
          ];
        case "q":
          return [{ ...state, running: false }, { type: "none" }];
        default:
          return [state, { type: "none" }];
      }

    case "registry_updated":
      // Registry mutated externally by server, just trigger re-render
      return [state, { type: "none" }];

    case "log_added": {
      // Add new log entry (no limit, user can clear with 'c')
      const newLogs = [...state.logs, action.entry];
      return [{ ...state, logs: newLogs }, { type: "none" }];
    }

    case "form_input": {
      if (!state.formState) return [state, { type: "none" }];

      const fields = [...state.formState.fields];
      const field = fields[state.formState.focusedFieldIndex];
      if (!field) return [state, { type: "none" }];

      field.value += action.char;
      field.error = validateField(field);

      return [
        { ...state, formState: { ...state.formState, fields } },
        { type: "none" },
      ];
    }

    case "form_backspace": {
      if (!state.formState) return [state, { type: "none" }];

      const fields = [...state.formState.fields];
      const field = fields[state.formState.focusedFieldIndex];
      if (!field || !field.value) return [state, { type: "none" }];

      field.value = field.value.slice(0, -1);
      field.error = validateField(field);

      return [
        { ...state, formState: { ...state.formState, fields } },
        { type: "none" },
      ];
    }

    case "form_next_field": {
      if (!state.formState) return [state, { type: "none" }];

      const nextIndex =
        (state.formState.focusedFieldIndex + 1) % state.formState.fields.length;
      return [
        {
          ...state,
          formState: { ...state.formState, focusedFieldIndex: nextIndex },
        },
        { type: "none" },
      ];
    }

    case "form_prev_field": {
      if (!state.formState) return [state, { type: "none" }];

      const prevIndex =
        state.formState.focusedFieldIndex === 0
          ? state.formState.fields.length - 1
          : state.formState.focusedFieldIndex - 1;
      return [
        {
          ...state,
          formState: { ...state.formState, focusedFieldIndex: prevIndex },
        },
        { type: "none" },
      ];
    }

    case "form_submit": {
      if (!state.formState) return [state, { type: "none" }];

      // Validate all fields
      const fields = state.formState.fields.map((f) => ({
        ...f,
        error: validateField(f),
      }));

      const hasErrors = fields.some((f) => f.error);
      if (hasErrors) {
        return [
          { ...state, formState: { ...state.formState, fields } },
          { type: "none" },
        ];
      }

      // Extract values
      const url = fields.find((f) => f.name === "url")?.value;
      const name = fields.find((f) => f.name === "name")?.value;

      if (!url || !name) return [state, { type: "none" }];

      return [state, { type: "save_server", name, url }];
    }

    case "delete_server_next": {
      if (!state.deleteServerState || state.deleteServerState.showConfirm) {
        return [state, { type: "none" }];
      }

      const nextIndex =
        (state.deleteServerState.selectedIndex + 1) %
        state.registry.servers.length;
      return [
        {
          ...state,
          deleteServerState: {
            ...state.deleteServerState,
            selectedIndex: nextIndex,
          },
        },
        { type: "none" },
      ];
    }

    case "delete_server_prev": {
      if (!state.deleteServerState || state.deleteServerState.showConfirm) {
        return [state, { type: "none" }];
      }

      const prevIndex =
        state.deleteServerState.selectedIndex === 0
          ? state.registry.servers.length - 1
          : state.deleteServerState.selectedIndex - 1;
      return [
        {
          ...state,
          deleteServerState: {
            ...state.deleteServerState,
            selectedIndex: prevIndex,
          },
        },
        { type: "none" },
      ];
    }

    case "delete_server_confirm": {
      if (!state.deleteServerState) return [state, { type: "none" }];

      if (!state.deleteServerState.showConfirm) {
        // First Enter: show confirmation
        return [
          {
            ...state,
            deleteServerState: {
              ...state.deleteServerState,
              showConfirm: true,
            },
          },
          { type: "none" },
        ];
      }

      // Second Enter: actually delete
      const server =
        state.registry.servers[state.deleteServerState.selectedIndex];
      if (!server) return [state, { type: "none" }];

      return [state, { type: "remove_server", serverName: server.name }];
    }

    case "modal_close": {
      return [
        {
          ...state,
          mode: "menu",
          modalContent: undefined,
          formState: undefined,
          deleteServerState: undefined,
        },
        { type: "none" },
      ];
    }

    case "quit":
      return [{ ...state, running: false }, { type: "none" }];
  }
}

// Validate a form field
function validateField(field: {
  name: string;
  value: string;
  label: string;
}): string | undefined {
  if (!field.value.trim()) {
    return `${field.label} cannot be empty`;
  }

  if (field.name === "url") {
    try {
      const url = new URL(field.value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "URL must be HTTP or HTTPS";
      }
    } catch {
      return "Invalid URL format";
    }
  }

  return undefined;
}

// Handle raw stdin data and convert to key actions
function handleStdinData(state: State, data: string): void {
  const char = data.charCodeAt(0);

  // Ctrl+C
  if (char === 3) {
    dispatch({ type: "quit" });
    return;
  }

  // ESC key (closes modal) - but only if it's a standalone ESC, not an escape sequence
  if (char === 27 && data.length === 1) {
    if (state.mode === "modal") {
      dispatch({ type: "modal_close" });
    }
    return;
  }

  // Handle form inputs
  if (state.mode === "modal" && state.formState) {
    // Tab - next field
    if (char === 9) {
      dispatch({ type: "form_next_field" });
      return;
    }

    // Enter - submit form
    if (char === 13 || char === 10) {
      dispatch({ type: "form_submit" });
      return;
    }

    // Backspace
    if (char === 127 || char === 8) {
      dispatch({ type: "form_backspace" });
      return;
    }

    // Regular printable characters
    if (char >= 32 && char <= 126) {
      dispatch({ type: "form_input", char: data });
      return;
    }

    return;
  }

  // Handle delete server navigation
  if (state.mode === "modal" && state.deleteServerState) {
    // Arrow up
    if (data === "\x1b[A") {
      dispatch({ type: "delete_server_prev" });
      return;
    }

    // Arrow down
    if (data === "\x1b[B") {
      dispatch({ type: "delete_server_next" });
      return;
    }

    // Enter - confirm/select
    if (char === 13 || char === 10) {
      dispatch({ type: "delete_server_confirm" });
      return;
    }

    return;
  }

  // Ignore non-printable characters and Enter in menu mode
  if (char === 13 || char === 10 || char < 32 || char > 126) {
    return;
  }

  // Dispatch key press for menu mode
  dispatch({ type: "key_pressed", key: data.toLowerCase() });
}

// Main TUI loop
export async function runTUI(
  context: Context,
  registry: Registry,
): Promise<void> {
  // Guard against non-TTY environments
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error(
      "TUI requires a TTY environment. Run in headless mode or attach a terminal.",
    );
  }

  let state: State = { registry, running: true, mode: "menu", logs: [] };

  // Set up stdin as event source (non-blocking)
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  // Stdin event handler - closure captures state by reference, but we reassign state
  // So we need a getter function to always get current state
  const getState = () => state;

  const stdinHandler = (data: string) => {
    handleStdinData(getState(), data);
  };

  process.stdin.on("data", stdinHandler);

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    dispatch({ type: "quit" });
  });

  // Event processing loop (non-blocking, event-driven)
  const actionQueue: Action[] = [];
  let isProcessing = false;

  const processActions = async () => {
    if (isProcessing) return;
    isProcessing = true;

    while (actionQueue.length > 0) {
      const action = actionQueue.shift();
      if (!action) continue;

      // Update state
      const [newState, effect] = update(state, action);
      state = newState;

      // Render before effect
      view(state);

      // Perform side effect
      await performEffect(effect, state, context);

      // Render after effect (in case effect changed mode back to menu)
      view(state);

      if (!state.running) break;
    }

    isProcessing = false;

    // Exit if we're done
    if (!state.running) {
      process.stdin.removeListener("data", stdinHandler);
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      console.log("\nClosing the MCP Gateway...");
      context.onExit?.();
      process.exit(0);
    }
  };

  // Listen to action events
  tuiEvents.on("action", (action: Action) => {
    actionQueue.push(action);
    processActions();
  });

  // Initial render
  view(state);
}
