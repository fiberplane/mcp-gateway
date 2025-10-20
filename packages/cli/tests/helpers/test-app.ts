/**
 * Test helper for creating gateway app with all dependencies wired up
 */

import {
  createGateway,
  createMcpApp,
  createRequestCaptureRecord,
  createResponseCaptureRecord,
  getServer,
  logger,
  resetMigrationState,
  saveRegistry as saveRegistryCore,
} from "@fiberplane/mcp-gateway-core";
import {
  createApp as createServerApp,
  type ProxyDependencies,
} from "@fiberplane/mcp-gateway-server";
import type { Registry } from "@fiberplane/mcp-gateway-types";
import type { Hono } from "hono";

/**
 * Create a fully configured gateway app for testing
 * This wires up all the dependencies that would normally be done in cli.ts
 */
export async function createApp(
  registry: Registry,
  storageDir: string,
): Promise<{
  app: Hono;
  registry: Registry;
  gateway: import("@fiberplane/mcp-gateway-core").Gateway;
}> {
  // Reset migration state before creating new Gateway instance
  // This ensures migrations run for each new storage directory in tests
  resetMigrationState();

  // Create Gateway instance
  const gateway = await createGateway({ storageDir });

  // Wire up proxy dependencies using Gateway methods
  // Note: We can't use gateway.registry.getServer or requestTracker directly
  // because they're not exposed at the Gateway level. We'll use the core functions.
  const proxyDependencies: ProxyDependencies = {
    createRequestRecord: (serverName: string, sessionId: string, request) =>
      createRequestCaptureRecord(
        serverName,
        sessionId,
        request,
        gateway.clientInfo.get(sessionId),
      ),

    createResponseRecord: (
      serverName: string,
      sessionId: string,
      response,
      httpStatus: number,
      method: string,
    ) =>
      createResponseCaptureRecord(
        serverName,
        sessionId,
        response,
        httpStatus,
        method,
        gateway.clientInfo.get(sessionId),
      ),

    appendRecord: async (record) => {
      await gateway.capture.append(record);
    },

    captureErrorResponse: async (
      serverName: string,
      sessionId: string,
      request,
      error,
      httpStatus: number,
      durationMs: number,
    ) => {
      await gateway.capture.error(
        serverName,
        sessionId,
        request,
        error,
        httpStatus,
        durationMs,
      );
    },

    captureSSEEventData: async (
      serverName: string,
      sessionId: string,
      sseEvent,
      method?: string,
      requestId?: string | number | null,
    ) => {
      await gateway.capture.sseEvent(
        serverName,
        sessionId,
        sseEvent,
        method,
        requestId,
      );
    },

    captureSSEJsonRpcMessage: async (
      serverName: string,
      sessionId: string,
      jsonRpcMessage,
      sseEvent,
      isResponse?: boolean,
    ) => {
      return gateway.capture.sseJsonRpc(
        serverName,
        sessionId,
        jsonRpcMessage,
        sseEvent,
        isResponse,
      );
    },

    storeClientInfoForSession: (sessionId: string, info) => {
      gateway.clientInfo.store(sessionId, info);
    },

    getClientInfoForSession: (sessionId: string) => {
      return gateway.clientInfo.get(sessionId);
    },

    getServerFromRegistry: (registry: Registry, name: string) => {
      return gateway.registry.getServer(registry, name);
    },

    saveRegistryToStorage: async (storage: string, registry: Registry) => {
      await saveRegistryCore(storage, registry);
    },
  };

  // Wrap getServer to return undefined instead of null for type compatibility
  const getServerWrapper = (registry: Registry, name: string) => {
    return getServer(registry, name) ?? undefined;
  };

  // Create server app with all dependencies
  const result = await createServerApp({
    registry,
    storageDir,
    createMcpApp,
    logger,
    proxyDependencies,
    getServer: getServerWrapper,
    gateway,
  });

  return {
    ...result,
    gateway,
  };
}

/**
 * Re-export saveRegistry from core for convenience
 */
export { saveRegistry } from "@fiberplane/mcp-gateway-core";
