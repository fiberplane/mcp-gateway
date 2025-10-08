import { logger } from "../logger.js";
import { getStorageRoot, loadRegistry } from "../storage.js";
import { createApp } from "./create-server.js";

// Re-export createApp
export { createApp };

// Create app instance for development
const storageDir = getStorageRoot();
await logger.initialize(storageDir);
const devRegistry = await loadRegistry(storageDir);
const { app } = await createApp(devRegistry, storageDir);
const port = 3333;

export default {
  port,
  fetch: app.fetch,
};
