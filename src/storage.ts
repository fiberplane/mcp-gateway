import { homedir } from "node:os";
import { join } from "node:path";
import type { Registry } from "./registry.js";
import { fromMcpJson, toMcpJson } from "./registry.js";

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

// Ensure storage directory exists
export async function ensureStorageDir(storageDir: string): Promise<void> {
  try {
    // Use Bun's shell command template for mkdir -p
    await Bun.$`mkdir -p ${storageDir}`;
  } catch (error) {
    throw new Error(`Failed to create storage directory: ${error}`);
  }
}

// Load registry from mcp.json using Bun.file
export async function loadRegistry(storageDir: string): Promise<Registry> {
  const mcpPath = join(storageDir, "mcp.json");
  const file = Bun.file(mcpPath);

  if (!(await file.exists())) {
    return { servers: [] };
  }

  try {
    const data = await file.json();
    return fromMcpJson(data);
  } catch (_error) {
    console.warn(
      `Warning: Invalid mcp.json at ${mcpPath}, starting with empty registry`,
    );
    return { servers: [] };
  }
}

// Save registry to mcp.json using Bun.write
export async function saveRegistry(
  storageDir: string,
  registry: Registry,
): Promise<void> {
  await ensureStorageDir(storageDir);

  const mcpPath = join(storageDir, "mcp.json");
  const data = toMcpJson(registry);

  try {
    await Bun.write(mcpPath, JSON.stringify(data, null, 2));
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
