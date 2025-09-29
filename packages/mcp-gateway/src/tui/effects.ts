import { saveRegistry } from "../storage.js";
import { emitRegistryUpdate } from "./events.js";
import type { Context, State } from "./state.js";

// Effect types
export type Effect =
  | { type: "add_server" }
  | { type: "delete_server" }
  | { type: "save_server"; name: string; url: string }
  | { type: "remove_server"; serverName: string }
  | { type: "none" };

// Side effect handler
export async function performEffect(
  effect: Effect,
  state: State,
  context: Context,
): Promise<void> {
  switch (effect.type) {
    case "add_server": {
      // Show add server form modal
      state.mode = "modal";
      state.modalContent = "add_server_form";
      state.formState = {
        fields: [
          { name: "url", label: "Server URL", value: "", placeholder: "e.g. http://localhost:3000/mcp" },
          { name: "name", label: "Display Name", value: "", placeholder: "e.g. my-server" }
        ],
        focusedFieldIndex: 0
      };
      break;
    }

    case "delete_server": {
      if (state.registry.servers.length === 0) {
        // No servers to delete - just show empty state
        state.mode = "modal";
        state.modalContent = "delete_server_form";
        state.deleteServerState = {
          selectedIndex: 0,
          showConfirm: false
        };
      } else {
        // Show delete server selection modal
        state.mode = "modal";
        state.modalContent = "delete_server_form";
        state.deleteServerState = {
          selectedIndex: 0,
          showConfirm: false
        };
      }
      break;
    }

    case "save_server": {
      try {
        // Normalize inputs
        const normalizedUrl = new URL(effect.url).toString().replace(/\/$/, "");
        const normalizedName = effect.name.toLowerCase().trim();

        // Check if server already exists
        if (state.registry.servers.some((s) => s.name === normalizedName)) {
          console.log(`\nError: Server '${effect.name}' already exists`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return;
        }

        // Add server to registry
        state.registry.servers.push({
          name: normalizedName,
          url: normalizedUrl,
          type: "http",
          headers: {},
          lastActivity: null,
          exchangeCount: 0,
        });

        await saveRegistry(context.storageDir, state.registry);

        // Show success message briefly
        console.log(`\n✓ Server '${effect.name}' added successfully!`);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        emitRegistryUpdate();
      } catch (error) {
        console.log(
          `\nError: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      break;
    }

    case "remove_server": {
      try {
        const serverIndex = state.registry.servers.findIndex(
          (s) => s.name === effect.serverName,
        );

        if (serverIndex === -1) {
          console.log(`\nError: Server '${effect.serverName}' not found`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return;
        }

        // Remove server from registry
        state.registry.servers.splice(serverIndex, 1);

        await saveRegistry(context.storageDir, state.registry);

        // Show success message briefly
        console.log(`\n✓ Server '${effect.serverName}' removed successfully!`);
        console.log(`Note: Capture history preserved on disk`);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        emitRegistryUpdate();
      } catch (error) {
        console.log(
          `\nError: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      break;
    }

    case "none":
      break;
  }
}
