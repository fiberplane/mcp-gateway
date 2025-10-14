import { logger, getStorageRoot, loadRegistry } from "@fiberplane/mcp-gateway-core";
import { createApp } from "./create-server.js";

// Re-export createApp
export { createApp };

// Create app instance for development
const storageDir = getStorageRoot();
const devRegistry = await loadRegistry(storageDir);
const { app } = await createApp(devRegistry, storageDir);
const port = 3333;

if (import.meta.main) {
  await logger.initialize(storageDir);
}

export default {
  port,
  fetch: app.fetch,
};
