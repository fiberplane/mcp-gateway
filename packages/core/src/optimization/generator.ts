/**
 * Generation infrastructure for tool description optimization
 *
 * Uses Claude Code subprocess to generate candidates and golden prompts.
 */

import type { GoldenPrompt, Tool, ToolCandidate } from "@fiberplane/mcp-gateway-types";
import type { OutputCallback } from "./subprocess.js";

/**
 * Result of generating candidates
 */
export interface GenerateCandidatesResult {
	candidates: Array<{
		description: string;
		example?: string;
	}>;
	error?: string;
	stdout: string;
	stderr: string;
}

/**
 * Result of generating golden prompts
 */
export interface GeneratePromptsResult {
	prompts: Array<{
		category: "direct" | "indirect" | "negative";
		prompt: string;
		notes?: string;
	}>;
	error?: string;
	stdout: string;
	stderr: string;
}

/**
 * Generate optimized tool description candidates using Claude Code
 *
 * @param tool - The canonical tool to optimize
 * @param count - Number of candidates to generate
 * @param timeout - Maximum time to wait in milliseconds (default: 60 seconds)
 * @returns Generated candidates
 */
export async function generateCandidates(
	tool: Tool,
	count: number,
	timeout = 60000,
	onOutput?: OutputCallback,
): Promise<GenerateCandidatesResult> {
	const prompt = buildCandidatePrompt(tool, count);
	const command = [
		"claude",
		"-p",
		prompt,
		"--output-format",
		"text",
		"--model",
		"haiku", // Use Haiku 4.5 for faster, cheaper generation
	];

	try {
		const result = await runGenerationSubprocess(command, timeout, onOutput);

		if (result.error) {
			return {
				candidates: [],
				error: result.error,
				stdout: result.stdout,
				stderr: result.stderr,
			};
		}

		// Parse candidates from output
		const candidates = parseCandidates(result.stdout);

		return {
			candidates,
			stdout: result.stdout,
			stderr: result.stderr,
		};
	} catch (error) {
		return {
			candidates: [],
			error: `Failed to generate candidates: ${error}`,
			stdout: "",
			stderr: "",
		};
	}
}

/**
 * Generate golden test prompts using Claude Code
 *
 * @param tool - The canonical tool to generate prompts for
 * @param counts - Number of prompts per category
 * @param timeout - Maximum time to wait in milliseconds (default: 60 seconds)
 * @returns Generated prompts
 */
export async function generateGoldenPrompts(
	tool: Tool,
	counts: { direct: number; indirect: number; negative: number },
	timeout = 60000,
	onOutput?: OutputCallback,
): Promise<GeneratePromptsResult> {
	const prompt = buildPromptsPrompt(tool, counts);
	const command = [
		"claude",
		"-p",
		prompt,
		"--output-format",
		"text",
		"--model",
		"haiku", // Use Haiku 4.5 for faster, cheaper generation
	];

	try {
		const result = await runGenerationSubprocess(command, timeout, onOutput);

		if (result.error) {
			return {
				prompts: [],
				error: result.error,
				stdout: result.stdout,
				stderr: result.stderr,
			};
		}

		// Parse prompts from output
		const prompts = parsePrompts(result.stdout);

		return {
			prompts,
			stdout: result.stdout,
			stderr: result.stderr,
		};
	} catch (error) {
		return {
			prompts: [],
			error: `Failed to generate prompts: ${error}`,
			stdout: "",
			stderr: "",
		};
	}
}

/**
 * Run a subprocess and capture output
 */
async function runGenerationSubprocess(
	command: string[],
	timeout: number,
	onOutput?: OutputCallback,
): Promise<{ stdout: string; stderr: string; error?: string }> {
	// Spawn subprocess with all environment variables from parent process
	// Set HOME to /tmp/claude to avoid sandbox permission issues with ~/.claude.json
	const proc = Bun.spawn(command, {
		stdout: "pipe",
		stderr: "pipe",
		cwd: process.cwd(),
		env: {
			...process.env,
			HOME: "/tmp/claude",
		},
	});

	// Set up timeout
	let killed = false;
	const timeoutId = setTimeout(() => {
		proc.kill();
		killed = true;
	}, timeout);

	// Stream stdout and stderr concurrently
	const stdoutChunks: Uint8Array[] = [];
	const stderrChunks: Uint8Array[] = [];
	let stdoutBuffer = "";
	let stderrBuffer = "";

	const readStdout = async () => {
		if (!proc.stdout) return;
		const reader = proc.stdout.getReader();
		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				stdoutChunks.push(value);

				// Stream output if callback provided
				if (onOutput) {
					stdoutBuffer += decoder.decode(value, { stream: true });
					const lines = stdoutBuffer.split('\n');
					stdoutBuffer = lines.pop() || '';

					for (const line of lines) {
						onOutput(line, 'stdout');
					}
				}
			}

			// Handle any remaining buffered content
			if (onOutput && stdoutBuffer) {
				onOutput(stdoutBuffer, 'stdout');
			}
		} catch (error) {
			// Stream closed, ignore
		}
	};

	const readStderr = async () => {
		if (!proc.stderr) return;
		const reader = proc.stderr.getReader();
		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				stderrChunks.push(value);

				// Stream output if callback provided
				if (onOutput) {
					stderrBuffer += decoder.decode(value, { stream: true });
					const lines = stderrBuffer.split('\n');
					stderrBuffer = lines.pop() || '';

					for (const line of lines) {
						onOutput(line, 'stderr');
					}
				}
			}

			// Handle any remaining buffered content
			if (onOutput && stderrBuffer) {
				onOutput(stderrBuffer, 'stderr');
			}
		} catch (error) {
			// Stream closed, ignore
		}
	};

	// Read streams concurrently while process runs
	await Promise.all([
		readStdout(),
		readStderr(),
		proc.exited,
	]);

	clearTimeout(timeoutId);

	const stdout = new TextDecoder().decode(
		Buffer.concat(stdoutChunks.map((chunk) => Buffer.from(chunk))),
	);
	const stderr = new TextDecoder().decode(
		Buffer.concat(stderrChunks.map((chunk) => Buffer.from(chunk))),
	);

	if (killed) {
		return {
			stdout,
			stderr,
			error: "Generation timed out",
		};
	}

	if (proc.exitCode !== 0) {
		return {
			stdout,
			stderr,
			error: `Claude exited with code ${proc.exitCode}`,
		};
	}

	return { stdout, stderr };
}

