import { render, useKeyboard } from "@opentui/react";
import type { Registry } from "../registry";
import type { Context } from "../tui/state";
import { ActivityLog } from "./components/ActivityLog";
import { AddServerModal } from "./components/AddServerModal";
import { CommandMenu } from "./components/CommandMenu";
import { DeleteServerModal } from "./components/DeleteServerModal";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { McpInstructionsModal } from "./components/McpInstructionsModal";
import { ServerManagementView } from "./components/ServerManagementView";
import { debug } from "./debug";
import { useExternalEvents } from "./hooks/useExternalEvents";
import { commandShortcuts, globalShortcuts } from "./shortcuts";
import { useAppStore } from "./store";
import { ThemeProvider, useTheme } from "./theme-context";

let exitHandler: (() => Promise<void>) | undefined;

export function setExitHandler(handler: () => Promise<void>) {
  exitHandler = handler;
}

function App() {
  // Wire up external events (registry updates, logs)
  useExternalEvents();

  const theme = useTheme();

  const activeModal = useAppStore((state) => state.activeModal);
  const logs = useAppStore((state) => state.logs);
  const clearLogs = useAppStore((state) => state.clearLogs);
  const openModal = useAppStore((state) => state.openModal);
  const closeModal = useAppStore((state) => state.closeModal);
  const viewMode = useAppStore((state) => state.viewMode);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const showCommandMenu = useAppStore((state) => state.showCommandMenu);
  const openCommandMenu = useAppStore((state) => state.openCommandMenu);
  const closeCommandMenu = useAppStore((state) => state.closeCommandMenu);

  useKeyboard((key) => {
    debug("Key pressed:", key.name);

    // ESC hierarchy: command menu -> modals -> return to activity log
    if (key.name === globalShortcuts.escape.key) {
      if (showCommandMenu) {
        debug("Closing command menu");
        closeCommandMenu();
        return;
      }
      if (activeModal) {
        debug("Closing modal");
        closeModal();
        return;
      }
      // ESC returns to activity log from any view
      if (viewMode !== "activity-log") {
        debug("Returning to activity log");
        setViewMode("activity-log");
        return;
      }
    }

    // Command menu takes precedence
    if (showCommandMenu) {
      return; // Let CommandMenu handle its own keys
    }

    // Don't process other keys if a modal is open
    if (activeModal) {
      return;
    }

    // Global shortcuts
    if (key.name === globalShortcuts.quit.key) {
      debug("Exiting app");
      exitHandler?.();
      return;
    }

    if (key.name === globalShortcuts.commandMenu.key) {
      debug("Opening command menu");
      openCommandMenu();
      return;
    }

    // Command shortcuts (work globally)
    if (key.name === commandShortcuts.serverManagement.key) {
      debug("Navigating to server management");
      setViewMode("server-management");
      return;
    }

    if (key.name === commandShortcuts.activityLog.key) {
      debug("Navigating to activity log");
      setViewMode("activity-log");
      return;
    }

    if (key.name === commandShortcuts.addServer.key) {
      debug("Opening add server modal");
      openModal("add-server");
      return;
    }

    if (key.name === commandShortcuts.clearLogs.key && logs.length > 0) {
      debug("Clearing logs");
      clearLogs();
      return;
    }

    if (key.name === commandShortcuts.help.key) {
      debug("Opening help modal");
      openModal("mcp-instructions");
      return;
    }
  });

  return (
    <box
      style={{
        flexDirection: "column",
        height: "100%",
        backgroundColor: theme.background,
        padding: 0,
      }}
    >
      <Header />

      <box
        style={{
          flexDirection: "column",
          flexGrow: 1,
          border: ["top"],
          borderColor: theme.border,
        }}
      >
        {viewMode === "activity-log" && <ActivityLog />}
        {viewMode === "server-management" && <ServerManagementView />}
      </box>

      <Footer />

      {/* Render active modal */}
      {activeModal === "add-server" && <AddServerModal />}
      {activeModal === "delete-server" && <DeleteServerModal />}
      {activeModal === "mcp-instructions" && <McpInstructionsModal />}

      {/* Render command menu */}
      {showCommandMenu && <CommandMenu />}
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

  // Setup global error handlers
  process.on("uncaughtException", (error) => {
    debug("Uncaught Exception:", {
      error: error.toString(),
      message: error.message,
      stack: error.stack,
    });
    console.error("Fatal error:", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    debug("Unhandled Promise Rejection:", {
      reason: String(reason),
      promise: String(promise),
    });
    console.error("Unhandled promise rejection:", reason);
  });

  // Render app (render() automatically includes ErrorBoundary)
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}
