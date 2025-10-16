#!/usr/bin/env bun
/**
 * Import JSONL logs into SQLite database
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { recoverFromJsonl } from "./recovery.js";

const storageDir = join(homedir(), ".mcp-gateway", "captures");

const _stats = await recoverFromJsonl(storageDir, false);
