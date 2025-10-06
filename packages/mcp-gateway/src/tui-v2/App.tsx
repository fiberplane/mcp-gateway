import { render, useKeyboard } from "@opentui/react";
import type { Registry } from "../registry";
import type { Context } from "../tui/state";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { ServerList } from "./components/ServerList";
import { useAppStore } from "./store";

let exitHandler: (() => Promise<void>) | undefined;

export function setExitHandler(handler: () => Promise<void>) {
  exitHandler = handler;
}

function App() {
  useKeyboard((key) => {
    if (key.name === "q") {
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
  // Initialize store
  const initialize = useAppStore.getState().initialize;
  initialize(registry, context.storageDir);

  // Setup async exit handler
  const handleExit = async () => {
    try {
      // Call onExit - supports both sync and async
      const result = context.onExit?.();
      // If it returns a promise, await it
      if (result && typeof result === 'object' && 'then' in result) {
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
