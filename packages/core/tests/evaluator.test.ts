import { describe, expect, test } from "bun:test";
import type {
	EvalRun,
	GoldenPrompt,
} from "@fiberplane/mcp-gateway-types";
import {
	computeMetrics,
	shouldPromote,
	DEFAULT_THRESHOLDS,
	type Metrics,
} from "../src/optimization/evaluator";

describe("Optimization Evaluator", () => {
	describe("Metrics Computation", () => {
		test("should compute correct metrics for all categories", () => {
			const prompts: GoldenPrompt[] = [
				// Direct prompts
				{
					id: "p1",
					toolName: "get_weather",
					category: "direct",
					prompt: "Get weather for Paris",
					expectedBehavior: { shouldCallTool: true },
				},
				{
					id: "p2",
					toolName: "get_weather",
					category: "direct",
					prompt: "What's the weather in NYC?",
					expectedBehavior: { shouldCallTool: true },
				},
				// Indirect prompts
				{
					id: "p3",
					toolName: "get_weather",
					category: "indirect",
					prompt: "Should I bring an umbrella?",
					expectedBehavior: { shouldCallTool: true },
				},
				{
					id: "p4",
					toolName: "get_weather",
					category: "indirect",
					prompt: "Will it rain tomorrow?",
					expectedBehavior: { shouldCallTool: true },
				},
				// Negative prompts
				{
					id: "p5",
					toolName: "get_weather",
					category: "negative",
					prompt: "What is Paris?",
					expectedBehavior: { shouldCallTool: false },
				},
				{
					id: "p6",
					toolName: "get_weather",
					category: "negative",
					prompt: "Book a flight",
					expectedBehavior: { shouldCallTool: false },
				},
			];

			const runs: EvalRun[] = [
				// Direct: 2/2 correct (100%)
				{
					id: "r1",
					candidateId: "c1",
					promptId: "p1",
					timestamp: new Date().toISOString(),
					result: { toolCalled: true, correct: true, durationMs: 1000 },
				},
				{
					id: "r2",
					candidateId: "c1",
					promptId: "p2",
					timestamp: new Date().toISOString(),
					result: { toolCalled: true, correct: true, durationMs: 1000 },
				},
				// Indirect: 1/2 correct (50%)
				{
					id: "r3",
					candidateId: "c1",
					promptId: "p3",
					timestamp: new Date().toISOString(),
					result: { toolCalled: true, correct: true, durationMs: 1000 },
				},
				{
					id: "r4",
					candidateId: "c1",
					promptId: "p4",
					timestamp: new Date().toISOString(),
					result: { toolCalled: false, correct: false, durationMs: 1000 }, // Wrong!
				},
				// Negative: 2/2 correct (100%)
				{
					id: "r5",
					candidateId: "c1",
					promptId: "p5",
					timestamp: new Date().toISOString(),
					result: { toolCalled: false, correct: true, durationMs: 1000 },
				},
				{
					id: "r6",
					candidateId: "c1",
					promptId: "p6",
					timestamp: new Date().toISOString(),
					result: { toolCalled: false, correct: true, durationMs: 1000 },
				},
			];

			const metrics = computeMetrics(runs, prompts);

			expect(metrics.directSuccess).toBe(1.0); // 2/2
			expect(metrics.indirectSuccess).toBe(0.5); // 1/2
			expect(metrics.negativeSuccess).toBe(1.0); // 2/2
			expect(metrics.overall).toBeCloseTo(5 / 6, 2); // 5/6 correct overall
		});

		test("should handle empty runs gracefully", () => {
			const prompts: GoldenPrompt[] = [
				{
					id: "p1",
					toolName: "test",
					category: "direct",
					prompt: "test",
					expectedBehavior: { shouldCallTool: true },
				},
			];

			const runs: EvalRun[] = [];

			const metrics = computeMetrics(runs, prompts);

			expect(metrics.directSuccess).toBe(0);
			expect(metrics.indirectSuccess).toBe(0);
			expect(metrics.negativeSuccess).toBe(0);
			expect(metrics.overall).toBe(0);
		});

		test("should handle missing category prompts", () => {
			// Only direct prompts, no indirect or negative
			const prompts: GoldenPrompt[] = [
				{
					id: "p1",
					toolName: "test",
					category: "direct",
					prompt: "test",
					expectedBehavior: { shouldCallTool: true },
				},
			];

			const runs: EvalRun[] = [
				{
					id: "r1",
					candidateId: "c1",
					promptId: "p1",
					timestamp: new Date().toISOString(),
					result: { toolCalled: true, correct: true, durationMs: 1000 },
				},
			];

			const metrics = computeMetrics(runs, prompts);

			expect(metrics.directSuccess).toBe(1.0);
			expect(metrics.indirectSuccess).toBe(0); // No indirect prompts
			expect(metrics.negativeSuccess).toBe(0); // No negative prompts
			expect(metrics.overall).toBe(1.0);
		});

		test("should handle runs without matching prompts in category metrics", () => {
			const prompts: GoldenPrompt[] = [
				{
					id: "p1",
					toolName: "test",
					category: "direct",
					prompt: "test",
					expectedBehavior: { shouldCallTool: true },
				},
			];

			const runs: EvalRun[] = [
				{
					id: "r1",
					candidateId: "c1",
					promptId: "p1",
					timestamp: new Date().toISOString(),
					result: { toolCalled: true, correct: true, durationMs: 1000 },
				},
				{
					id: "r2",
					candidateId: "c1",
					promptId: "p999", // Non-existent prompt
					timestamp: new Date().toISOString(),
					result: { toolCalled: false, correct: false, durationMs: 1000 },
				},
			];

			const metrics = computeMetrics(runs, prompts);

			// Direct category only counts matching prompts
			expect(metrics.directSuccess).toBe(1.0);
			// Overall counts all runs (including orphaned ones)
			expect(metrics.overall).toBe(0.5); // 1 correct out of 2 total runs
		});
	});

	describe("Promotion Criteria", () => {
		test("should promote when all criteria are met", () => {
			const candidate: Metrics = {
				directSuccess: 0.95,
				indirectSuccess: 0.87,
				negativeSuccess: 0.92,
				overall: 0.91,
			};

			const baseline: Metrics = {
				directSuccess: 0.85,
				indirectSuccess: 0.80,
				negativeSuccess: 0.85,
				overall: 0.83,
			};

			const result = shouldPromote(candidate, baseline);
			expect(result).toBe(true);
		});

		test("should reject if overall below threshold", () => {
			const candidate: Metrics = {
				directSuccess: 0.90,
				indirectSuccess: 0.85,
				negativeSuccess: 0.85,
				overall: 0.84, // Below 0.85
			};

			const baseline: Metrics = {
				directSuccess: 0.80,
				indirectSuccess: 0.75,
				negativeSuccess: 0.80,
				overall: 0.78,
			};

			const result = shouldPromote(candidate, baseline);
			expect(result).toBe(false);
		});

		test("should reject if negative success below threshold", () => {
			const candidate: Metrics = {
				directSuccess: 0.95,
				indirectSuccess: 0.90,
				negativeSuccess: 0.75, // Below 0.80
				overall: 0.87,
			};

			const baseline: Metrics = {
				directSuccess: 0.85,
				indirectSuccess: 0.80,
				negativeSuccess: 0.85,
				overall: 0.83,
			};

			const result = shouldPromote(candidate, baseline);
			expect(result).toBe(false);
		});

		test("should reject if improvement below threshold", () => {
			const candidate: Metrics = {
				directSuccess: 0.90,
				indirectSuccess: 0.87,
				negativeSuccess: 0.90,
				overall: 0.87, // Only 0.04 improvement
			};

			const baseline: Metrics = {
				directSuccess: 0.85,
				indirectSuccess: 0.85,
				negativeSuccess: 0.85,
				overall: 0.85,
			};

			// Default threshold is 0.05
			const result = shouldPromote(candidate, baseline);
			expect(result).toBe(false);
		});

		test("should reject if any category regresses too much", () => {
			const candidate: Metrics = {
				directSuccess: 0.70, // Regressed by 0.20 (more than 0.10 max)
				indirectSuccess: 0.95,
				negativeSuccess: 0.95,
				overall: 0.87,
			};

			const baseline: Metrics = {
				directSuccess: 0.90,
				indirectSuccess: 0.85,
				negativeSuccess: 0.85,
				overall: 0.87,
			};

			const result = shouldPromote(candidate, baseline);
			expect(result).toBe(false);
		});

		test("should allow promotion with custom thresholds", () => {
			const candidate: Metrics = {
				directSuccess: 0.82,
				indirectSuccess: 0.80,
				negativeSuccess: 0.78,
				overall: 0.80,
			};

			const baseline: Metrics = {
				directSuccess: 0.75,
				indirectSuccess: 0.73,
				negativeSuccess: 0.75,
				overall: 0.74,
			};

			// With default thresholds, this would be rejected
			expect(shouldPromote(candidate, baseline)).toBe(false);

			// With custom thresholds, it should pass
			const result = shouldPromote(candidate, baseline, {
				minOverall: 0.75,
				minNegative: 0.70,
				minImprovement: 0.05,
				maxRegression: 0.15,
			});
			expect(result).toBe(true);
		});

		test("should use default thresholds when not provided", () => {
			const candidate: Metrics = {
				directSuccess: 0.90,
				indirectSuccess: 0.87,
				negativeSuccess: 0.85,
				overall: 0.87,
			};

			const baseline: Metrics = {
				directSuccess: 0.80,
				indirectSuccess: 0.77,
				negativeSuccess: 0.75,
				overall: 0.77,
			};

			// Should use DEFAULT_THRESHOLDS
			const result = shouldPromote(candidate, baseline);
			expect(result).toBe(true);

			// Verify defaults
			expect(DEFAULT_THRESHOLDS.minOverall).toBe(0.85);
			expect(DEFAULT_THRESHOLDS.minNegative).toBe(0.8);
			expect(DEFAULT_THRESHOLDS.minImprovement).toBe(0.05);
			expect(DEFAULT_THRESHOLDS.maxRegression).toBe(0.1);
		});

		test("should handle edge case: just above threshold values", () => {
			const candidate: Metrics = {
				directSuccess: 0.86,
				indirectSuccess: 0.86,
				negativeSuccess: 0.81, // Just above threshold
				overall: 0.86, // Just above threshold
			};

			const baseline: Metrics = {
				directSuccess: 0.75,
				indirectSuccess: 0.75,
				negativeSuccess: 0.75,
				overall: 0.80, // Improvement of 0.06 (above 0.05)
			};

			// Should pass with values above thresholds
			const result = shouldPromote(candidate, baseline);
			expect(result).toBe(true);
		});

		test("should reject at exact threshold boundaries (exclusive)", () => {
			const candidate: Metrics = {
				directSuccess: 0.85,
				indirectSuccess: 0.85,
				negativeSuccess: 0.80, // Exactly at threshold
				overall: 0.85, // Exactly at threshold
			};

			const baseline: Metrics = {
				directSuccess: 0.75,
				indirectSuccess: 0.75,
				negativeSuccess: 0.75,
				overall: 0.80, // Exactly 0.05 improvement
			};

			// Implementation uses < not <=, so exact values should fail
			const result = shouldPromote(candidate, baseline);
			expect(result).toBe(false);
		});

		test("should handle zero baseline metrics", () => {
			const candidate: Metrics = {
				directSuccess: 0.90,
				indirectSuccess: 0.85,
				negativeSuccess: 0.88,
				overall: 0.88,
			};

			const baseline: Metrics = {
				directSuccess: 0,
				indirectSuccess: 0,
				negativeSuccess: 0,
				overall: 0,
			};

			// Should still pass if candidate meets thresholds
			const result = shouldPromote(candidate, baseline);
			expect(result).toBe(true);
		});
	});
});
