import { access, constants, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
	EvalRun,
	GoldenPrompt,
	PromotedTool,
	ToolCandidate,
} from "@fiberplane/mcp-gateway-types";
import { ensureStorageDir } from "../utils/storage";

/**
 * Get the optimization directory for a server
 */
function getOptimizationDir(storageDir: string, serverName: string): string {
	return join(storageDir, "optimization", serverName);
}

/**
 * Get the candidates directory for a server
 */
function getCandidatesDir(storageDir: string, serverName: string): string {
	return join(getOptimizationDir(storageDir, serverName), "candidates");
}

/**
 * Get the prompts directory for a server
 */
function getPromptsDir(storageDir: string, serverName: string): string {
	return join(getOptimizationDir(storageDir, serverName), "prompts");
}

/**
 * Get the eval runs directory for a server
 */
function getEvalRunsDir(storageDir: string, serverName: string): string {
	return join(getOptimizationDir(storageDir, serverName), "eval-runs");
}

/**
 * Get the promotions file path for a server
 */
function getPromotionsPath(storageDir: string, serverName: string): string {
	return join(getOptimizationDir(storageDir, serverName), "promotions.json");
}

/**
 * Get the canonical tools file path for a server
 */
function getCanonicalToolsPath(
	storageDir: string,
	serverName: string,
): string {
	return join(getOptimizationDir(storageDir, serverName), "canonical-tools.json");
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Load JSON from a file, return null if file doesn't exist
 */
async function loadJson<T>(filePath: string): Promise<T | null> {
	if (!(await fileExists(filePath))) {
		return null;
	}

	try {
		// Type assertion needed: Bun's readFile with "utf8" encoding returns string, not Buffer
		const content = (await readFile(filePath, "utf8")) as unknown as string;
		return JSON.parse(content);
	} catch {
		return null;
	}
}

/**
 * Save JSON to a file, ensuring directory exists
 */
async function saveJson<T>(filePath: string, data: T): Promise<void> {
	const dir = dirname(filePath);
	await ensureStorageDir(dir);
	await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Save canonical tools for a server
 */
export async function saveCanonicalTools(
	storageDir: string,
	serverName: string,
	tools: Array<{ name: string; description: string; inputSchema: unknown }>,
): Promise<void> {
	const path = getCanonicalToolsPath(storageDir, serverName);
	await saveJson(path, tools);
}

/**
 * Load canonical tools for a server
 */
export async function loadCanonicalTools(
	storageDir: string,
	serverName: string,
): Promise<Array<{ name: string; description: string; inputSchema: unknown }>> {
	const path = getCanonicalToolsPath(storageDir, serverName);
	const tools = await loadJson<
		Array<{ name: string; description: string; inputSchema: unknown }>
	>(path);
	return tools || [];
}

/**
 * Save a candidate for a tool
 */
export async function saveCandidate(
	storageDir: string,
	serverName: string,
	toolName: string,
	candidate: ToolCandidate,
): Promise<void> {
	const candidatesDir = getCandidatesDir(storageDir, serverName);
	await ensureStorageDir(candidatesDir);

	const path = join(candidatesDir, `${toolName}.json`);
	const existing = await loadCandidates(storageDir, serverName, toolName);
	await saveJson(path, [...existing, candidate]);
}

/**
 * Load all candidates for a tool
 */
export async function loadCandidates(
	storageDir: string,
	serverName: string,
	toolName: string,
): Promise<ToolCandidate[]> {
	const candidatesDir = getCandidatesDir(storageDir, serverName);
	const path = join(candidatesDir, `${toolName}.json`);
	const candidates = await loadJson<ToolCandidate[]>(path);
	return candidates || [];
}

/**
 * Load all candidates for all tools in a server
 */
export async function loadAllCandidates(
	storageDir: string,
	serverName: string,
): Promise<Map<string, ToolCandidate[]>> {
	const candidatesDir = getCandidatesDir(storageDir, serverName);
	const candidatesMap = new Map<string, ToolCandidate[]>();

	try {
		// Import readdir dynamically to avoid issues with Bun
		const { readdir } = await import("node:fs/promises");
		const files = await readdir(candidatesDir);

		for (const file of files) {
			if (file.endsWith(".json")) {
				const toolName = file.replace(".json", "");
				const candidates = await loadCandidates(
					storageDir,
					serverName,
					toolName,
				);
				if (candidates.length > 0) {
					candidatesMap.set(toolName, candidates);
				}
			}
		}
	} catch {
		// Directory doesn't exist or can't be read
	}

	return candidatesMap;
}

/**
 * Save golden prompts for a tool
 */
export async function saveGoldenPrompts(
	storageDir: string,
	serverName: string,
	toolName: string,
	prompts: GoldenPrompt[],
): Promise<void> {
	const promptsDir = getPromptsDir(storageDir, serverName);
	await ensureStorageDir(promptsDir);

	const path = join(promptsDir, `${toolName}.json`);
	await saveJson(path, prompts);
}

/**
 * Load golden prompts for a tool
 */
export async function loadGoldenPrompts(
	storageDir: string,
	serverName: string,
	toolName: string,
): Promise<GoldenPrompt[]> {
	const promptsDir = getPromptsDir(storageDir, serverName);
	const path = join(promptsDir, `${toolName}.json`);
	const prompts = await loadJson<GoldenPrompt[]>(path);
	return prompts || [];
}

/**
 * Save an evaluation run for a candidate
 */
export async function saveEvalRun(
	storageDir: string,
	serverName: string,
	candidateId: string,
	run: EvalRun,
): Promise<void> {
	const evalRunsDir = getEvalRunsDir(storageDir, serverName);
	await ensureStorageDir(evalRunsDir);

	const path = join(evalRunsDir, `${candidateId}.json`);
	const existing = await loadEvalRuns(storageDir, serverName, candidateId);
	await saveJson(path, [...existing, run]);
}

/**
 * Load all evaluation runs for a candidate
 */
export async function loadEvalRuns(
	storageDir: string,
	serverName: string,
	candidateId: string,
): Promise<EvalRun[]> {
	const evalRunsDir = getEvalRunsDir(storageDir, serverName);
	const path = join(evalRunsDir, `${candidateId}.json`);
	const runs = await loadJson<EvalRun[]>(path);
	return runs || [];
}

/**
 * Load all evaluation runs for all candidates in a server
 */
export async function loadAllEvalRuns(
	storageDir: string,
	serverName: string,
): Promise<Map<string, EvalRun[]>> {
	const evalRunsDir = getEvalRunsDir(storageDir, serverName);
	const runsMap = new Map<string, EvalRun[]>();

	try {
		const { readdir } = await import("node:fs/promises");
		const files = await readdir(evalRunsDir);

		for (const file of files) {
			if (file.endsWith(".json")) {
				const candidateId = file.replace(".json", "");
				const runs = await loadEvalRuns(storageDir, serverName, candidateId);
				if (runs.length > 0) {
					runsMap.set(candidateId, runs);
				}
			}
		}
	} catch {
		// Directory doesn't exist or can't be read
	}

	return runsMap;
}

/**
 * Save a promotion (activates an optimized description)
 */
export async function savePromotion(
	storageDir: string,
	serverName: string,
	toolName: string,
	promotion: PromotedTool,
): Promise<void> {
	const path = getPromotionsPath(storageDir, serverName);
	const promotions = await loadPromotions(storageDir, serverName);
	promotions.set(toolName, promotion);

	// Convert Map to object for JSON storage
	const obj = Object.fromEntries(promotions);
	await saveJson(path, obj);
}

/**
 * Load all promotions for a server
 */
export async function loadPromotions(
	storageDir: string,
	serverName: string,
): Promise<Map<string, PromotedTool>> {
	const path = getPromotionsPath(storageDir, serverName);
	const obj = await loadJson<Record<string, PromotedTool>>(path);

	if (!obj) {
		return new Map();
	}

	return new Map(Object.entries(obj));
}

/**
 * Delete a promotion (revert to canonical description)
 */
export async function deletePromotion(
	storageDir: string,
	serverName: string,
	toolName: string,
): Promise<void> {
	const path = getPromotionsPath(storageDir, serverName);
	const promotions = await loadPromotions(storageDir, serverName);
	promotions.delete(toolName);

	// Convert Map to object for JSON storage
	const obj = Object.fromEntries(promotions);
	await saveJson(path, obj);
}
