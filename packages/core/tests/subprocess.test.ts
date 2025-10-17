import { describe, expect, test } from "bun:test";
import { buildClaudeCommand, runEvaluation } from "../src/optimization/subprocess";

describe("Subprocess Evaluation", () => {
	describe("Production command building", () => {
		test("should build correct Claude CLI command", () => {
			const command = buildClaudeCommand("test prompt with spaces");

			expect(command).toEqual([
				"claude",
				"-p",
				"--output-format",
				"stream-json",
				"--verbose",
				"test prompt with spaces",
			]);
		});
	});

	describe("Process spawning and output capture", () => {
		test("should spawn subprocess and capture stdout", async () => {
			// Use a simple echo command instead of Claude
			const result = await runEvaluation(
				["echo", "test output"],
				"test-tool",
				{ shouldCallTool: false },
				5000,
			);

			expect(result).toBeDefined();
			expect(result.duration).toBeGreaterThan(0);
			expect(result.stdout).toBeDefined();
			expect(result.stderr).toBeDefined();
			expect(typeof result.stdout).toBe("string");
			expect(typeof result.stderr).toBe("string");
			expect(result.stdout).toContain("test output");
		});

		test("should handle timeout correctly", async () => {
			// Use a very short timeout
			const startTime = Date.now();

			const result = await runEvaluation(
				["sleep", "10"], // Would take 10s but we timeout at 100ms
				"test-tool",
				{ shouldCallTool: false },
				100, // 100ms timeout
			);

			const elapsed = Date.now() - startTime;

			expect(result.error).toContain("timed out");
			expect(result.toolCalled).toBe(false);
			expect(result.correct).toBe(false);
			expect(elapsed).toBeLessThan(1000); // Should timeout quickly
		});

		test("should return structured result on success", async () => {
			const result = await runEvaluation(
				["echo", "success"],
				"test-tool",
				{ shouldCallTool: false },
				5000,
			);

			// Check all required fields exist
			expect(result).toHaveProperty("toolCalled");
			expect(result).toHaveProperty("correct");
			expect(result).toHaveProperty("duration");
			expect(result).toHaveProperty("stdout");
			expect(result).toHaveProperty("stderr");

			// Check types
			expect(typeof result.toolCalled).toBe("boolean");
			expect(typeof result.correct).toBe("boolean");
			expect(typeof result.duration).toBe("number");
			expect(typeof result.stdout).toBe("string");
			expect(typeof result.stderr).toBe("string");
		});

		test("should handle subprocess errors gracefully", async () => {
			// Use a command that will fail
			const result = await runEvaluation(
				["false"], // Command that exits with non-zero
				"test-tool",
				{ shouldCallTool: false },
				5000,
			);

			// Should always return valid structure even if subprocess fails
			expect(result).toBeDefined();
			expect(result.duration).toBeGreaterThanOrEqual(0);
			expect(result.error).toBeDefined();
		});
	});

	describe("Tool call detection from stdout", () => {
		test("should detect tool call in stream-json output", async () => {
			// Create mock stream-json output that includes a tool_use event
			const mockOutput = JSON.stringify({
				type: "assistant",
				message: {
					content: [
						{
							type: "tool_use",
							name: "Bash",
							id: "test-123",
						},
					],
				},
			});

			// Echo the mock output to test tool detection
			const result = await runEvaluation(
				["echo", mockOutput],
				"Bash",
				{ shouldCallTool: true },
				5000,
			);

			expect(result.toolCalled).toBe(true);
			expect(result.correct).toBe(true);
		});

		test("should not detect tool call when none present", async () => {
			// Mock output without tool_use
			const mockOutput = JSON.stringify({
				type: "assistant",
				message: {
					content: [
						{
							type: "text",
							text: "Just some text",
						},
					],
				},
			});

			const result = await runEvaluation(
				["echo", mockOutput],
				"NonExistentTool",
				{ shouldCallTool: false },
				5000,
			);

			// Tool should not be detected
			expect(result.toolCalled).toBe(false);
			expect(result.correct).toBe(true);
		});
	});

	describe("Correctness evaluation", () => {
		test("should mark as correct when tool called matches expectation", async () => {
			// Mock output with tool call
			const mockOutput = JSON.stringify({
				type: "assistant",
				message: {
					content: [{ type: "tool_use", name: "test-tool", id: "123" }],
				},
			});

			const result = await runEvaluation(
				["echo", mockOutput],
				"test-tool",
				{ shouldCallTool: true }, // Expect tool to be called
				5000,
			);

			// correct = (toolCalled === expectedBehavior.shouldCallTool)
			expect(result.correct).toBe(true);
			expect(result.toolCalled).toBe(true);
		});

		test("should mark as incorrect when tool call doesn't match expectation", async () => {
			// Mock output with tool call
			const mockOutput = JSON.stringify({
				type: "assistant",
				message: {
					content: [{ type: "tool_use", name: "test-tool", id: "123" }],
				},
			});

			const result = await runEvaluation(
				["echo", mockOutput],
				"test-tool",
				{ shouldCallTool: false }, // Expect tool NOT to be called
				5000,
			);

			expect(result.correct).toBe(false);
			expect(result.toolCalled).toBe(true);
		});
	});

	describe("Duration tracking", () => {
		test("should track duration accurately", async () => {
			const startTime = Date.now();

			const result = await runEvaluation(
				["echo", "test"],
				"test-tool",
				{ shouldCallTool: false },
				5000,
			);

			const elapsed = Date.now() - startTime;

			// Duration should be roughly equal to elapsed time (within 100ms margin)
			expect(result.duration).toBeGreaterThan(0);
			expect(result.duration).toBeLessThanOrEqual(elapsed + 100);
			expect(result.duration).toBeGreaterThanOrEqual(elapsed - 100);
		});

		test("should include duration even on timeout", async () => {
			const result = await runEvaluation(
				["sleep", "10"],
				"test-tool",
				{ shouldCallTool: false },
				100, // Very short timeout
			);

			expect(result.duration).toBeGreaterThan(0);
			expect(result.duration).toBeGreaterThanOrEqual(100);
		});
	});

	describe("Error scenarios", () => {
		test("should return error message on timeout", async () => {
			const result = await runEvaluation(
				["sleep", "10"],
				"test-tool",
				{ shouldCallTool: false },
				100,
			);

			expect(result.error).toBeDefined();
			expect(result.error).toContain("timed out");
		});

		test("should capture stderr output", async () => {
			// Write to stderr using sh
			const result = await runEvaluation(
				["sh", "-c", "echo 'error message' >&2"],
				"test-tool",
				{ shouldCallTool: false },
				5000,
			);

			// stderr should be captured
			expect(result.stderr).toBeDefined();
			expect(typeof result.stderr).toBe("string");
			expect(result.stderr).toContain("error message");
		});
	});
});
