import { homedir } from "node:os";
import { join } from "node:path";
import { ensureStorageDir } from "../utils/storage";

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
