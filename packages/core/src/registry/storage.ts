import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { McpServer } from "@fiberplane/mcp-gateway-types";
import { logger } from "../logger";
import { ensureStorageDir } from "../utils/storage";
import { fromMcpJson, toMcpJson } from "./index";

// Get the storage root directory
export function getStorageRoot(customDir?: string): string {
  if (customDir) {
    // If custom dir is relative, resolve against cwd
    return customDir.startsWith("/")
      ? customDir
      : join(process.cwd(), customDir);
  }
  return join(homedir(), ".mcp-gateway");
}

/**
 * Load server list from mcp.json using Node.js fs
 * @internal This API is for internal use by the CLI package only.
 * External consumers should use Gateway.storage.getRegisteredServers() instead.
 */
export async function loadRegistry(storageDir: string): Promise<McpServer[]> {
  const mcpPath = join(storageDir, "mcp.json");

  try {
    await access(mcpPath, constants.F_OK);
  } catch {
    // File doesn't exist
    return [];
  }

  try {
    // Type assertion needed: Bun's readFile with "utf8" encoding returns string, not Buffer
    const content = (await readFile(mcpPath, "utf8")) as unknown as string;
    const data = JSON.parse(content);
    return fromMcpJson(data);
  } catch (_error) {
    logger.warn("Invalid mcp.json, starting with empty registry", {
      path: mcpPath,
    });
    return [];
  }
}

/**
 * Save server list to mcp.json using Node.js fs
 * @internal This API is for internal use by the CLI package only.
 * External consumers should use Gateway.storage.addServer() or Gateway.storage.removeServer() instead.
 */
export async function saveRegistry(
  storageDir: string,
  servers: McpServer[],
): Promise<void> {
  await ensureStorageDir(storageDir);

  const mcpPath = join(storageDir, "mcp.json");
  const data = toMcpJson(servers);

  try {
    await writeFile(mcpPath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    throw new Error(`Failed to save registry: ${error}`);
  }
}

// Create server capture directory
export async function ensureServerCaptureDir(
  storageDir: string,
  serverName: string,
): Promise<string> {
  const serverDir = join(storageDir, serverName);
  await ensureStorageDir(serverDir);
  return serverDir;
}

// Get path for capture file
export function getCaptureFilePath(
  storageDir: string,
  serverName: string,
  timestamp: string,
  toolName: string,
  toolCallId: string,
): string {
  const sanitizedToolName = toolName.replace(/[^a-zA-Z0-9]/g, "_");
  const sanitizedCallId = toolCallId.slice(0, 64).replace(/[^a-zA-Z0-9]/g, "_");

  const filename = `${timestamp}-${sanitizedToolName}-${sanitizedCallId}.json`;
  return join(storageDir, serverName, filename);
}

// Format timestamp for filename (replace : with - for filesystem safety)
export function formatTimestampForFile(date: Date = new Date()): string {
  return date.toISOString().replace(/:/g, "-");
}
