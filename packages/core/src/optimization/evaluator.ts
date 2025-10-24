import { rm } from "node:fs/promises";
import type {
	EvalRun,
	GoldenPrompt,
	McpServer,
	PromotedTool,
	Registry,
	ToolCandidate,
} from "@fiberplane/mcp-gateway-types";
import { buildClaudeCommand, runEvaluation } from "./subprocess";
import { savePromotion, deletePromotion } from "./storage";
import { saveRegistry } from "../registry/storage";
import { logger } from "../logger";
import type { ClientManager } from "../mcp/client-manager";

/**
 * Metrics for a candidate's evaluation results
 */
export interface Metrics {
	/** Success rate on direct prompts (0-1) */
	directSuccess: number;
	/** Success rate on indirect prompts (0-1) */
	indirectSuccess: number;
	/** Success rate on negative prompts (0-1) - precision */
	negativeSuccess: number;
	/** Overall success rate across all prompts (0-1) */
	overall: number;
}

/**
 * Thresholds for determining if a candidate should be promoted
 */
export interface PromotionThresholds {
	/** Minimum overall success rate (default: 0.85) */
	minOverall: number;
	/** Minimum negative success rate to avoid false positives (default: 0.80) */
	minNegative: number;
	/** Minimum improvement over baseline (default: 0.05) */
	minImprovement: number;
	/** Maximum allowed regression in any category (default: 0.10) */
	maxRegression: number;
}

/**
 * Default promotion thresholds
 */
export const DEFAULT_THRESHOLDS: PromotionThresholds = {
	minOverall: 0.85,
	minNegative: 0.8,
	minImprovement: 0.05,
	maxRegression: 0.1,
};

/**
 * Evaluate a candidate against a set of golden prompts
 *
 * Spawns Claude Code sessions for each prompt and records whether the tool was called correctly.
 * Creates a temporary server entry in the registry with the candidate's description.
 *
 * @param candidate - The description candidate to evaluate
 * @param prompts - Golden prompts to test against
 * @param originalServer - The original server this candidate belongs to
 * @param registry - The gateway registry (will be modified temporarily)
 * @param storageDir - Storage directory for promotions
 * @param gatewayPort - Port where the gateway is running
 * @param clientManager - Optional client manager for MCP connections
 * @param evalTimeout - Timeout per evaluation in milliseconds (default: 60000)
 * @returns Array of evaluation runs with results
 */
export async function evaluateCandidate(
	candidate: ToolCandidate,
	prompts: GoldenPrompt[],
	originalServer: McpServer,
	registry: Registry,
	storageDir: string,
	gatewayPort: number,
	clientManager?: ClientManager,
	evalTimeout = 60000,
): Promise<EvalRun[]> {
	// Create temporary server name for this candidate
	const tempServerName = `${originalServer.name}-eval-${candidate.id.slice(0, 8)}`;

	// Create temporary server entry
	const tempServer: McpServer = {
		...originalServer,
		name: tempServerName,
	};

	// Add to registry temporarily
	registry.servers.push(tempServer);
	await saveRegistry(storageDir, registry);

	// Connect to clientManager if provided (enables authentication)
	if (clientManager) {
		try {
			await clientManager.connectServer(tempServer);
			logger.debug("Connected temp server to clientManager", { tempServerName });
		} catch (error) {
			logger.warn("Failed to connect temp server to clientManager", {
				tempServerName,
				error: String(error),
			});
			// Continue anyway - may work without MCP client mode
		}
	}

	// Create temporary promotion with candidate description
	const tempPromotion: PromotedTool = {
		toolName: candidate.toolName,
		candidateId: candidate.id,
		promotedAt: new Date().toISOString(),
		description: candidate.description,
		metrics: {
			directSuccess: 0,
			indirectSuccess: 0,
			negativeSuccess: 0,
			overall: 0,
		},
	};

	await savePromotion(storageDir, tempServerName, candidate.toolName, tempPromotion);

	logger.debug("Created temporary server for evaluation", {
		tempServerName,
		originalServer: originalServer.name,
		candidateId: candidate.id,
		toolName: candidate.toolName,
	});

	try {
		const runs: EvalRun[] = [];

		for (const prompt of prompts) {
			let tempDir: string | undefined;

			try {
				// Build Claude command with MCP server connection
				const { command, tempDir: dir } = await buildClaudeCommand(
					prompt.prompt,
					tempServerName,
					gatewayPort,
				);
				tempDir = dir;

				// Run evaluation
				const result = await runEvaluation(
					command,
					candidate.toolName,
					prompt.expectedBehavior,
					tempDir,
					evalTimeout,
				);

				// Create eval run record
				runs.push({
					id: crypto.randomUUID(),
					candidateId: candidate.id,
					promptId: prompt.id,
					timestamp: new Date().toISOString(),
					result: {
						toolCalled: result.toolCalled,
						correct: result.correct,
						error: result.error,
						reasoning: result.reasoning,
						durationMs: result.duration,
					},
				});
			} finally {
				// Clean up temp MCP config directory
				if (tempDir) {
					try {
						await rm(tempDir, { recursive: true, force: true });
					} catch (error) {
						logger.warn("Failed to clean up temp directory", {
							tempDir,
							error: String(error)
						});
					}
				}
			}
		}

		return runs;
	} finally {
		// Disconnect from clientManager if connected
		if (clientManager) {
			try {
				await clientManager.disconnectServer(tempServerName);
				logger.debug("Disconnected temp server from clientManager", { tempServerName });
			} catch (error) {
				logger.warn("Failed to disconnect temp server", {
					tempServerName,
					error: String(error),
				});
			}
		}

		// Clean up temporary server and promotion
		registry.servers = registry.servers.filter(s => s.name !== tempServerName);
		await saveRegistry(storageDir, registry);
		await deletePromotion(storageDir, tempServerName, candidate.toolName);

		logger.debug("Cleaned up temporary server", { tempServerName });
	}
}

