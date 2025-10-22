// Main server application factory

// Re-export Logger from types for backward compatibility
export type { Logger } from "@fiberplane/mcp-gateway-types";
export { createApp } from "./app";

// Proxy dependencies interface (for dependency injection)
export type { ProxyDependencies } from "./routes/proxy";
