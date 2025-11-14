/**
 * Test helper for creating gateway app with all dependencies wired up
 */

import {
  createGateway,
  createRequestCaptureRecord,
  createResponseCaptureRecord,
  type Gateway,
  getMethodDetail,
  logger,
  resetMigrationState,
} from "@fiberplane/mcp-gateway-core";
import { createMcpApp } from "@fiberplane/mcp-gateway-management-mcp";
import {
  createApp as createServerApp,
  type ProxyDependencies,
} from "@fiberplane/mcp-gateway-server";
import type {
  ApiRequestLogEntry,
  ApiResponseLogEntry,
  McpServer,
} from "@fiberplane/mcp-gateway-types";
import type { Hono } from "hono";

/**
 * Create a fully configured gateway app for testing
 * This wires up all the dependencies that would normally be done in cli.ts
 */
export async function createApp(
  servers: McpServer[],
  storageDir: string,
): Promise<{
  app: Hono;
  servers: McpServer[];
  gateway: Gateway;
}> {
  // Reset migration state before creating new Gateway instance
  // This ensures migrations run for each new storage directory in tests
  resetMigrationState();

  // Create Gateway instance
  const gateway = await createGateway({ storageDir });

  // Add servers to Gateway storage (for tests to pre-populate servers)
  // Skip servers that already exist (tests may have pre-populated via saveRegistry)
  const existingServers = await gateway.storage.getRegisteredServers();
  const existingNames = new Set(existingServers.map((s) => s.name));

  for (const server of servers) {
    if (!existingNames.has(server.name)) {
      await gateway.storage.addServer(server);
    }
  }

  // Wire up proxy dependencies using Gateway methods
  const proxyDependencies: ProxyDependencies = {
    createRequestRecord: (
      serverName: string,
      sessionId: string,
      request,
      httpContext,
      clientInfo,
      serverInfo,
    ) => {
      const timestamp = new Date().toISOString();
      const apiEntry: ApiRequestLogEntry = {
        timestamp,
        method: request.method,
        id: request.id ?? null,
        direction: "request",
        metadata: {
          serverName,
          sessionId,
          durationMs: 0,
          httpStatus: 0,
        },
        request,
      };
      const methodDetail = getMethodDetail(apiEntry);

      return createRequestCaptureRecord(
        serverName,
        sessionId,
        request,
        httpContext,
        clientInfo,
        serverInfo,
        gateway.requestTracker,
        methodDetail,
      );
    },

    createResponseRecord: (
      serverName: string,
      sessionId: string,
      response,
      httpStatus: number,
      method: string,
      httpContext,
      clientInfo,
      serverInfo,
    ) => {
      const timestamp = new Date().toISOString();
      const apiEntry: ApiResponseLogEntry = {
        timestamp,
        method,
        id: response.id ?? null,
        direction: "response",
        metadata: {
          serverName,
          sessionId,
          durationMs: 0,
          httpStatus,
        },
        response,
      };
      const methodDetail = getMethodDetail(apiEntry);

      return createResponseCaptureRecord(
        serverName,
        sessionId,
        response,
        httpStatus,
        method,
        httpContext,
        clientInfo,
        serverInfo,
        gateway.requestTracker,
        methodDetail,
      );
    },

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

    storeServerInfoForSession: (sessionId: string, info) => {
      gateway.serverInfo.store(sessionId, info);
    },

    getServerInfoForSession: (sessionId: string) => {
      return gateway.serverInfo.get(sessionId);
    },

    updateServerInfoForInitializeRequest: async (
      serverName: string,
      sessionId: string,
      requestId: string | number,
      serverInfo,
    ) => {
      await gateway.storage.updateServerInfoForInitializeRequest(
        serverName,
        sessionId,
        requestId,
        serverInfo,
      );
    },

    getServer: (name: string) => {
      return gateway.storage.getServer(name);
    },
  };

  // Create server app with all dependencies
  const result = await createServerApp({
    storageDir,
    createMcpApp,
    appLogger: logger,
    proxyDependencies,
    gateway,
  });

  // Get servers from Gateway storage
  const savedServers = await gateway.storage.getRegisteredServers();

  return {
    ...result,
    servers: savedServers,
    gateway,
  };
}

/**
 * Test helper to load servers from storage
 * Uses Gateway storage API internally
 */
export async function loadRegistry(storageDir: string): Promise<McpServer[]> {
  // Create a temporary gateway instance to access storage
  resetMigrationState();
  const gateway = await createGateway({ storageDir });

  try {
    return await gateway.storage.getRegisteredServers();
  } finally {
    await gateway.close();
  }
}

/**
 * Test helper to save servers to storage
 * Uses Gateway storage API internally
 */
export async function saveRegistry(
  storageDir: string,
  servers: McpServer[],
): Promise<void> {
  // Create a temporary gateway instance to access storage
  resetMigrationState();
  const gateway = await createGateway({ storageDir });

  try {
    // Clear existing servers and add new ones
    const existingServers = await gateway.storage.getRegisteredServers();
    for (const server of existingServers) {
      await gateway.storage.removeServer(server.name);
    }
    for (const server of servers) {
      await gateway.storage.addServer(server);
    }
  } finally {
    await gateway.close();
  }
}
