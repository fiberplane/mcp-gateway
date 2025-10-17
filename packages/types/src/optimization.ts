import { z } from "zod";

// ToolCandidate schema - A rewritten tool description candidate
export const toolCandidateSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  description: z.string().max(280),
  example: z.string().optional(),
  charCount: z.number().int().positive(),
  createdAt: z.string().datetime(),
});

export type ToolCandidate = z.infer<typeof toolCandidateSchema>;

// GoldenPrompt schema - Test prompt for evaluating candidates
export const goldenPromptSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  category: z.enum(["direct", "indirect", "negative"]),
  prompt: z.string().min(10),
  expectedBehavior: z.object({
    shouldCallTool: z.boolean(),
    notes: z.string().optional(),
  }),
});

export type GoldenPrompt = z.infer<typeof goldenPromptSchema>;

// EvalRun schema - Result of running one evaluation
export const evalRunSchema = z.object({
  id: z.string(),
  candidateId: z.string(),
  promptId: z.string(),
  timestamp: z.string().datetime(),
  result: z.object({
    toolCalled: z.boolean(),
    correct: z.boolean(),
    error: z.string().optional(),
    reasoning: z.string().optional(),
    durationMs: z.number().nonnegative(),
  }),
});

export type EvalRun = z.infer<typeof evalRunSchema>;

// PromotedTool schema - Winning candidate that's been promoted
export const promotedToolSchema = z.object({
  toolName: z.string(),
  candidateId: z.string(),
  promotedAt: z.string().datetime(),
  description: z.string(),
  metrics: z.object({
    directSuccess: z.number().min(0).max(1),
    indirectSuccess: z.number().min(0).max(1),
    negativeSuccess: z.number().min(0).max(1),
    overall: z.number().min(0).max(1),
  }),
});

export type PromotedTool = z.infer<typeof promotedToolSchema>;

// OptimizationReport schema - Summary report of optimization status
export const optimizationReportSchema = z.object({
  serverName: z.string(),
  toolCount: z.number().int().positive(),
  optimizedCount: z.number().int().nonnegative(),
  totalEvals: z.number().int().nonnegative(),
  avgImprovement: z.number(),
  tools: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["optimized", "baseline", "unoptimized"]),
      metrics: z
        .object({
          directSuccess: z.number().min(0).max(1),
          indirectSuccess: z.number().min(0).max(1),
          negativeSuccess: z.number().min(0).max(1),
          overall: z.number().min(0).max(1),
        })
        .optional(),
    }),
  ),
});

export type OptimizationReport = z.infer<typeof optimizationReportSchema>;
