import { getStorageRoot, loadRegistry } from "../storage.js";
import { createApp } from "./create-server.js";

// Re-export createApp
export { createApp };

// Create app instance for development
const devRegistry = await loadRegistry(getStorageRoot());
const { app } = await createApp(devRegistry, getStorageRoot());
const port = 3333;

export default {
  port,
  fetch: app.fetch,
};
