import type {
	GoldenPrompt,
	OptimizationReport,
	PromotedTool,
	Registry,
	ToolCandidate,
} from "@fiberplane/mcp-gateway-types";
import type { McpServer } from "mcp-lite";
import { z } from "zod";
import { logger } from "../../logger";
import {
	computeMetrics,
	evaluateCandidate,
	shouldPromote,
} from "../../optimization/evaluator";
import {
	generateCandidates,
	generateGoldenPrompts,
} from "../../optimization/generator";
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
	saveEvalRun,
	saveGoldenPrompts,
	savePromotion,
} from "../../optimization/storage";

// Schema for getting canonical tools
const GetCanonicalToolsSchema = z.object({
	server: z.string().describe("Server name to get canonical tools for"),
});

// Schema for proposing a candidate
const ProposeCandidateSchema = z.object({
	server: z.string().describe("Server name"),
	tool: z.string().describe("Tool name"),
	description: z
		.string()
		.max(280, "Description must be 280 characters or less")
		.describe("Rewritten tool description (max 280 characters)"),
	example: z
		.string()
		.optional()
		.describe("Optional example usage of the tool"),
});

// Schema for saving golden prompts
const SaveGoldenPromptsSchema = z.object({
	server: z.string().describe("Server name"),
	tool: z.string().describe("Tool name"),
	prompts: z
		.array(
			z.object({
				id: z.string(),
				toolName: z.string(),
				category: z.enum(["direct", "indirect", "negative"]),
				prompt: z.string().min(10),
				expectedBehavior: z.object({
					shouldCallTool: z.boolean(),
					notes: z.string().optional(),
				}),
			}),
		)
		.describe("Array of golden prompts to save"),
});

// Schema for recording an eval run
const RecordEvalRunSchema = z.object({
	server: z.string().describe("Server name"),
	candidateId: z.string().describe("Candidate ID"),
	promptId: z.string().describe("Prompt ID"),
	result: z
		.object({
			toolCalled: z.boolean().describe("Whether the tool was called"),
			correct: z
				.boolean()
				.describe("Whether the behavior matched expectations"),
			error: z.string().optional().describe("Error message if evaluation failed"),
			reasoning: z.string().optional().describe("Optional reasoning"),
			durationMs: z.number().nonnegative().describe("Evaluation duration in ms"),
		})
		.describe("Evaluation result"),
});

// Schema for getting eval results
const GetEvalResultsSchema = z.object({
	server: z.string().describe("Server name"),
	candidateId: z.string().optional().describe("Filter by specific candidate ID"),
	tool: z.string().optional().describe("Filter by specific tool name"),
});

// Schema for promoting a candidate
const PromoteCandidateSchema = z.object({
	server: z.string().describe("Server name"),
	tool: z.string().describe("Tool name"),
	candidateId: z.string().describe("Candidate ID to promote"),
});

// Schema for reverting optimization
const RevertOptimizationSchema = z.object({
	server: z.string().describe("Server name"),
	tool: z.string().describe("Tool name to revert"),
});

// Schema for generating candidates
const GenerateCandidatesSchema = z.object({
	server: z.string().describe("Server name"),
	tool: z.string().describe("Tool name"),
	count: z
		.number()
		.int()
		.min(1)
		.max(10)
		.default(4)
		.describe("Number of candidates to generate (1-10)"),
});

// Schema for generating golden prompts
const GenerateGoldenPromptsSchema = z.object({
	server: z.string().describe("Server name"),
	tool: z.string().describe("Tool name"),
	directCount: z
		.number()
		.int()
		.min(1)
		.default(5)
		.describe("Number of direct prompts"),
	indirectCount: z
		.number()
		.int()
		.min(1)
		.default(5)
		.describe("Number of indirect prompts"),
	negativeCount: z
		.number()
		.int()
		.min(1)
		.default(5)
		.describe("Number of negative prompts"),
});

// Schema for optimization report
const GetOptimizationReportSchema = z.object({
	server: z.string().optional().describe("Server name (omit for all servers)"),
});

/**
 * Registers optimization tools with the MCP server.
 * These tools enable tool description optimization workflow.
 *
 * @param mcp - The MCP server instance to register tools with
 * @param registry - The gateway's server registry
 * @param storageDir - Directory where optimization data is stored
 */
