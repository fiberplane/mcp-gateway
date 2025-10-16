import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CaptureRecord } from "@fiberplane/mcp-gateway-types";
import { generateCaptureFilename } from "@fiberplane/mcp-gateway-types";
import { logger } from "../../logger";
import { ensureServerCaptureDir } from "../../registry/storage";
import type {
	StorageBackend,
	StorageWriteResult,
} from "../storage-backend.js";

/**
 * JSONL storage backend
 *
 * Writes capture records to JSONL files (one JSON object per line)
 * Files are organized by server name and session ID
 */
export class JsonlStorageBackend implements StorageBackend {
	readonly name = "jsonl";
	private storageDir: string | null = null;

	async initialize(storageDir: string): Promise<void> {
		this.storageDir = storageDir;
		logger.debug("JSONL backend initialized", { storageDir });
	}

	async write(record: CaptureRecord): Promise<StorageWriteResult> {
		if (!this.storageDir) {
			throw new Error("JSONL backend not initialized");
		}

		const filename = generateCaptureFilename(
			record.metadata.serverName,
			record.metadata.sessionId,
		);

		const filePath = join(
			this.storageDir,
			record.metadata.serverName,
			filename,
		);

		// Ensure server capture directory exists
		await ensureServerCaptureDir(
			this.storageDir,
			record.metadata.serverName,
		);

		// Append JSONL line
		const jsonLine = `${JSON.stringify(record)}\n`;

		// Read existing content if file exists
		let existingContent = "";
		try {
			await access(filePath, constants.F_OK);
			existingContent = (await readFile(filePath, "utf8")) as unknown as string;
		} catch {
			// File doesn't exist, start with empty content
		}

		await writeFile(filePath, existingContent + jsonLine, "utf8");

		return {
			metadata: {
				filePath,
				filename,
			},
		};
	}

	async close(): Promise<void> {
		// JSONL backend has no resources to clean up
		logger.debug("JSONL backend closed");
	}
}