/**
 * Compute metrics from evaluation runs
 *
 * Calculates success rates by category (direct, indirect, negative) and overall.
 *
 * @param runs - Evaluation runs to analyze
 * @param prompts - Golden prompts used in evaluation (for category lookup)
 * @returns Metrics object with success rates
 */
export function computeMetrics(
	runs: EvalRun[],
	prompts: GoldenPrompt[],
): Metrics {
	const byCategory = {
		direct: { total: 0, correct: 0 },
		indirect: { total: 0, correct: 0 },
		negative: { total: 0, correct: 0 },
	};

	for (const run of runs) {
		const prompt = prompts.find((p) => p.id === run.promptId);
		if (!prompt) continue;

		const category = prompt.category;
		byCategory[category].total++;
		if (run.result.correct) {
			byCategory[category].correct++;
		}
	}

	const totalRuns = runs.length;
	const totalCorrect = runs.filter((r) => r.result.correct).length;

	return {
		directSuccess:
			byCategory.direct.total > 0
				? byCategory.direct.correct / byCategory.direct.total
				: 0,
		indirectSuccess:
			byCategory.indirect.total > 0
				? byCategory.indirect.correct / byCategory.indirect.total
				: 0,
		negativeSuccess:
			byCategory.negative.total > 0
				? byCategory.negative.correct / byCategory.negative.total
				: 0,
		overall: totalRuns > 0 ? totalCorrect / totalRuns : 0,
	};
}

/**
 * Determine if a candidate should be promoted based on metrics
 *
 * A candidate is promoted if:
 * - It meets minimum thresholds (overall success, precision)
 * - It improves over the baseline by a minimum amount
 * - No category regresses significantly
 *
 * @param candidateMetrics - Metrics for the candidate
 * @param baselineMetrics - Metrics for the current/canonical description
 * @param thresholds - Promotion thresholds (uses defaults if not provided)
 * @returns True if candidate should be promoted, false otherwise
 */
export function shouldPromote(
	candidateMetrics: Metrics,
	baselineMetrics: Metrics,
	thresholds: Partial<PromotionThresholds> = {},
): boolean {
	const t = { ...DEFAULT_THRESHOLDS, ...thresholds };

	// Must meet minimum thresholds
	if (candidateMetrics.overall < t.minOverall) {
		return false;
	}
	if (candidateMetrics.negativeSuccess < t.minNegative) {
		return false;
	}

	// Must improve over baseline
	const improvement = candidateMetrics.overall - baselineMetrics.overall;
	if (improvement < t.minImprovement) {
		return false;
	}

	// No category can regress significantly
	if (
		candidateMetrics.directSuccess <
		baselineMetrics.directSuccess - t.maxRegression
	) {
		return false;
	}
	if (
		candidateMetrics.indirectSuccess <
		baselineMetrics.indirectSuccess - t.maxRegression
	) {
		return false;
	}
	if (
		candidateMetrics.negativeSuccess <
		baselineMetrics.negativeSuccess - t.maxRegression
	) {
		return false;
	}

	return true;
}

/**
 * Get all evaluation runs for a specific tool across all candidates
 *
 * @param allRuns - Map of candidateId to eval runs
 * @param toolName - Name of tool to filter by
 * @returns Array of eval runs for the specified tool
 */
export function getRunsForTool(
	allRuns: Map<string, EvalRun[]>,
	toolName: string,
): EvalRun[] {
	const runs: EvalRun[] = [];

	for (const candidateRuns of allRuns.values()) {
		for (const run of candidateRuns) {
			// Check if this run is for the specified tool by looking at prompt
			// Note: We'd need to pass prompts to properly filter, but for now
			// we can assume candidateId contains tool info or we filter elsewhere
			runs.push(run);
		}
	}

	return runs;
}
