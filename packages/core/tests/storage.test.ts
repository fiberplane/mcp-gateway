import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import type {
	EvalRun,
	GoldenPrompt,
	PromotedTool,
	ToolCandidate,
} from "@fiberplane/mcp-gateway-types";
import {
	deletePromotion,
	loadAllCandidates,
	loadAllEvalRuns,
	loadCanonicalTools,
	loadCandidates,
	loadEvalRuns,
	loadGoldenPrompts,
	loadPromotions,
	saveCandidate,
	saveCanonicalTools,
	saveEvalRun,
	saveGoldenPrompts,
	savePromotion,
} from "../src/optimization/storage";

describe("Optimization Storage", () => {
	let tempDir: string;
	const serverName = "test-server";

	beforeEach(async () => {
		// Create a temporary directory for each test
		tempDir = await mkdtemp(join(tmpdir(), "mcp-gateway-test-"));
	});

	afterEach(async () => {
		// Clean up temporary directory after each test
		try {
			await rm(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore errors if directory doesn't exist
		}
	});

	describe("Canonical Tools", () => {
		test("should save and load canonical tools", async () => {
			const tools = [
				{
					name: "get_weather",
					description: "Get weather for a location",
					inputSchema: { type: "object", properties: {} },
				},
				{
					name: "search_files",
					description: "Search for files",
					inputSchema: { type: "object", properties: {} },
				},
			];

			await saveCanonicalTools(tempDir, serverName, tools);
			const loaded = await loadCanonicalTools(tempDir, serverName);

			expect(loaded).toEqual(tools);
		});

		test("should return empty array if no canonical tools exist", async () => {
			const loaded = await loadCanonicalTools(tempDir, "nonexistent-server");
			expect(loaded).toEqual([]);
		});
	});

	describe("Candidates", () => {
		test("should save and load candidates for a tool", async () => {
			const candidate1: ToolCandidate = {
				id: "candidate-1",
				toolName: "get_weather",
				description: "Fetch weather data for any location",
				charCount: 38,
				createdAt: new Date().toISOString(),
			};

			const candidate2: ToolCandidate = {
				id: "candidate-2",
				toolName: "get_weather",
				description:
					"Get current weather conditions. Use when user needs weather info.",
				charCount: 67,
				createdAt: new Date().toISOString(),
			};

			await saveCandidate(tempDir, serverName, "get_weather", candidate1);
			await saveCandidate(tempDir, serverName, "get_weather", candidate2);

			const loaded = await loadCandidates(tempDir, serverName, "get_weather");

			expect(loaded).toHaveLength(2);
			expect(loaded[0]).toEqual(candidate1);
			expect(loaded[1]).toEqual(candidate2);
		});

		test("should return empty array if no candidates exist", async () => {
			const loaded = await loadCandidates(tempDir, serverName, "nonexistent-tool");
			expect(loaded).toEqual([]);
		});

		test("should load all candidates for all tools", async () => {
			const candidate1: ToolCandidate = {
				id: "candidate-1",
				toolName: "get_weather",
				description: "Weather tool",
				charCount: 12,
				createdAt: new Date().toISOString(),
			};

			const candidate2: ToolCandidate = {
				id: "candidate-2",
				toolName: "search_files",
				description: "File search tool",
				charCount: 16,
				createdAt: new Date().toISOString(),
			};

			await saveCandidate(tempDir, serverName, "get_weather", candidate1);
			await saveCandidate(tempDir, serverName, "search_files", candidate2);

			const allCandidates = await loadAllCandidates(tempDir, serverName);

			expect(allCandidates.size).toBe(2);
			expect(allCandidates.get("get_weather")).toEqual([candidate1]);
			expect(allCandidates.get("search_files")).toEqual([candidate2]);
		});
	});

	describe("Golden Prompts", () => {
		test("should save and load golden prompts", async () => {
			const prompts: GoldenPrompt[] = [
				{
					id: "prompt-1",
					toolName: "get_weather",
					category: "direct",
					prompt: "Get weather for Paris tomorrow",
					expectedBehavior: { shouldCallTool: true },
				},
				{
					id: "prompt-2",
					toolName: "get_weather",
					category: "indirect",
					prompt: "Should I bring an umbrella to my Paris meeting?",
					expectedBehavior: {
						shouldCallTool: true,
						notes: "User needs weather info",
					},
				},
				{
					id: "prompt-3",
					toolName: "get_weather",
					category: "negative",
					prompt: "What is the capital of France?",
					expectedBehavior: {
						shouldCallTool: false,
						notes: "General knowledge question",
					},
				},
			];

			await saveGoldenPrompts(tempDir, serverName, "get_weather", prompts);
			const loaded = await loadGoldenPrompts(tempDir, serverName, "get_weather");

			expect(loaded).toEqual(prompts);
		});

		test("should return empty array if no prompts exist", async () => {
			const loaded = await loadGoldenPrompts(
				tempDir,
				serverName,
				"nonexistent-tool",
			);
			expect(loaded).toEqual([]);
		});

		test("should overwrite prompts when saving", async () => {
			const prompts1: GoldenPrompt[] = [
				{
					id: "prompt-1",
					toolName: "get_weather",
					category: "direct",
					prompt: "First set",
					expectedBehavior: { shouldCallTool: true },
				},
			];

			const prompts2: GoldenPrompt[] = [
				{
					id: "prompt-2",
					toolName: "get_weather",
					category: "indirect",
					prompt: "Second set",
					expectedBehavior: { shouldCallTool: true },
				},
			];

			await saveGoldenPrompts(tempDir, serverName, "get_weather", prompts1);
			await saveGoldenPrompts(tempDir, serverName, "get_weather", prompts2);

			const loaded = await loadGoldenPrompts(tempDir, serverName, "get_weather");
			expect(loaded).toEqual(prompts2);
		});
	});

	describe("Evaluation Runs", () => {
		test("should save and load eval runs", async () => {
			const run1: EvalRun = {
				id: "run-1",
				candidateId: "candidate-1",
				promptId: "prompt-1",
				timestamp: new Date().toISOString(),
				result: {
					toolCalled: true,
					correct: true,
					durationMs: 1234,
				},
			};

			const run2: EvalRun = {
				id: "run-2",
				candidateId: "candidate-1",
				promptId: "prompt-2",
				timestamp: new Date().toISOString(),
				result: {
					toolCalled: false,
					correct: false,
					error: "Tool should have been called",
					durationMs: 2345,
				},
			};

			await saveEvalRun(tempDir, serverName, "candidate-1", run1);
			await saveEvalRun(tempDir, serverName, "candidate-1", run2);

			const loaded = await loadEvalRuns(tempDir, serverName, "candidate-1");

			expect(loaded).toHaveLength(2);
			expect(loaded[0]).toEqual(run1);
			expect(loaded[1]).toEqual(run2);
		});

		test("should return empty array if no runs exist", async () => {
			const loaded = await loadEvalRuns(
				tempDir,
				serverName,
				"nonexistent-candidate",
			);
			expect(loaded).toEqual([]);
		});

		test("should load all eval runs for all candidates", async () => {
			const run1: EvalRun = {
				id: "run-1",
				candidateId: "candidate-1",
				promptId: "prompt-1",
				timestamp: new Date().toISOString(),
				result: {
					toolCalled: true,
					correct: true,
					durationMs: 1234,
				},
			};

			const run2: EvalRun = {
				id: "run-2",
				candidateId: "candidate-2",
				promptId: "prompt-1",
				timestamp: new Date().toISOString(),
				result: {
					toolCalled: false,
					correct: true,
					durationMs: 2345,
				},
			};

			await saveEvalRun(tempDir, serverName, "candidate-1", run1);
			await saveEvalRun(tempDir, serverName, "candidate-2", run2);

			const allRuns = await loadAllEvalRuns(tempDir, serverName);

			expect(allRuns.size).toBe(2);
			expect(allRuns.get("candidate-1")).toEqual([run1]);
			expect(allRuns.get("candidate-2")).toEqual([run2]);
		});
	});

	describe("Promotions", () => {
		test("should save and load promotions", async () => {
			const promotion1: PromotedTool = {
				toolName: "get_weather",
				candidateId: "candidate-1",
				promotedAt: new Date().toISOString(),
				description: "Optimized weather description",
				metrics: {
					directSuccess: 0.95,
					indirectSuccess: 0.87,
					negativeSuccess: 0.92,
					overall: 0.91,
				},
			};

			const promotion2: PromotedTool = {
				toolName: "search_files",
				candidateId: "candidate-2",
				promotedAt: new Date().toISOString(),
				description: "Optimized file search description",
				metrics: {
					directSuccess: 0.88,
					indirectSuccess: 0.82,
					negativeSuccess: 0.85,
					overall: 0.85,
				},
			};

			await savePromotion(tempDir, serverName, "get_weather", promotion1);
			await savePromotion(tempDir, serverName, "search_files", promotion2);

			const loaded = await loadPromotions(tempDir, serverName);

			expect(loaded.size).toBe(2);
			expect(loaded.get("get_weather")).toEqual(promotion1);
			expect(loaded.get("search_files")).toEqual(promotion2);
		});

		test("should return empty map if no promotions exist", async () => {
			const loaded = await loadPromotions(tempDir, "nonexistent-server");
			expect(loaded.size).toBe(0);
		});

		test("should overwrite promotion for same tool", async () => {
			const promotion1: PromotedTool = {
				toolName: "get_weather",
				candidateId: "candidate-1",
				promotedAt: new Date().toISOString(),
				description: "First promotion",
				metrics: {
					directSuccess: 0.8,
					indirectSuccess: 0.8,
					negativeSuccess: 0.8,
					overall: 0.8,
				},
			};

			const promotion2: PromotedTool = {
				toolName: "get_weather",
				candidateId: "candidate-2",
				promotedAt: new Date().toISOString(),
				description: "Second promotion",
				metrics: {
					directSuccess: 0.9,
					indirectSuccess: 0.9,
					negativeSuccess: 0.9,
					overall: 0.9,
				},
			};

			await savePromotion(tempDir, serverName, "get_weather", promotion1);
			await savePromotion(tempDir, serverName, "get_weather", promotion2);

			const loaded = await loadPromotions(tempDir, serverName);
			expect(loaded.get("get_weather")).toEqual(promotion2);
		});

		test("should delete promotion", async () => {
			const promotion: PromotedTool = {
				toolName: "get_weather",
				candidateId: "candidate-1",
				promotedAt: new Date().toISOString(),
				description: "Promoted description",
				metrics: {
					directSuccess: 0.9,
					indirectSuccess: 0.9,
					negativeSuccess: 0.9,
					overall: 0.9,
				},
			};

			await savePromotion(tempDir, serverName, "get_weather", promotion);
			await deletePromotion(tempDir, serverName, "get_weather");

			const loaded = await loadPromotions(tempDir, serverName);
			expect(loaded.has("get_weather")).toBe(false);
		});
	});
});
