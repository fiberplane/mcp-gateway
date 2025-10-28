import {
  loadRegistry,
  logger,
  openBrowser,
  loadCanonicalTools,
  generateCandidates,
  generateGoldenPrompts,
  evaluateCandidate,
  computeMetrics,
  shouldPromote,
  saveCandidate,
  saveGoldenPrompts,
  saveEvalRun,
  savePromotion,
  loadGoldenPrompts,
  loadCandidates,
  loadEvalRuns,
  loadPromotions,
} from "@fiberplane/mcp-gateway-core";
import type {
  Tool,
  ToolCandidate,
  GoldenPrompt,
  PromotedTool
} from "@fiberplane/mcp-gateway-types";
import { useKeyboard } from "@opentui/react";
import { useEffect, useState } from "react";
import { toUIServer, useAppStore } from "../../store";
import { useTheme } from "../../theme-context";
import { RoundedBox } from "../ui/RoundedBox";
import { OptimizationDebug } from "./OptimizationDebug";

export function OptimizationView() {
  const theme = useTheme();
  const servers = useAppStore((state) => state.servers);
  const optimizations = useAppStore((state) => state.optimizations);
  const loadOptimizations = useAppStore((state) => state.loadOptimizations);
  const port = useAppStore((state) => state.port);

  // Debug: log server data
  useEffect(() => {
    logger.info("OptimizationView server state", {
      serverCount: servers.length,
      servers: servers.map(s => ({
        name: s.name,
        hasAuthUrl: !!s.authUrl,
        authUrl: s.authUrl,
        authError: s.authError,
      }))
    });
  }, [servers]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [selectedServerIndex, setSelectedServerIndex] = useState(0);
  const [authorizingServer, setAuthorizingServer] = useState<string | null>(null);

  // Optimization workflow state
  type WorkflowStep =
    | "idle"
    | "tool-selection"
    | "config"
    | "generating"
    | "preview-candidates"
    | "evaluating"
    | "results";

  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("idle");
  const [workflowServer, setWorkflowServer] = useState<string | null>(null);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [selectedToolIndex, setSelectedToolIndex] = useState(0);

  // Configuration state
  const [candidateCount, setCandidateCount] = useState(3);
  const [directPromptCount, setDirectPromptCount] = useState(2);
  const [indirectPromptCount, setIndirectPromptCount] = useState(2);
  const [negativePromptCount, setNegativePromptCount] = useState(2);
  const [configFieldIndex, setConfigFieldIndex] = useState(0); // 0=candidates, 1=direct, 2=indirect, 3=negative

  // Generation state
  const [generatedCandidates, setGeneratedCandidates] = useState<Map<string, ToolCandidate[]>>(new Map());
  const [generatedPrompts, setGeneratedPrompts] = useState<Map<string, GoldenPrompt[]>>(new Map());
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);

  // Evaluation state
  const [evaluationResults, setEvaluationResults] = useState<Map<string, { candidate: ToolCandidate; metrics: any; evalRuns: any[] }[]>>(new Map());
  const [evaluationProgress, setEvaluationProgress] = useState<string | null>(null);

  // Subprocess output state
  const [subprocessOutput, setSubprocessOutput] = useState<string[]>([]);
  const [cancelRequested, setCancelRequested] = useState(false);

  // Results detail view state
  const [selectedToolResultIndex, setSelectedToolResultIndex] = useState(0);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const [showDetailedResults, setShowDetailedResults] = useState(false);

  // Idle view detail state
  const [showIdleDetails, setShowIdleDetails] = useState(false);
  const [idleDetailServerName, setIdleDetailServerName] = useState<string | null>(null);
  const [idleDetailToolName, setIdleDetailToolName] = useState<string | null>(null);
  const [idleDetailData, setIdleDetailData] = useState<{
    original: Tool | null;
    candidates: ToolCandidate[];
    prompts: GoldenPrompt[];
    evalRuns: Map<string, any[]>;
    promoted: PromotedTool | null;
  } | null>(null);

  // Keyboard handlers
  useKeyboard((key) => {
    if (key.name === "d") {
      setShowDebug((prev) => !prev);
      return;
    }

    // Escape cancels workflow
    if (key.name === "escape" && workflowStep !== "idle") {
      // Request cancellation for long-running operations
      if (workflowStep === "generating" || workflowStep === "evaluating") {
        setCancelRequested(true);
        logger.info("Cancellation requested");
        return;
      }

      // Immediate cancel for other steps
      setWorkflowStep("idle");
      setWorkflowServer(null);
      setSelectedTools(new Set());
      setError(null);
      setSubprocessOutput([]);
      setCancelRequested(false);
      return;
    }

    // Handle workflow-specific navigation
    if (workflowStep === "tool-selection") {
      if (key.name === "up") {
        setSelectedToolIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.name === "down") {
        setSelectedToolIndex((prev) => Math.min(availableTools.length - 1, prev + 1));
        return;
      }
      if (key.name === "space") {
        const tool = availableTools[selectedToolIndex];
        if (tool) {
          setSelectedTools((prev) => {
            const next = new Set(prev);
            if (next.has(tool.name)) {
              next.delete(tool.name);
            } else {
              next.add(tool.name);
            }
            return next;
          });
        }
        return;
      }
      if (key.name === "return") {
        if (selectedTools.size > 0) {
          setWorkflowStep("config");
        }
        return;
      }
      return;
    }

    if (workflowStep === "config") {
      if (key.name === "up") {
        setConfigFieldIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.name === "down") {
        setConfigFieldIndex((prev) => Math.min(3, prev + 1));
        return;
      }
      if (key.name === "+" || key.name === "=") {
        // Increase selected field
        if (configFieldIndex === 0) {
          setCandidateCount((prev) => Math.min(5, prev + 1));
        } else if (configFieldIndex === 1) {
          setDirectPromptCount((prev) => Math.min(5, prev + 1));
        } else if (configFieldIndex === 2) {
          setIndirectPromptCount((prev) => Math.min(5, prev + 1));
        } else if (configFieldIndex === 3) {
          setNegativePromptCount((prev) => Math.min(5, prev + 1));
        }
        return;
      }
      if (key.name === "-" || key.name === "_") {
        // Decrease selected field
        if (configFieldIndex === 0) {
          setCandidateCount((prev) => Math.max(1, prev - 1));
        } else if (configFieldIndex === 1) {
          setDirectPromptCount((prev) => Math.max(1, prev - 1));
        } else if (configFieldIndex === 2) {
          setIndirectPromptCount((prev) => Math.max(1, prev - 1));
        } else if (configFieldIndex === 3) {
          setNegativePromptCount((prev) => Math.max(1, prev - 1));
        }
        return;
      }
      if (key.name === "return") {
        startGeneration();
        return;
      }
      return;
    }

    if (workflowStep === "preview-candidates") {
      if (key.name === "return") {
        startEvaluation();
        return;
      }
      return;
    }

    if (workflowStep === "results") {
      if (showDetailedResults) {
        // Detailed results navigation
        if (key.name === "escape") {
          setShowDetailedResults(false);
          return;
        }
        if (key.name === "left") {
          setSelectedToolResultIndex((prev) => Math.max(0, prev - 1));
          setSelectedCandidateIndex(0);
          return;
        }
        if (key.name === "right") {
          setSelectedToolResultIndex((prev) => Math.min(evaluationResults.size - 1, prev + 1));
          setSelectedCandidateIndex(0);
          return;
        }
        if (key.name === "up") {
          const toolResults = Array.from(evaluationResults.values())[selectedToolResultIndex];
          if (toolResults) {
            setSelectedCandidateIndex((prev) => Math.max(0, prev - 1));
          }
          return;
        }
        if (key.name === "down") {
          const toolResults = Array.from(evaluationResults.values())[selectedToolResultIndex];
          if (toolResults) {
            setSelectedCandidateIndex((prev) => Math.min(toolResults.length - 1, prev + 1));
          }
          return;
        }
        return;
      }

      // Summary results view
      if (key.name === "return") {
        promoteBestCandidates();
        return;
      }
      if (key.name === "space") {
        setShowDetailedResults(true);
        setSelectedToolResultIndex(0);
        setSelectedCandidateIndex(0);
        return;
      }
      return;
    }

    // Default idle state navigation
    if (workflowStep === "idle") {
      // Handle detail view
      if (showIdleDetails) {
        if (key.name === "escape") {
          setShowIdleDetails(false);
          setIdleDetailData(null);
          return;
        }
        if (key.name === "up") {
          if (idleDetailData && selectedCandidateIndex > 0) {
            setSelectedCandidateIndex((prev) => prev - 1);
          }
          return;
        }
        if (key.name === "down") {
          if (idleDetailData) {
            setSelectedCandidateIndex((prev) => Math.min(idleDetailData.candidates.length - 1, prev + 1));
          }
          return;
        }
        if (key.name === "left" || key.name === "right") {
          // Navigate to next/previous optimized tool
          if (!idleDetailServerName) return;

          const optimization = optimizations.get(idleDetailServerName);
          if (!optimization) return;

          const optimizedTools = Array.from(optimization.tools.values()).filter((t) => t.promoted);
          const currentIndex = optimizedTools.findIndex((t) => t.toolName === idleDetailToolName);

          if (currentIndex === -1) return;

          let nextIndex = currentIndex;
          if (key.name === "left") {
            nextIndex = Math.max(0, currentIndex - 1);
          } else {
            nextIndex = Math.min(optimizedTools.length - 1, currentIndex + 1);
          }

          const nextTool = optimizedTools[nextIndex];
          if (nextTool && nextTool.toolName !== idleDetailToolName) {
            viewToolDetails(idleDetailServerName, nextTool.toolName);
          }
          return;
        }
        return;
      }

      // Normal idle navigation
      if (key.name === "up") {
        setSelectedServerIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key.name === "down") {
        setSelectedServerIndex((prev) => Math.min(servers.length - 1, prev + 1));
        return;
      }

      if (key.name === "return") {
        const selectedServer = servers[selectedServerIndex];
        if (!selectedServer) return;

        if (selectedServer.authUrl) {
          handleAuthorize(selectedServer.name, selectedServer.authUrl);
        } else {
          // Start optimization workflow
          startOptimizationWorkflow(selectedServer.name);
        }
      }

      if (key.name === "space") {
        const selectedServer = servers[selectedServerIndex];
        if (!selectedServer) return;

        // Show details for first optimized tool
        const optimization = optimizations.get(selectedServer.name);
        if (optimization) {
          const optimizedTools = Array.from(optimization.tools.values()).filter((t) => t.promoted);
          if (optimizedTools.length > 0 && optimizedTools[0]) {
            viewToolDetails(selectedServer.name, optimizedTools[0].toolName);
          }
        }
      }
    }
  });

  // Handle authorization flow
  async function handleAuthorize(serverName: string, authUrl: string) {
    try {
      setAuthorizingServer(serverName);

      // Authorization URL is already built by mcp-lite with PKCE
      logger.info("Opening authorization URL", { authUrl });

      // Open browser
      await openBrowser(authUrl);

      // Reset after 2 seconds
      setTimeout(() => {
        setAuthorizingServer(null);
      }, 2000);
    } catch (err) {
      setAuthorizingServer(null);
      setError(err instanceof Error ? err.message : "Failed to open browser");
    }
  }

  // Start optimization workflow
  async function startOptimizationWorkflow(serverName: string) {
    try {
      setError(null);
      setWorkflowServer(serverName);

      const storageDir = useAppStore.getState().storageDir;

      // Load available tools
      const tools = await loadCanonicalTools(storageDir, serverName);
      if (tools.length === 0) {
        setError("No tools found for this server");
        return;
      }

      setAvailableTools(tools as Tool[]);
      setSelectedTools(new Set());
      setSelectedToolIndex(0);
      setWorkflowStep("tool-selection");

      logger.info("Started optimization workflow", {
        serverName,
        toolCount: tools.length,
      });
    } catch (err) {
      logger.error("Failed to start workflow", { error: String(err) });
      setError(err instanceof Error ? err.message : "Failed to start workflow");
    }
  }

  // Start candidate and prompt generation
  async function startGeneration() {
    if (!workflowServer) return;

    try {
      setWorkflowStep("generating");
      setGenerationProgress("Starting generation...");
      setError(null);
      setSubprocessOutput([]);
      setCancelRequested(false);

      const storageDir = useAppStore.getState().storageDir;
      const toolsToOptimize = availableTools.filter((t) => selectedTools.has(t.name));

      const candidates = new Map<string, ToolCandidate[]>();
      const prompts = new Map<string, GoldenPrompt[]>();

      for (let i = 0; i < toolsToOptimize.length; i++) {
        // Check cancellation
        if (cancelRequested) {
          logger.info("Generation cancelled by user");
          setWorkflowStep("idle");
          setWorkflowServer(null);
          setSelectedTools(new Set());
          setSubprocessOutput([]);
          setCancelRequested(false);
          return;
        }

        const tool = toolsToOptimize[i];
        if (!tool) continue;

        setGenerationProgress(`Tool ${i + 1}/${toolsToOptimize.length}: ${tool.name} - Generating candidates...`);
        setSubprocessOutput([`Generating ${candidateCount} candidates for ${tool.name}...`]);

        const candidatesResult = await generateCandidates(tool, candidateCount);

        // Capture output
        if (candidatesResult.stdout) {
          setSubprocessOutput((prev) => [...prev, ...candidatesResult.stdout.split("\n").filter(Boolean).slice(-20)]);
        }

        if (candidatesResult.error || candidatesResult.candidates.length === 0) {
          logger.error("Failed to generate candidates", {
            toolName: tool.name,
            error: candidatesResult.error,
          });
          setSubprocessOutput((prev) => [...prev, `ERROR: ${candidatesResult.error || "No candidates generated"}`]);
          continue;
        }

        // Check cancellation again
        if (cancelRequested) {
          logger.info("Generation cancelled by user");
          setWorkflowStep("idle");
          setWorkflowServer(null);
          setSelectedTools(new Set());
          setSubprocessOutput([]);
          setCancelRequested(false);
          return;
        }

        setGenerationProgress(`Tool ${i + 1}/${toolsToOptimize.length}: ${tool.name} - Generating test prompts...`);
        setSubprocessOutput([`Generating test prompts for ${tool.name}...`]);

        const promptsResult = await generateGoldenPrompts(tool, {
          direct: directPromptCount,
          indirect: indirectPromptCount,
          negative: negativePromptCount,
        });

        // Capture output
        if (promptsResult.stdout) {
          setSubprocessOutput((prev) => [...prev, ...promptsResult.stdout.split("\n").filter(Boolean).slice(-20)]);
        }

        if (promptsResult.error || promptsResult.prompts.length === 0) {
          logger.error("Failed to generate prompts", {
            toolName: tool.name,
            error: promptsResult.error,
          });
          setSubprocessOutput((prev) => [...prev, `ERROR: ${promptsResult.error || "No prompts generated"}`]);
          continue;
        }

        // Create candidate records
        const candidateRecords: ToolCandidate[] = candidatesResult.candidates.map((c) => ({
          id: crypto.randomUUID(),
          toolName: tool.name,
          description: c.description,
          example: c.example,
          charCount: c.description.length,
          createdAt: new Date().toISOString(),
        }));

        // Create golden prompts
        const goldenPrompts: GoldenPrompt[] = promptsResult.prompts.map((p) => ({
          id: crypto.randomUUID(),
          toolName: tool.name,
          category: p.category,
          prompt: p.prompt,
          expectedBehavior: {
            shouldCallTool: p.category !== "negative",
            notes: p.notes,
          },
        }));

        candidates.set(tool.name, candidateRecords);
        prompts.set(tool.name, goldenPrompts);

        // Save to disk
        await saveGoldenPrompts(storageDir, workflowServer, tool.name, goldenPrompts);
      }

      setGeneratedCandidates(candidates);
      setGeneratedPrompts(prompts);
      setGenerationProgress(null);
      setSubprocessOutput([]);
      setWorkflowStep("preview-candidates");

      logger.info("Generation complete", {
        toolCount: candidates.size,
      });
    } catch (err) {
      logger.error("Generation failed", { error: String(err) });
      setError(err instanceof Error ? err.message : "Generation failed");
      setGenerationProgress(null);
    }
  }

  // Start evaluation
  async function startEvaluation() {
    if (!workflowServer) return;

    try {
      setWorkflowStep("evaluating");
      setEvaluationProgress("Starting evaluation...");
      setError(null);
      setSubprocessOutput([]);
      setCancelRequested(false);

      const storageDir = useAppStore.getState().storageDir;
      const gatewayPort = useAppStore.getState().port;
      const clientManager = useAppStore.getState().clientManager;
      const results = new Map<string, { candidate: ToolCandidate; metrics: any; evalRuns: any[] }[]>();

      // Load registry to get original server
      const registry = await loadRegistry(storageDir);
      const originalServer = registry.servers.find(s => s.name === workflowServer);

      if (!originalServer) {
        setError(`Server '${workflowServer}' not found in registry`);
        setWorkflowStep("idle");
        return;
      }

      let toolIndex = 0;
      for (const [toolName, candidates] of generatedCandidates) {
        // Check cancellation
        if (cancelRequested) {
          logger.info("Evaluation cancelled by user");
          setWorkflowStep("idle");
          setWorkflowServer(null);
          setSelectedTools(new Set());
          setGeneratedCandidates(new Map());
          setGeneratedPrompts(new Map());
          setSubprocessOutput([]);
          setCancelRequested(false);
          return;
        }

        toolIndex++;
        const prompts = generatedPrompts.get(toolName);
        if (!prompts) continue;

        const toolResults: { candidate: ToolCandidate; metrics: any; evalRuns: any[] }[] = [];

        for (let i = 0; i < candidates.length; i++) {
          // Check cancellation
          if (cancelRequested) {
            logger.info("Evaluation cancelled by user");
            setWorkflowStep("idle");
            setWorkflowServer(null);
            setSelectedTools(new Set());
            setGeneratedCandidates(new Map());
            setGeneratedPrompts(new Map());
            setSubprocessOutput([]);
            setCancelRequested(false);
            return;
          }

          const candidate = candidates[i];
          if (!candidate) continue;

          setEvaluationProgress(
            `Tool ${toolIndex}/${generatedCandidates.size}: ${toolName} - Evaluating candidate ${i + 1}/${candidates.length}...`
          );
          setSubprocessOutput([
            `Running ${prompts.length} evaluations for candidate ${i + 1}/${candidates.length}`,
            `Testing: "${candidate.description.substring(0, 60)}..."`,
          ]);

          const evalRuns = await evaluateCandidate(
            candidate,
            prompts,
            originalServer,
            registry,
            storageDir,
            gatewayPort,
            clientManager
          );

          // Show results summary
          const correct = evalRuns.filter((r) => r.result.correct).length;
          setSubprocessOutput((prev) => [
            ...prev,
            `Completed: ${correct}/${evalRuns.length} correct`,
          ]);

          // Save evaluation runs
          for (const run of evalRuns) {
            await saveEvalRun(storageDir, workflowServer, candidate.id, run);
          }

          const metrics = computeMetrics(evalRuns, prompts);

          toolResults.push({ candidate, metrics, evalRuns });

          // Save candidate
          await saveCandidate(storageDir, workflowServer, toolName, candidate);
        }

        results.set(toolName, toolResults);
      }

      setEvaluationResults(results);
      setEvaluationProgress(null);
      setSubprocessOutput([]);
      setWorkflowStep("results");

      logger.info("Evaluation complete");
    } catch (err) {
      logger.error("Evaluation failed", { error: String(err) });
      setError(err instanceof Error ? err.message : "Evaluation failed");
      setEvaluationProgress(null);
    }
  }

  // View details for a tool from idle view
  async function viewToolDetails(serverName: string, toolName: string) {
    try {
      const storageDir = useAppStore.getState().storageDir;

      // Load original tool
      const canonicalTools = await loadCanonicalTools(storageDir, serverName);
      const originalTool = canonicalTools.find((t) => t.name === toolName) as Tool | undefined;

      // Load candidates
      const candidates = await loadCandidates(storageDir, serverName, toolName);

      // Load prompts
      const prompts = await loadGoldenPrompts(storageDir, serverName, toolName);

      // Load eval runs for all candidates
      const evalRunsMap = new Map<string, any[]>();
      for (const candidate of candidates) {
        const runs = await loadEvalRuns(storageDir, serverName, candidate.id);
        evalRunsMap.set(candidate.id, runs);
      }

      // Load promotions
      const promotions = await loadPromotions(storageDir, serverName);
      const promoted = promotions.get(toolName) || null;

      setIdleDetailData({
        original: originalTool || null,
        candidates,
        prompts,
        evalRuns: evalRunsMap,
        promoted,
      });

      setIdleDetailServerName(serverName);
      setIdleDetailToolName(toolName);
      setSelectedCandidateIndex(0);
      setShowIdleDetails(true);

      logger.info("Loaded tool details", {
        serverName,
        toolName,
        candidateCount: candidates.length,
        promptCount: prompts.length,
      });
    } catch (err) {
      logger.error("Failed to load tool details", {
        serverName,
        toolName,
        error: String(err),
      });
      setError(err instanceof Error ? err.message : "Failed to load tool details");
    }
  }

  // Promote best candidates
  async function promoteBestCandidates() {
    if (!workflowServer) return;

    try {
      setError(null);
      const storageDir = useAppStore.getState().storageDir;

      for (const [toolName, results] of evaluationResults) {
        // Find best candidate
        const best = results.reduce((prev, curr) =>
          curr.metrics.overall > prev.metrics.overall ? curr : prev
        );

        // Save promotion
        const promotion: PromotedTool = {
          toolName,
          candidateId: best.candidate.id,
          promotedAt: new Date().toISOString(),
          description: best.candidate.description,
          metrics: best.metrics,
        };

        await savePromotion(storageDir, workflowServer, toolName, promotion);

        logger.info("Promoted best candidate", {
          toolName,
          candidateId: best.candidate.id,
          metrics: best.metrics,
        });
      }

      // Reload optimization data
      await loadOptimizations();

      // Return to idle state
      setWorkflowStep("idle");
      setWorkflowServer(null);
      setSelectedTools(new Set());
      setGeneratedCandidates(new Map());
      setGeneratedPrompts(new Map());
      setEvaluationResults(new Map());

      logger.info("Promotion complete");
    } catch (err) {
      logger.error("Promotion failed", { error: String(err) });
      setError(err instanceof Error ? err.message : "Promotion failed");
    }
  }

  // Render idle detail view for already-optimized tools
  function renderIdleDetailView() {
    if (!idleDetailData || !idleDetailToolName) return null;

    const selectedCandidate = idleDetailData.candidates[selectedCandidateIndex];
    if (!selectedCandidate) return null;

    const originalDesc = idleDetailData.original?.description || "N/A";
    const evalRuns = idleDetailData.evalRuns.get(selectedCandidate.id) || [];

    // Compute metrics from eval runs
    const metrics = computeMetrics(evalRuns, idleDetailData.prompts);

    const isPromoted = idleDetailData.promoted?.candidateId === selectedCandidate.id;

    return (
      <box style={{ flexDirection: "column", padding: 1, gap: 1 }}>
        <box style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
          <text fg={theme.accent}>
            {idleDetailToolName} - Candidate {selectedCandidateIndex + 1}/{idleDetailData.candidates.length}
          </text>
          <text fg={theme.foregroundMuted}>
            {idleDetailServerName}
          </text>
        </box>

        <RoundedBox style={{ padding: 2 }}>
          <box style={{ flexDirection: "column", gap: 1 }}>
            {/* Show if this candidate is promoted */}
            {isPromoted ? (
              <text fg={theme.accent}>✓ Currently Promoted</text>
            ) : null}

            {/* Metrics Summary */}
            <text fg={theme.accent}>
              Overall: {Math.round(metrics.overall * 100)}%
            </text>
            <text fg={theme.foreground}>
              Direct: {Math.round(metrics.directSuccess * 100)}% •
              Indirect: {Math.round(metrics.indirectSuccess * 100)}% •
              Negative: {Math.round(metrics.negativeSuccess * 100)}%
            </text>

            <box style={{ height: 1 }} />

            {/* Original Description */}
            <text fg={theme.foreground}>Original Description:</text>
            <text fg={theme.foregroundMuted}>{originalDesc}</text>

            <box style={{ height: 1 }} />

            {/* New Description */}
            <text fg={theme.foreground}>
              {isPromoted ? "Current Description:" : "Candidate Description:"}
            </text>
            <text fg={isPromoted ? theme.accent : theme.foreground}>
              {selectedCandidate.description}
            </text>

            <box style={{ height: 1 }} />

            {/* Evaluation Results */}
            <text fg={theme.foreground}>Evaluation Results ({evalRuns.length} tests):</text>
            {evalRuns.slice(0, 10).map((run: any) => {
              const prompt = idleDetailData.prompts.find((p) => p.id === run.promptId);
              if (!prompt) return null;

              const statusIcon = run.result.correct ? "✓" : "✗";
              const statusColor = run.result.correct ? theme.accent : theme.foreground;

              return (
                <text key={run.id} fg={statusColor}>
                  {statusIcon} [{prompt.category}] {prompt.prompt.substring(0, 80)}
                </text>
              );
            })}
            {evalRuns.length > 10 ? (
              <text fg={theme.foregroundMuted}>
                ... and {evalRuns.length - 10} more tests
              </text>
            ) : null}
          </box>
        </RoundedBox>

        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          [←→] Switch Tool • [↑↓] Switch Candidate • [Esc] Back to Server List
        </text>
      </box>
    );
  }

  // Render tool selection screen
  function renderToolSelection() {
    return (
      <box style={{ flexDirection: "column", padding: 1, gap: 1 }}>
        <box style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
          <text fg={theme.accent}>Select Tools to Optimize</text>
          <text fg={theme.foregroundMuted}>
            [{selectedTools.size} selected]
          </text>
        </box>

        <RoundedBox style={{ padding: 2 }}>
          <box style={{ flexDirection: "column", gap: 0 }}>
            {availableTools.map((tool, index) => {
              const isSelected = index === selectedToolIndex;
              const isChecked = selectedTools.has(tool.name);

              return (
                <text key={tool.name} fg={isSelected ? theme.accent : theme.foreground}>
                  {isSelected ? "▶ " : "  "}[{isChecked ? "✓" : " "}] {tool.name}
                </text>
              );
            })}
          </box>
        </RoundedBox>

        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          [↑↓] Navigate • [Space] Toggle • [Enter] Continue • [Esc] Cancel
        </text>
      </box>
    );
  }

  // Render configuration screen
  function renderConfiguration() {
    return (
      <box style={{ flexDirection: "column", padding: 1, gap: 1 }}>
        <box style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
          <text fg={theme.accent}>Configure Optimization</text>
          <text fg={theme.foregroundMuted}>
            {selectedTools.size} tools selected
          </text>
        </box>

        <RoundedBox style={{ padding: 2 }}>
          <box style={{ flexDirection: "column", gap: 1 }}>
            <text fg={configFieldIndex === 0 ? theme.accent : theme.foreground}>
              {configFieldIndex === 0 ? "▶ " : "  "}Candidates per tool: {candidateCount}
            </text>
            <text fg={theme.foregroundMuted}>
              Number of description variations to generate (1-5)
            </text>

            <box style={{ height: 1 }} />

            <text fg={theme.foreground}>
              Test prompts:
            </text>
            <text fg={configFieldIndex === 1 ? theme.accent : theme.foregroundMuted}>
              {configFieldIndex === 1 ? "▶ " : "  "}• Direct prompts: {directPromptCount} (explicit tool mentions)
            </text>
            <text fg={configFieldIndex === 2 ? theme.accent : theme.foregroundMuted}>
              {configFieldIndex === 2 ? "▶ " : "  "}• Indirect prompts: {indirectPromptCount} (implied usage)
            </text>
            <text fg={configFieldIndex === 3 ? theme.accent : theme.foregroundMuted}>
              {configFieldIndex === 3 ? "▶ " : "  "}• Negative prompts: {negativePromptCount} (should NOT use tool)
            </text>

            <box style={{ height: 1 }} />

            <text fg={theme.accent}>
              Total evaluations: {selectedTools.size} tools × {candidateCount} candidates × {directPromptCount + indirectPromptCount + negativePromptCount} prompts = {selectedTools.size * candidateCount * (directPromptCount + indirectPromptCount + negativePromptCount)} runs
            </text>
          </box>
        </RoundedBox>

        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          [↑↓] Navigate • [+/-] Adjust • [Enter] Start Generation • [Esc] Cancel
        </text>
      </box>
    );
  }

  // Render generation progress
  function renderGeneration() {
    return (
      <box style={{ flexDirection: "column", padding: 1, gap: 1 }}>
        <box style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
          <text fg={theme.accent}>Generating Candidates & Test Prompts...</text>
          {cancelRequested ? (
            <text fg={theme.foreground}>Cancelling...</text>
          ) : null}
        </box>

        <RoundedBox style={{ padding: 2 }}>
          <box style={{ flexDirection: "column", gap: 0 }}>
            <text fg={theme.foreground}>{generationProgress || "Initializing..."}</text>

            {subprocessOutput.length > 0 ? (
              <>
                <box style={{ height: 1 }} />
                <text fg={theme.foregroundMuted}>Claude Output:</text>
                {subprocessOutput.slice(-10).map((line, i) => (
                  <text key={i} fg={theme.foregroundMuted}>
                    {line.substring(0, 120)}
                  </text>
                ))}
              </>
            ) : null}
          </box>
        </RoundedBox>

        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          [Esc] Cancel
        </text>
      </box>
    );
  }

  // Render candidate preview
  function renderCandidatePreview() {
    return (
      <box style={{ flexDirection: "column", padding: 1, gap: 1 }}>
        <box style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
          <text fg={theme.accent}>Preview Generated Candidates</text>
          <text fg={theme.foregroundMuted}>
            {generatedCandidates.size} tools ready
          </text>
        </box>

        <RoundedBox style={{ padding: 2 }}>
          <box style={{ flexDirection: "column", gap: 1 }}>
            {Array.from(generatedCandidates.entries()).map(([toolName, candidates]) => (
              <box key={toolName} style={{ flexDirection: "column", gap: 0 }}>
                <text fg={theme.accent}>{toolName}</text>
                {candidates.slice(0, 2).map((c, i) => (
                  <text key={c.id} fg={theme.foregroundMuted}>
                    {i + 1}. {c.description.substring(0, 80)}{c.description.length > 80 ? "..." : ""}
                  </text>
                ))}
                {candidates.length > 2 ? (
                  <text fg={theme.foregroundMuted}>
                    + {candidates.length - 2} more candidates
                  </text>
                ) : null}
                <box style={{ height: 1 }} />
              </box>
            ))}
          </box>
        </RoundedBox>

        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          [Enter] Start Evaluation • [Esc] Cancel
        </text>
      </box>
    );
  }

  // Render evaluation progress
  function renderEvaluation() {
    return (
      <box style={{ flexDirection: "column", padding: 1, gap: 1 }}>
        <box style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
          <text fg={theme.accent}>Evaluating Candidates...</text>
          {cancelRequested ? (
            <text fg={theme.foreground}>Cancelling...</text>
          ) : null}
        </box>

        <RoundedBox style={{ padding: 2 }}>
          <box style={{ flexDirection: "column", gap: 0 }}>
            <text fg={theme.foreground}>{evaluationProgress || "Initializing..."}</text>

            {subprocessOutput.length > 0 ? (
              <>
                <box style={{ height: 1 }} />
                <text fg={theme.foregroundMuted}>Claude Output:</text>
                {subprocessOutput.slice(-10).map((line, i) => (
                  <text key={i} fg={theme.foregroundMuted}>
                    {line.substring(0, 120)}
                  </text>
                ))}
              </>
            ) : null}
          </box>
        </RoundedBox>

        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          [Esc] Cancel
        </text>
      </box>
    );
  }

  // Render detailed results view
  function renderDetailedResults() {
    const toolEntries = Array.from(evaluationResults.entries());
    if (toolEntries.length === 0) return null;

    const [toolName, results] = toolEntries[selectedToolResultIndex] || [];
    if (!toolName || !results) return null;

    const selectedResult = results[selectedCandidateIndex];
    if (!selectedResult) return null;

    // Get original description
    const originalTool = availableTools.find((t) => t.name === toolName);
    const originalDesc = originalTool?.description || "N/A";

    // Get prompts for this tool
    const prompts = generatedPrompts.get(toolName) || [];

    return (
      <box style={{ flexDirection: "column", padding: 1, gap: 1 }}>
        <box style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
          <text fg={theme.accent}>
            {toolName} - Candidate {selectedCandidateIndex + 1}/{results.length}
          </text>
          <text fg={theme.foregroundMuted}>
            Tool {selectedToolResultIndex + 1}/{toolEntries.length}
          </text>
        </box>

        <RoundedBox style={{ padding: 2 }}>
          <box style={{ flexDirection: "column", gap: 1 }}>
            {/* Metrics Summary */}
            <text fg={theme.accent}>
              Overall: {Math.round(selectedResult.metrics.overall * 100)}%
            </text>
            <text fg={theme.foreground}>
              Direct: {Math.round(selectedResult.metrics.directSuccess * 100)}% •
              Indirect: {Math.round(selectedResult.metrics.indirectSuccess * 100)}% •
              Negative: {Math.round(selectedResult.metrics.negativeSuccess * 100)}%
            </text>

            <box style={{ height: 1 }} />

            {/* Original Description */}
            <text fg={theme.foreground}>Original Description:</text>
            <text fg={theme.foregroundMuted}>{originalDesc}</text>

            <box style={{ height: 1 }} />

            {/* New Description */}
            <text fg={theme.foreground}>Optimized Description:</text>
            <text fg={theme.accent}>{selectedResult.candidate.description}</text>

            <box style={{ height: 1 }} />

            {/* Evaluation Results */}
            <text fg={theme.foreground}>Evaluation Results:</text>
            {selectedResult.evalRuns.map((run: any, idx: number) => {
              const prompt = prompts.find((p) => p.id === run.promptId);
              if (!prompt) return null;

              const statusIcon = run.result.correct ? "✓" : "✗";
              const statusColor = run.result.correct ? theme.accent : theme.foreground;

              return (
                <text key={run.id} fg={statusColor}>
                  {statusIcon} [{prompt.category}] {prompt.prompt.substring(0, 80)}
                </text>
              );
            })}
          </box>
        </RoundedBox>

        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          [←→] Switch Tool • [↑↓] Switch Candidate • [Esc] Back to Summary
        </text>
      </box>
    );
  }

  // Render results and promotion interface
  function renderResults() {
    if (showDetailedResults) {
      return renderDetailedResults();
    }

    return (
      <box style={{ flexDirection: "column", padding: 1, gap: 1 }}>
        <box style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
          <text fg={theme.accent}>Evaluation Results</text>
          <text fg={theme.foregroundMuted}>
            {evaluationResults.size} tools evaluated
          </text>
        </box>

        <RoundedBox style={{ padding: 2 }}>
          <box style={{ flexDirection: "column", gap: 1 }}>
            {Array.from(evaluationResults.entries()).map(([toolName, results]) => {
              // Find best candidate
              const best = results.reduce((prev, curr) =>
                curr.metrics.overall > prev.metrics.overall ? curr : prev
              );

              const overallPct = Math.round(best.metrics.overall * 100);
              const directPct = Math.round(best.metrics.directSuccess * 100);
              const indirectPct = Math.round(best.metrics.indirectSuccess * 100);
              const negativePct = Math.round(best.metrics.negativeSuccess * 100);
              const descPreview = best.candidate.description.substring(0, 100);
              const needsEllipsis = best.candidate.description.length > 100;

              return (
                <box key={toolName} style={{ flexDirection: "column", gap: 0 }}>
                  <text fg={theme.accent}>{toolName}</text>
                  <text fg={theme.foreground}>
                    Best candidate: {overallPct}% overall
                  </text>
                  <text fg={theme.foregroundMuted}>
                    Direct: {directPct}% • Indirect: {indirectPct}% • Negative: {negativePct}%
                  </text>
                  <text fg={theme.foregroundMuted}>
                    {descPreview}{needsEllipsis ? "..." : ""}
                  </text>
                  <box style={{ height: 1 }} />
                </box>
              );
            })}
          </box>
        </RoundedBox>

        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          [Space] Detailed View • [Enter] Promote Best Candidates • [Esc] Cancel
        </text>
      </box>
    );
  }

  // Load optimization data and refresh registry when view mounts
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        // Reload registry from disk to get latest authUrl
        const storageDir = useAppStore.getState().storageDir;
        const setServers = useAppStore.getState().setServers;

        logger.info("Reloading registry for optimization view");

        const registry = await loadRegistry(storageDir);
        const uiServers = registry.servers.map(s => toUIServer(s));
        setServers(uiServers);

        logger.info("Registry reloaded in OptimizationView", {
          servers: uiServers.map(s => ({ name: s.name, hasAuthUrl: !!s.authUrl }))
        });

        // Then load optimization data
        await loadOptimizations();
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load optimizations");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [loadOptimizations]);

  // Show debug view if toggled
  if (showDebug) {
    return <OptimizationDebug />;
  }

  // Show idle detail view
  if (showIdleDetails && idleDetailData) {
    return renderIdleDetailView();
  }

  // Render different views based on workflow step
  if (workflowStep === "tool-selection") {
    return renderToolSelection();
  }

  if (workflowStep === "config") {
    return renderConfiguration();
  }

  if (workflowStep === "generating") {
    return renderGeneration();
  }

  if (workflowStep === "preview-candidates") {
    return renderCandidatePreview();
  }

  if (workflowStep === "evaluating") {
    return renderEvaluation();
  }

  if (workflowStep === "results") {
    return renderResults();
  }

  // Default idle view
  return (
    <box
      style={{
        flexDirection: "column",
        padding: 1,
        gap: 1,
      }}
    >
      <box
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 1,
        }}
      >
        <text fg={theme.foregroundMuted}>Tool Description Optimization</text>
        <text fg={theme.foregroundMuted}>
          [↑↓] Navigate • [Enter] Authorize/Optimize • [Space] View Details • [d] Debug
        </text>
      </box>

      {loading ? (
        <RoundedBox
          style={{
            padding: 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <text fg={theme.foregroundMuted}>
            Loading optimization data...
          </text>
        </RoundedBox>
      ) : error ? (
        <RoundedBox
          style={{
            padding: 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <text fg={theme.foreground}>Error: {error}</text>
          <text fg={theme.foregroundMuted}>
            Make sure gateway is running with --enable-mcp-client flag
          </text>
        </RoundedBox>
      ) : servers.length === 0 ? (
        <RoundedBox
          style={{
            padding: 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <text fg={theme.foregroundMuted}>
            No servers configured. Add a server to get started.
          </text>
        </RoundedBox>
      ) : (
        <box style={{ flexDirection: "column", gap: 1 }}>
          {servers.map((server, index) => {
            const optimization = optimizations.get(server.name);
            const optimizedCount = optimization?.optimizedCount ?? 0;
            const totalCount = optimization?.toolCount ?? 0;
            const progressDots =
              totalCount > 0
                ? "●".repeat(optimizedCount) + "○".repeat(totalCount - optimizedCount)
                : "○○○○○";
            const isSelected = index === selectedServerIndex;
            const isAuthorizing = authorizingServer === server.name;

            return (
              <RoundedBox
                key={server.name}
                style={{
                  padding: 1,
                  borderColor: isSelected ? theme.accent : theme.border,
                }}
              >
                <box
                  style={{
                    flexDirection: "column",
                    gap: 1,
                  }}
                >
                  {/* Server header */}
                  <box
                    style={{
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <text fg={theme.accent}>
                      {server.name}
                    </text>
                    <text fg={theme.foregroundMuted}>
                      {progressDots} {optimizedCount}/{totalCount} tools optimized
                    </text>
                  </box>

                  {/* Auth URL if server requires authentication */}
                  {server.authUrl ? (
                    <box
                      style={{
                        flexDirection: "column",
                        gap: 0,
                        padding: 1,
                        backgroundColor: isSelected ? theme.border : undefined,
                      }}
                    >
                      {isAuthorizing ? (
                        <>
                          <text fg={theme.accent}>
                            🌐 Opening browser...
                          </text>
                          <text fg={theme.foregroundMuted}>
                            Complete authorization in your browser
                          </text>
                        </>
                      ) : (
                        <>
                          <text fg={theme.foreground}>
                            🔒 Authentication Required
                          </text>
                          {isSelected ? (
                            <text fg={theme.accent}>
                              ▶ Press Enter to authorize
                            </text>
                          ) : null}
                          <text fg={theme.foregroundMuted}>
                            {server.authUrl}
                          </text>
                        </>
                      )}
                    </box>
                  ) : null}

                  {/* Status message */}
                  {!server.authUrl && totalCount === 0 ? (
                    <text fg={theme.foregroundMuted}>
                      No tools discovered yet. Ensure server is connected.
                    </text>
                  ) : !server.authUrl && optimizedCount === 0 ? (
                    <text fg={theme.foregroundMuted}>
                      No tools optimized yet. Press Enter to start optimization.
                    </text>
                  ) : (
                    <box style={{ flexDirection: "column", gap: 0 }}>
                      {/* Show first few optimized tools */}
                      {Array.from(optimization?.tools.values() ?? [])
                        .filter((tool) => tool.promoted)
                        .slice(0, 3)
                        .map((tool) => {
                          const overallPct = tool.promoted?.metrics
                            ? Math.round(tool.promoted.metrics.overall * 100)
                            : 0;
                          return (
                            <text key={tool.toolName} fg={theme.accent}>
                              ✓ {tool.toolName} - Overall: {overallPct}%
                            </text>
                          );
                        })}
                      {/* Show unoptimized count */}
                      {totalCount - optimizedCount > 0 ? (
                        <text fg={theme.foregroundMuted}>
                          ○ {totalCount - optimizedCount} more tools not optimized
                        </text>
                      ) : null}
                    </box>
                  )}
                </box>
              </RoundedBox>
            );
          })}
        </box>
      )}

      {/* Help text */}
      <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
        Note: Optimization requires --enable-mcp-client flag
      </text>
    </box>
  );
}
