import { mkdir } from "node:fs/promises";

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureStorageDir(storageDir: string): Promise<void> {
  try {
    // Use Node.js fs.mkdir with recursive option
    await mkdir(storageDir, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create storage directory: ${error}`);
  }
}