/**
 * Build prompt for generating candidates
 */
function buildCandidatePrompt(tool: Tool, count: number): string {
	return `You are an expert at writing tool descriptions for AI assistants. Generate ${count} optimized descriptions for the following tool.

Tool Name: ${tool.name}
Current Description: ${tool.description}
Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}

Requirements:
- Each description must be 280 characters or less
- Focus on WHEN to use the tool (trigger conditions)
- Include what NOT to use it for (precision)
- Be specific about required parameters
- Use clear, action-oriented language

Output format (one per line):
CANDIDATE: <description>
EXAMPLE: <optional usage example>

Generate ${count} candidates now:`;
}

/**
 * Build prompt for generating golden prompts
 */
function buildPromptsPrompt(
	tool: Tool,
	counts: { direct: number; indirect: number; negative: number },
): string {
	return `You are an expert at creating test cases for AI tool selection. Generate test prompts for evaluating the following tool description.

Tool Name: ${tool.name}
Description: ${tool.description}
Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}

Generate ${counts.direct + counts.indirect + counts.negative} total prompts across three categories:

1. DIRECT (${counts.direct} prompts): User explicitly names the data source or action
   Example: "Get weather forecast for Paris tomorrow"
   Expected: Tool SHOULD be called

2. INDIRECT (${counts.indirect} prompts): User describes desired outcome without naming tool
   Example: "Should I bring an umbrella to my Paris meeting?"
   Expected: Tool SHOULD be called (Claude infers it's needed)

3. NEGATIVE (${counts.negative} prompts): Other tools or built-in knowledge should handle
   Example: "What's the capital of France?" (general knowledge)
   Expected: Tool should NOT be called (tests precision)

Output format (one per line):
DIRECT: <prompt>
INDIRECT: <prompt>
NEGATIVE: <prompt>

Generate the prompts now:`;
}

/**
 * Parse candidates from Claude output
 */
function parseCandidates(output: string): Array<{ description: string; example?: string }> {
	const candidates: Array<{ description: string; example?: string }> = [];
	const lines = output.split("\n");

	let currentDescription: string | null = null;

	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed.startsWith("CANDIDATE:")) {
			const description = trimmed.substring("CANDIDATE:".length).trim();
			if (description && description.length <= 280) {
				currentDescription = description;
				candidates.push({ description });
			}
		} else if (trimmed.startsWith("EXAMPLE:") && currentDescription) {
			const example = trimmed.substring("EXAMPLE:".length).trim();
			if (example && candidates.length > 0) {
				const lastCandidate = candidates[candidates.length - 1];
				if (lastCandidate) {
					lastCandidate.example = example;
				}
			}
			currentDescription = null;
		}
	}

	return candidates;
}

/**
 * Parse prompts from Claude output
 */
function parsePrompts(
	output: string,
): Array<{ category: "direct" | "indirect" | "negative"; prompt: string; notes?: string }> {
	const prompts: Array<{
		category: "direct" | "indirect" | "negative";
		prompt: string;
		notes?: string;
	}> = [];
	const lines = output.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed.startsWith("DIRECT:")) {
			const prompt = trimmed.substring("DIRECT:".length).trim();
			if (prompt) {
				prompts.push({ category: "direct", prompt });
			}
		} else if (trimmed.startsWith("INDIRECT:")) {
			const prompt = trimmed.substring("INDIRECT:".length).trim();
			if (prompt) {
				prompts.push({ category: "indirect", prompt });
			}
		} else if (trimmed.startsWith("NEGATIVE:")) {
			const prompt = trimmed.substring("NEGATIVE:".length).trim();
			if (prompt) {
				prompts.push({ category: "negative", prompt });
			}
		}
	}

	return prompts;
}
