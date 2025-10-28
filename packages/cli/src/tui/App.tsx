import { logger } from "@fiberplane/mcp-gateway-core";
import type { Context, Registry } from "@fiberplane/mcp-gateway-types";
import { render, useKeyboard } from "@opentui/react";
import { ActivityLog } from "./components/ActivityLog";
import { ActivityLogDetailModal } from "./components/ActivityLogDetailModal";
import { AddServerModal } from "./components/AddServerModal";
import { CommandMenu } from "./components/CommandMenu";
import { DeleteServerModal } from "./components/DeleteServerModal";
import { EmptyState } from "./components/EmptyState";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { McpInstructionsModal } from "./components/McpInstructionsModal";
import { OptimizationView } from "./components/Optimization";
import { ServerManagementView } from "./components/ServerManagement";
import { useExternalEvents } from "./hooks/useExternalEvents";
import { commandShortcuts, globalShortcuts } from "./shortcuts";
import { useAppStore } from "./store";
import { ThemeProvider, useTheme } from "./theme-context";

let exitHandler: (() => Promise<void>) | undefined;

function setExitHandler(handler: () => Promise<void>) {
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
    logger.debug("Key pressed", { key: key.name });

    // ESC hierarchy: command menu -> modals -> return to activity log
    if (key.name === globalShortcuts.escape.key) {
      if (showCommandMenu) {
        logger.debug("Closing command menu");
        closeCommandMenu();
        return;
      }
      if (activeModal) {
        logger.debug("Closing modal");
        closeModal();
        return;
      }
      // ESC returns to activity log from any view
      if (viewMode !== "activity-log") {
        logger.debug("Returning to activity log");
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
      logger.debug("Exiting app");
      exitHandler?.();
      return;
    }

    if (key.name === globalShortcuts.commandMenu.key) {
      logger.debug("Opening command menu");
      openCommandMenu();
      return;
    }

    // Command shortcuts (work globally)
    if (key.name === commandShortcuts.serverManagement.key) {
      logger.debug("Navigating to server management");
      setViewMode("server-management");
      return;
    }

    if (key.name === commandShortcuts.activityLog.key) {
      logger.debug("Navigating to activity log");
      setViewMode("activity-log");
      return;
    }

    if (key.name === commandShortcuts.optimization.key) {
      logger.debug("Navigating to optimization view");
      setViewMode("optimization");
      return;
    }

    if (key.name === commandShortcuts.addServer.key) {
      logger.debug("Opening add server modal");
      openModal("add-server");
      return;
    }

    if (key.name === commandShortcuts.clearLogs.key && logs.length > 0) {
      logger.debug("Clearing logs");
      clearLogs();
      return;
    }

    if (key.name === commandShortcuts.help.key) {
      logger.debug("Opening help modal");
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
        {viewMode === "activity-log" &&
          (logs.length === 0 ? <EmptyState /> : <ActivityLog />)}
        {viewMode === "server-management" && <ServerManagementView />}
        {viewMode === "optimization" && <OptimizationView />}
      </box>

      <Footer />

      {/* Render active modal */}
      {activeModal === "add-server" && <AddServerModal />}
      {activeModal === "delete-server" && <DeleteServerModal />}
      {activeModal === "mcp-instructions" && <McpInstructionsModal />}
      {activeModal === "activity-log-detail" && <ActivityLogDetailModal />}

      {/* Render command menu */}
      {showCommandMenu && <CommandMenu />}
    </box>
  );
}

export async function runOpenTUI(context: Context, registry: Registry) {
  logger.debug("Initializing OpenTUI app", {
    serverCount: registry.servers.length,
    storageDir: context.storageDir,
  });

  // Convert registry servers to UI servers
  const uiServers = registry.servers.map((server) => ({
    name: server.name,
    url: server.url,
    type: server.type,
    headers: server.headers,
    health: server.health ?? ("unknown" as const),
    lastHealthCheck: server.lastHealthCheck,
  }));

  // Initialize store
  const initialize = useAppStore.getState().initialize;
  initialize(uiServers, registry, context.storageDir, context.port);

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
    } catch (_error) {
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
    logger.error("Uncaught Exception", {
      error: error.toString(),
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Promise Rejection", {
      reason: String(reason),
      promise: String(promise),
    });
  });

  // Enable bracketed paste mode manually (OpenTUI doesn't enable it by default)
  process.stdout.write("\x1b[?2004h");

  // Disable on exit
  const disableBracketedPaste = () => {
    process.stdout.write("\x1b[?2004l");
  };
  process.on("exit", disableBracketedPaste);

  // Render app (render() automatically includes ErrorBoundary)
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}
