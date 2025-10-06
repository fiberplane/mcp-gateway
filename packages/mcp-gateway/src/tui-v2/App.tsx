import { render, useKeyboard } from "@opentui/react";
import type { Registry } from "../registry";
import type { Context } from "../tui/state";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { ServerList } from "./components/ServerList";
import { useAppStore } from "./store";
import { debug } from "./debug";
import { useExternalEvents } from "./hooks/useExternalEvents";

let exitHandler: (() => Promise<void>) | undefined;

export function setExitHandler(handler: () => Promise<void>) {
  exitHandler = handler;
}

function App() {
  // Wire up external events (registry updates, logs)
  useExternalEvents();

  useKeyboard((key) => {
    debug("Key pressed:", key.name);

    if (key.name === "q") {
      debug("Exiting app");
      exitHandler?.();
    }
  });

  return (
    <box style={{ flexDirection: "column", height: "100%", padding: 2 }}>
      <Header />

      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        <ServerList />
      </box>

      <Footer />
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
