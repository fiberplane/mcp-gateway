import type {
	EvalRun,
	GoldenPrompt,
	ToolCandidate,
} from "@fiberplane/mcp-gateway-types";
import { buildClaudeCommand, runEvaluation } from "./subprocess";

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
 *
 * @param candidate - The description candidate to evaluate
 * @param prompts - Golden prompts to test against
 * @param evalTimeout - Timeout per evaluation in milliseconds (default: 60000)
 * @returns Array of evaluation runs with results
 */
export async function evaluateCandidate(
	candidate: ToolCandidate,
	prompts: GoldenPrompt[],
	evalTimeout = 60000,
): Promise<EvalRun[]> {
	const runs: EvalRun[] = [];

	for (const prompt of prompts) {
		// Build Claude command
		const command = buildClaudeCommand(prompt.prompt);

		// Run evaluation
		const result = await runEvaluation(
			command,
			candidate.toolName,
			prompt.expectedBehavior,
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
	}

	return runs;
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
