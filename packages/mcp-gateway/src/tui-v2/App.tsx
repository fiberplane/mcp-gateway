import { render, useKeyboard } from "@opentui/react";
import type { Registry } from "../registry";
import type { Context } from "../tui/state";
import { ActivityLog } from "./components/ActivityLog";
import { AddServerModal } from "./components/AddServerModal";
import { DeleteServerModal } from "./components/DeleteServerModal";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { McpInstructionsModal } from "./components/McpInstructionsModal";
import { ServerList } from "./components/ServerList";
import { debug } from "./debug";
import { useExternalEvents } from "./hooks/useExternalEvents";
import { useAppStore } from "./store";

let exitHandler: (() => Promise<void>) | undefined;

export function setExitHandler(handler: () => Promise<void>) {
  exitHandler = handler;
}

function App() {
  // Wire up external events (registry updates, logs)
  useExternalEvents();

  const activeModal = useAppStore((state) => state.activeModal);
  const clearLogs = useAppStore((state) => state.clearLogs);
  const openModal = useAppStore((state) => state.openModal);
  const closeModal = useAppStore((state) => state.closeModal);

  useKeyboard((key) => {
    debug("Key pressed:", key.name);

    // ESC closes any modal
    if (key.name === "escape" && activeModal) {
      debug("Closing modal");
      closeModal();
      return;
    }

    // Don't process other keys if a modal is open
    if (activeModal) {
      return;
    }

    if (key.name === "q") {
      debug("Exiting app");
      exitHandler?.();
    }

    if (key.name === "c") {
      debug("Clearing logs");
      clearLogs();
    }

    if (key.name === "a") {
      debug("Opening add server modal");
      openModal("add-server");
    }

    if (key.name === "d") {
      debug("Opening delete server modal");
      openModal("delete-server");
    }

    if (key.name === "m") {
      debug("Opening MCP instructions modal");
      openModal("mcp-instructions");
    }
  });

  return (
    <box style={{ flexDirection: "column", height: "100%", padding: 2 }}>
      <Header />

      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        <ServerList />
        <ActivityLog />
      </box>

      <Footer />

      {/* Render active modal */}
      {activeModal === "add-server" && <AddServerModal />}
      {activeModal === "delete-server" && <DeleteServerModal />}
      {activeModal === "mcp-instructions" && <McpInstructionsModal />}
    </box>
  );
}

export async function runOpenTUI(context: Context, registry: Registry) {
  debug("Initializing OpenTUI app", {
    serverCount: registry.servers.length,
    storageDir: context.storageDir,
  });

  // Initialize store
  const initialize = useAppStore.getState().initialize;
  initialize(registry, context.storageDir);

  // Setup async exit handler
  const handleExit = async () => {
    try {
      // Call onExit - supports both sync and async
      const result = context.onExit?.();
      // If it returns a promise, await it
      if (result && typeof result === "object" && "then" in result) {
        await result;
      }
      process.exit(0);
    } catch (error) {
      console.error("Cleanup error:", error);
      process.exit(1);
    }
  };

  // Register signal handlers
  process.on("SIGINT", handleExit);
  process.on("SIGTERM", handleExit);

  // Make handler available to keyboard handler
  setExitHandler(handleExit);

  // Render app
  render(<App />);
}