export function createOptimizationTools(
	mcp: McpServer,
	registry: Registry,
	storageDir: string,
): void {
	// ====================
	// READ TOOLS
	// ====================

	mcp.tool("get_canonical_tools", {
		description: `Get original (unoptimized) tool definitions from a registered MCP server.

Returns the canonical tool definitions that were captured when the server was first added to the gateway. These serve as the baseline for optimization experiments.

Use this tool to:
- See the original tool descriptions before optimization
- Understand what tools are available for optimization
- Get the input schema for each tool (never modified during optimization)

The canonical tools are automatically saved when a server is added to the gateway registry.`,
		inputSchema: GetCanonicalToolsSchema,
		handler: async ({ server }) => {
			try {
				const tools = await loadCanonicalTools(storageDir, server);

				if (tools.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: `No canonical tools found for server '${server}'.\n\nCanonical tools are saved when a server is first added to the gateway. Make sure the server is registered and has been connected at least once.`,
							},
						],
					};
				}

				const toolsList = tools
					.map(
						(tool, idx) =>
							`${idx + 1}. **${tool.name}**\n   Description: ${tool.description}\n   Description Length: ${tool.description.length} chars`,
					)
					.join("\n\n");

				return {
					content: [
						{
							type: "text",
							text: `📋 **Canonical Tools for '${server}'**\n\nFound ${tools.length} tool(s):\n\n${toolsList}\n\n💡 Use propose_candidate to create optimized descriptions for these tools.`,
						},
					],
				};
			} catch (error) {
				logger.error("Failed to get canonical tools", { server, error });
				return {
					content: [
						{
							type: "text",
							text: `❌ Failed to get canonical tools: ${error instanceof Error ? error.message : "Unknown error"}`,
						},
					],
					isError: true,
				};
			}
		},
	});

	mcp.tool("get_eval_results", {
		description: `Get evaluation results and metrics for tool description candidates.

Returns aggregated metrics showing how well candidates perform against golden prompts. Metrics are broken down by category (direct, indirect, negative) and overall success rate.

Use this tool to:
- Compare multiple candidates for the same tool
- Identify the best performing candidate for promotion
- Analyze where candidates succeed or fail (by prompt category)
- Make data-driven decisions about which descriptions work best

Metrics explained:
- Direct success: % of prompts where user explicitly names the data source
- Indirect success: % of prompts where user describes outcome without naming tool
- Negative success: % of prompts where tool correctly NOT called (precision)
- Overall: Combined success rate across all prompt categories`,
		inputSchema: GetEvalResultsSchema,
		handler: async ({ server, candidateId, tool }) => {
			try {
				const allCandidates = await loadAllCandidates(storageDir, server);
				const allRuns = await loadAllEvalRuns(storageDir, server);

				// Filter candidates if tool specified
				let candidatesToShow: ToolCandidate[] = [];
				if (tool) {
					const toolCandidates = allCandidates.get(tool) || [];
					candidatesToShow = toolCandidates;
				} else {
					// Flatten all candidates
					for (const candidates of allCandidates.values()) {
						candidatesToShow.push(...candidates);
					}
				}

				// Filter by candidateId if specified
				if (candidateId) {
					candidatesToShow = candidatesToShow.filter((c) => c.id === candidateId);
				}

				if (candidatesToShow.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: `No candidates found matching the criteria.\n\nServer: ${server}${tool ? `\nTool: ${tool}` : ""}${candidateId ? `\nCandidate ID: ${candidateId}` : ""}`,
							},
						],
					};
				}

				// Compute metrics for each candidate
				const results: Array<{
					candidate: ToolCandidate;
					metrics: ReturnType<typeof computeMetrics> | null;
					runCount: number;
				}> = [];

				for (const candidate of candidatesToShow) {
					const runs = allRuns.get(candidate.id) || [];
					if (runs.length === 0) {
						results.push({ candidate, metrics: null, runCount: 0 });
						continue;
					}

					// Load prompts to compute metrics
					const prompts = await loadGoldenPrompts(
						storageDir,
						server,
						candidate.toolName,
					);
					const metrics = computeMetrics(runs, prompts);
					results.push({ candidate, metrics, runCount: runs.length });
				}

				// Format results
				const resultsList = results
					.map((r) => {
						const { candidate, metrics, runCount } = r;
						const metricsStr = metrics
							? `Direct: ${(metrics.directSuccess * 100).toFixed(1)}% | Indirect: ${(metrics.indirectSuccess * 100).toFixed(1)}% | Negative: ${(metrics.negativeSuccess * 100).toFixed(1)}% | Overall: ${(metrics.overall * 100).toFixed(1)}%`
							: "No evaluation runs yet";

						return `**${candidate.toolName}** (${candidate.id.slice(0, 8)}...)\n  Description: ${candidate.description.slice(0, 80)}${candidate.description.length > 80 ? "..." : ""}\n  Char Count: ${candidate.charCount}\n  Runs: ${runCount}\n  Metrics: ${metricsStr}`;
					})
					.join("\n\n");

				return {
					content: [
						{
							type: "text",
							text: `📊 **Evaluation Results for '${server}'**\n\n${resultsList}\n\n💡 Use promote_candidate to activate the best performing candidate.`,
						},
					],
				};
			} catch (error) {
				logger.error("Failed to get eval results", { server, error });
				return {
					content: [
						{
							type: "text",
							text: `❌ Failed to get eval results: ${error instanceof Error ? error.message : "Unknown error"}`,
						},
					],
					isError: true,
				};
			}
		},
	});

	mcp.tool("get_optimization_report", {
		description: `Get comprehensive optimization report for a server or all servers.

Returns aggregate statistics about tool description optimization efforts, including:
- Number of tools optimized vs total
- Total evaluation runs performed
- Average improvement over canonical descriptions
- Status breakdown (optimized, baseline, unoptimized)

Use this tool to:
- Get a high-level overview of optimization progress
- Track ROI of optimization efforts
- Identify which tools still need optimization
- Generate reports for stakeholders`,
		inputSchema: GetOptimizationReportSchema,
		handler: async ({ server }) => {
			try {
				const serversToReport = server
					? [server]
					: registry.servers.map((s) => s.name);
				const reports: OptimizationReport[] = [];

				for (const serverName of serversToReport) {
					const canonicalTools = await loadCanonicalTools(storageDir, serverName);
					const promotions = await loadPromotions(storageDir, serverName);
					const allRuns = await loadAllEvalRuns(storageDir, serverName);

					const totalRuns = Array.from(allRuns.values()).reduce(
						(sum, runs) => sum + runs.length,
						0,
					);

					const toolStatuses = canonicalTools.map((tool) => {
						const promotion = promotions.get(tool.name);
						if (promotion) {
							return {
								name: tool.name,
								status: "optimized" as const,
								metrics: promotion.metrics,
							};
						}
						return {
							name: tool.name,
							status: "unoptimized" as const,
						};
					});

					// Calculate average improvement
					const optimizedTools = toolStatuses.filter(
						(t) => t.status === "optimized" && t.metrics,
					);
					const avgImprovement =
						optimizedTools.length > 0
							? optimizedTools.reduce(
									(sum, t) => sum + (t.metrics?.overall || 0),
									0,
								) / optimizedTools.length
							: 0;

					reports.push({
						serverName,
						toolCount: canonicalTools.length,
						optimizedCount: promotions.size,
						totalEvals: totalRuns,
						avgImprovement,
						tools: toolStatuses,
					});
				}

				if (reports.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify([]),
							},
						],
					};
				}

				// Return JSON data for programmatic consumption
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(reports),
						},
					],
				};
			} catch (error) {
				logger.error("Failed to generate optimization report", { server, error });
				return {
					content: [
						{
							type: "text",
							text: `❌ Failed to generate report: ${error instanceof Error ? error.message : "Unknown error"}`,
						},
					],
					isError: true,
				};
			}
		},
	});

	// ====================
	// WRITE TOOLS
	// ====================

	mcp.tool("propose_candidate", {
		description: `Submit a rewritten tool description for evaluation.

Creates a new candidate description that can be tested against golden prompts. The description must be 280 characters or less to comply with optimization constraints.

Use this tool when:
- You've manually rewritten a tool description
- You want to test a hypothesis about better phrasing
- You're iterating on description improvements

Best practices for descriptions:
- Start with the core action ("Fetch weather data", "Search files")
- Include when to use it ("Use when user needs future weather")
- List required parameters clearly
- Specify what NOT to use it for (helps precision)
- Stay under 280 characters

After proposing candidates, use generate_golden_prompts and run evaluations to measure effectiveness.`,
		inputSchema: ProposeCandidateSchema,
		handler: async ({ server, tool, description, example }) => {
			try {
				const charCount = description.length;
				if (charCount > 280) {
					return {
						content: [
							{
								type: "text",
								text: `❌ Description exceeds 280 character limit (got ${charCount}).\n\nPlease shorten the description and try again.`,
							},
						],
						isError: true,
					};
				}

				const candidate: ToolCandidate = {
					id: crypto.randomUUID(),
					toolName: tool,
					description,
					example,
					charCount,
					createdAt: new Date().toISOString(),
				};

				await saveCandidate(storageDir, server, tool, candidate);

				return {
					content: [
						{
							type: "text",
							text: `✅ Successfully saved candidate for '${tool}'\n\n**Candidate ID:** ${candidate.id}\n**Character Count:** ${charCount}/280\n**Description:** ${description}\n\n💡 Next steps:\n1. Generate golden prompts: generate_golden_prompts\n2. Run evaluations against prompts\n3. View results: get_eval_results\n4. Promote if successful: promote_candidate`,
						},
					],
				};
			} catch (error) {
				logger.error("Failed to propose candidate", { server, tool, error });
				return {
					content: [
						{
							type: "text",
							text: `❌ Failed to save candidate: ${error instanceof Error ? error.message : "Unknown error"}`,
						},
					],
					isError: true,
				};
			}
		},
	});

	mcp.tool("save_golden_prompts", {
		description: `Save a set of test prompts for evaluating tool descriptions.

Golden prompts are carefully crafted test cases that measure how well a description helps Claude decide when to use a tool. Three categories are used:

**Direct prompts:** User explicitly names the data source or action
- Example: "Get weather forecast for Paris tomorrow"
- Expected: Tool should be called with correct args

**Indirect prompts:** User describes desired outcome without naming tool
- Example: "Should I bring an umbrella to my Paris meeting?"
- Expected: Tool should be called (Claude infers weather needed)

**Negative prompts:** Other tools or built-in knowledge should handle
- Example: "What's the capital of France?" (general knowledge)
- Example: "Book a flight to Paris" (different tool)
- Expected: Tool should NOT be called (tests precision)

Aim for 3-5 prompts per category (9-15 total). Good prompts are realistic, diverse, and clearly belong in their category.`,
		inputSchema: SaveGoldenPromptsSchema,
		handler: async ({ server, tool, prompts }) => {
			try {
				await saveGoldenPrompts(storageDir, server, tool, prompts);

				const byCategoryCount = prompts.reduce(
					(acc, p) => {
						acc[p.category]++;
						return acc;
					},
					{ direct: 0, indirect: 0, negative: 0 },
				);

				return {
					content: [
						{
							type: "text",
							text: `✅ Successfully saved ${prompts.length} golden prompts for '${tool}'\n\n**Breakdown:**\n- Direct: ${byCategoryCount.direct}\n- Indirect: ${byCategoryCount.indirect}\n- Negative: ${byCategoryCount.negative}\n\n💡 Now run evaluations for your candidates to measure effectiveness.`,
						},
					],
				};
			} catch (error) {
				logger.error("Failed to save golden prompts", { server, tool, error });
				return {
					content: [
						{
							type: "text",
							text: `❌ Failed to save golden prompts: ${error instanceof Error ? error.message : "Unknown error"}`,
						},
					],
					isError: true,
				};
			}
		},
	});

	mcp.tool("record_eval_run", {
		description: `Record the result of evaluating a candidate against a test prompt.

This tool is called after running an evaluation session to store the results. The evaluation determines whether the tool was called correctly (matching expected behavior).

Typically you'll:
1. Load candidates and golden prompts
2. For each candidate, for each prompt:
   - Run Claude Code session with the prompt
   - Detect if target tool was called
   - Compare to expected behavior
   - Call this tool to record the result

The accumulated eval runs are used to compute metrics (success rates by category) which inform promotion decisions.`,
		inputSchema: RecordEvalRunSchema,
		handler: async ({ server, candidateId, promptId, result }) => {
			try {
				const run = {
					id: crypto.randomUUID(),
					candidateId,
					promptId,
					timestamp: new Date().toISOString(),
					result,
				};

				await saveEvalRun(storageDir, server, candidateId, run);

				const status = result.correct ? "✅ Correct" : "❌ Incorrect";
				const behavior = result.toolCalled ? "Tool called" : "Tool not called";

				return {
					content: [
						{
							type: "text",
							text: `${status} - Recorded evaluation run\n\n**Run ID:** ${run.id}\n**Candidate ID:** ${candidateId}\n**Prompt ID:** ${promptId}\n**Behavior:** ${behavior}\n**Duration:** ${result.durationMs}ms${result.error ? `\n**Error:** ${result.error}` : ""}\n\n💡 Use get_eval_results to see aggregate metrics.`,
						},
					],
				};
			} catch (error) {
				logger.error("Failed to record eval run", { server, candidateId, error });
				return {
					content: [
						{
							type: "text",
							text: `❌ Failed to record eval run: ${error instanceof Error ? error.message : "Unknown error"}`,
						},
					],
					isError: true,
				};
			}
		},
	});

	// ====================
	// PROMOTION TOOLS
	// ====================

	mcp.tool("promote_candidate", {
		description: `Promote a candidate to production (replaces tool description in gateway).

This activates an optimized description, making it the description that Claude sees when calling the tool through the gateway. The promotion is based on evaluation metrics.

Promotion criteria (configurable):
- Overall success rate ≥ 85%
- Negative success rate ≥ 80% (precision)
- Improvement over baseline ≥ 5 percentage points
- No category regresses more than 10%

Before promoting, ensure:
- You've run evaluations against comprehensive golden prompts
- The candidate performs better than canonical description
- The metrics meet your quality bar

After promotion:
- The gateway immediately uses the new description
- Clients will see improved tool selection behavior
- You can revert with revert_optimization if issues arise`,
		inputSchema: PromoteCandidateSchema,
		handler: async ({ server, tool, candidateId }) => {
			try {
				// Load candidate
				const candidates = await loadCandidates(storageDir, server, tool);
				const candidate = candidates.find((c) => c.id === candidateId);
				if (!candidate) {
					return {
						content: [
							{
								type: "text",
								text: `❌ Candidate '${candidateId}' not found for tool '${tool}'`,
							},
						],
						isError: true,
					};
				}

				// Load eval runs
				const runs = await loadEvalRuns(storageDir, server, candidateId);
				if (runs.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: `❌ No evaluation runs found for candidate '${candidateId}'.\n\nRun evaluations before promoting.`,
							},
						],
						isError: true,
					};
				}

				// Load prompts and compute metrics
				const prompts = await loadGoldenPrompts(storageDir, server, tool);
				const metrics = computeMetrics(runs, prompts);

				// Check promotion criteria (using defaults)
				const canonicalTools = await loadCanonicalTools(storageDir, server);
				const canonicalTool = canonicalTools.find((t) => t.name === tool);

				if (canonicalTool) {
					// TODO: Compute baseline metrics if we have eval runs for canonical
					// For now, we'll skip the shouldPromote check and let user decide
				}

				// Create promotion
				const promotion: PromotedTool = {
					toolName: tool,
					candidateId,
					promotedAt: new Date().toISOString(),
					description: candidate.description,
					metrics,
				};

				await savePromotion(storageDir, server, tool, promotion);

				return {
					content: [
						{
							type: "text",
							text: `✅ Successfully promoted candidate for '${tool}'\n\n**Metrics:**\n- Direct: ${(metrics.directSuccess * 100).toFixed(1)}%\n- Indirect: ${(metrics.indirectSuccess * 100).toFixed(1)}%\n- Negative: ${(metrics.negativeSuccess * 100).toFixed(1)}%\n- Overall: ${(metrics.overall * 100).toFixed(1)}%\n\n**Description:** ${candidate.description}\n\n🎉 The gateway now uses this optimized description for '${tool}'.`,
						},
					],
				};
			} catch (error) {
				logger.error("Failed to promote candidate", {
					server,
					tool,
					candidateId,
					error,
				});
				return {
					content: [
						{
							type: "text",
							text: `❌ Failed to promote candidate: ${error instanceof Error ? error.message : "Unknown error"}`,
						},
					],
					isError: true,
				};
			}
		},
	});

	mcp.tool("revert_optimization", {
		description: `Revert a tool back to its canonical (original) description.

Removes the promoted optimization for a tool, restoring the original description from when the server was first added to the gateway.

Use this when:
- An optimized description causes unexpected behavior
- You want to establish a new baseline
- Rolling back changes for testing

The reversion is immediate - the gateway will use the canonical description for all subsequent tool calls. Historical optimization data (candidates, prompts, eval runs) is preserved for analysis.`,
		inputSchema: RevertOptimizationSchema,
		handler: async ({ server, tool }) => {
			try {
				const promotions = await loadPromotions(storageDir, server);
				const promotion = promotions.get(tool);

				if (!promotion) {
					return {
						content: [
							{
								type: "text",
								text: `❌ No optimization found for tool '${tool}' on server '${server}'.\n\nThe tool is already using its canonical description.`,
							},
						],
						isError: true,
					};
				}

				await deletePromotion(storageDir, server, tool);

				return {
					content: [
						{
							type: "text",
							text: `✅ Successfully reverted optimization for '${tool}'\n\n**Reverted Description:** ${promotion.description}\n\n**Previous Metrics:**\n- Direct: ${(promotion.metrics.directSuccess * 100).toFixed(1)}%\n- Indirect: ${(promotion.metrics.indirectSuccess * 100).toFixed(1)}%\n- Negative: ${(promotion.metrics.negativeSuccess * 100).toFixed(1)}%\n- Overall: ${(promotion.metrics.overall * 100).toFixed(1)}%\n\nThe tool now uses its canonical description.`,
						},
					],
				};
			} catch (error) {
				logger.error("Failed to revert optimization", { server, tool, error });
				return {
					content: [
						{
							type: "text",
							text: `❌ Failed to revert optimization: ${error instanceof Error ? error.message : "Unknown error"}`,
						},
					],
					isError: true,
				};
			}
		},
	});

	// ====================
	// GENERATOR TOOLS (Claude Code subprocess)
	// ====================

	mcp.tool("generate_candidates", {
		description: `Auto-generate optimized description candidates using Claude Code subprocess.

Spawns a Claude Code session to generate multiple description variants for a tool. The generated candidates are automatically saved and ready for evaluation.

The LLM is prompted to create variations optimized for:
- Clarity about when to use the tool
- Precision (avoiding false positives)
- Conciseness (under 280 characters)

Each candidate is automatically saved via propose_candidate. After generation, use generate_golden_prompts and run evaluations to measure effectiveness.`,
		inputSchema: GenerateCandidatesSchema,
		handler: async ({ server, tool, count }) => {
			try {
				// Load canonical tool
				const canonicalTools = await loadCanonicalTools(storageDir, server);
				const canonicalTool = canonicalTools.find((t) => t.name === tool);

				if (!canonicalTool) {
					return {
						content: [
							{
								type: "text",
								text: `❌ Tool '${tool}' not found in canonical tools for server '${server}'.\n\nMake sure the server is registered and connected.`,
							},
						],
						isError: true,
					};
				}

				// Generate candidates using Claude Code subprocess
				logger.info("Generating candidates using Claude Code", {
					server,
					tool,
					count,
				});

				const result = await generateCandidates(canonicalTool, count);

				if (result.error) {
					return {
						content: [
							{
								type: "text",
								text: `❌ Failed to generate candidates: ${result.error}\n\nStderr: ${result.stderr}`,
							},
						],
						isError: true,
					};
				}

				if (result.candidates.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: `⚠️ No candidates were generated. Claude may not have followed the output format.\n\nRaw output:\n${result.stdout}`,
							},
						],
						isError: true,
					};
				}

				// Save each candidate
				const savedCandidates: string[] = [];
				for (const candidate of result.candidates) {
					const toolCandidate: ToolCandidate = {
						id: crypto.randomUUID(),
						toolName: tool,
						description: candidate.description,
						example: candidate.example,
						charCount: candidate.description.length,
						createdAt: new Date().toISOString(),
					};

					await saveCandidate(storageDir, server, tool, toolCandidate);
					savedCandidates.push(
						`${toolCandidate.id.slice(0, 8)}: ${candidate.description.slice(0, 60)}...`,
					);
				}

				return {
					content: [
						{
							type: "text",
							text: `✅ Generated and saved ${result.candidates.length} candidate(s) for '${tool}'\n\n**Saved Candidates:**\n${savedCandidates.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\n💡 Next steps:\n1. Generate golden prompts: generate_golden_prompts\n2. Run evaluations against prompts\n3. View results: get_eval_results\n4. Promote best performer: promote_candidate`,
						},
					],
				};
			} catch (error) {
				logger.error("Failed to generate candidates", { server, tool, error });
				return {
					content: [
						{
							type: "text",
							text: `❌ Failed to generate candidates: ${error instanceof Error ? error.message : "Unknown error"}`,
						},
					],
					isError: true,
				};
			}
		},
	});

	mcp.tool("generate_golden_prompts", {
		description: `Auto-generate test prompts for a tool using Claude Code subprocess.

Spawns a Claude Code session to generate a comprehensive set of golden prompts for evaluating a tool description. Generated prompts are automatically saved and ready for evaluation.

The LLM creates three categories:
- **Direct prompts**: User explicitly names the data source or action
- **Indirect prompts**: User describes outcome without naming tool
- **Negative prompts**: Should use other tools or built-in knowledge (tests precision)

Generated prompts will automatically be saved. After generation, run evaluations for your candidates to measure effectiveness.`,
		inputSchema: GenerateGoldenPromptsSchema,
		handler: async ({ server, tool, directCount, indirectCount, negativeCount }) => {
			try {
				// Load canonical tool
				const canonicalTools = await loadCanonicalTools(storageDir, server);
				const canonicalTool = canonicalTools.find((t) => t.name === tool);

				if (!canonicalTool) {
					return {
						content: [
							{
								type: "text",
								text: `❌ Tool '${tool}' not found in canonical tools for server '${server}'.\n\nMake sure the server is registered and connected.`,
							},
						],
						isError: true,
					};
				}

				// Generate prompts using Claude Code subprocess
				logger.info("Generating golden prompts using Claude Code", {
					server,
					tool,
					directCount,
					indirectCount,
					negativeCount,
				});

				const result = await generateGoldenPrompts(canonicalTool, {
					direct: directCount,
					indirect: indirectCount,
					negative: negativeCount,
				});

				if (result.error) {
					return {
						content: [
							{
								type: "text",
								text: `❌ Failed to generate prompts: ${result.error}\n\nStderr: ${result.stderr}`,
							},
						],
						isError: true,
					};
				}

				if (result.prompts.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: `⚠️ No prompts were generated. Claude may not have followed the output format.\n\nRaw output:\n${result.stdout}`,
							},
						],
						isError: true,
					};
				}

				// Convert to GoldenPrompt format
				const goldenPrompts: GoldenPrompt[] = result.prompts.map((p) => ({
					id: crypto.randomUUID(),
					toolName: tool,
					category: p.category,
					prompt: p.prompt,
					expectedBehavior: {
						shouldCallTool: p.category !== "negative",
						notes: p.notes,
					},
				}));

				// Save prompts
				await saveGoldenPrompts(storageDir, server, tool, goldenPrompts);

				// Count by category
				const byCategoryCount = goldenPrompts.reduce(
					(acc, p) => {
						acc[p.category]++;
						return acc;
					},
					{ direct: 0, indirect: 0, negative: 0 },
				);

				return {
					content: [
						{
							type: "text",
							text: `✅ Generated and saved ${goldenPrompts.length} golden prompt(s) for '${tool}'\n\n**Breakdown:**\n- Direct: ${byCategoryCount.direct}\n- Indirect: ${byCategoryCount.indirect}\n- Negative: ${byCategoryCount.negative}\n\n💡 Now run evaluations for your candidates to measure effectiveness against these prompts.`,
						},
					],
				};
			} catch (error) {
				logger.error("Failed to generate golden prompts", {
					server,
					tool,
					error,
				});
				return {
					content: [
						{
							type: "text",
							text: `❌ Failed to generate golden prompts: ${error instanceof Error ? error.message : "Unknown error"}`,
						},
					],
					isError: true,
				};
			}
		},
	});
}
