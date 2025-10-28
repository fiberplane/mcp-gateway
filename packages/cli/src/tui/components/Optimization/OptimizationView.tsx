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
    | "cache-preview"
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

  // Cache preview state
  const [cachedData, setCachedData] = useState<Map<string, { candidates: ToolCandidate[]; prompts: GoldenPrompt[] }>>(new Map());
  const [toolsWithoutCache, setToolsWithoutCache] = useState<string[]>([]);

  // Evaluation state
  const [evaluationResults, setEvaluationResults] = useState<Map<string, { candidate: ToolCandidate; metrics: any; evalRuns: any[] }[]>>(new Map());
  const [evaluationProgress, setEvaluationProgress] = useState<string | null>(null);

  // Subprocess output state
  const [subprocessOutput, setSubprocessOutput] = useState<string[]>([]);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [cancelledToolNames, setCancelledToolNames] = useState<Set<string>>(new Set());
  const [runningToolNames, setRunningToolNames] = useState<Set<string>>(new Set());

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
      setCancelledToolNames(new Set());
      setRunningToolNames(new Set());
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
          setCandidateCount((prev) => Math.min(20, prev + 1));
        } else if (configFieldIndex === 1) {
          setDirectPromptCount((prev) => Math.min(20, prev + 1));
        } else if (configFieldIndex === 2) {
          setIndirectPromptCount((prev) => Math.min(20, prev + 1));
        } else if (configFieldIndex === 3) {
          setNegativePromptCount((prev) => Math.min(20, prev + 1));
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
        checkCacheAndProceed();
        return;
      }
      return;
    }

    if (workflowStep === "cache-preview") {
      if (key.name === "return") {
        // Use cached data
        useCachedData();
        return;
      }
      if (key.sequence === "r" || key.sequence === "R") {
        // Regenerate fresh data
        startGeneration(true); // force regenerate
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

    if (workflowStep === "evaluating") {
      // Handle 1-9 keys to cancel individual tools
      if (key.sequence && /^[1-9]$/.test(key.sequence)) {
        const toolIndex = parseInt(key.sequence, 10) - 1;
        const runningTools = Array.from(runningToolNames);
        const toolToCancel = runningTools[toolIndex];

        if (toolToCancel) {
          logger.info(`Cancelling evaluation for tool: ${toolToCancel}`);
          setCancelledToolNames((prev) => {
            const next = new Set(prev);
            next.add(toolToCancel);
            return next;
          });
        }
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

  // Check cache and show preview if data exists
  async function checkCacheAndProceed() {
    if (!workflowServer) return;

    try {
      const storageDir = useAppStore.getState().storageDir;
      const toolsToOptimize = availableTools.filter((t) => selectedTools.has(t.name));

      const cachedDataMap = new Map<string, { candidates: ToolCandidate[]; prompts: GoldenPrompt[] }>();
      const toolsWithoutCacheList: string[] = [];

      // Calculate expected prompt count based on configuration
      const expectedPromptCount = directPromptCount + indirectPromptCount + negativePromptCount;

      // Check cache for all selected tools
      for (const tool of toolsToOptimize) {
        const cachedCandidates = await loadCandidates(storageDir, workflowServer, tool.name);
        const cachedPrompts = await loadGoldenPrompts(storageDir, workflowServer, tool.name);

        if (cachedCandidates.length > 0 && cachedPrompts.length > 0) {
          // Slice to match current configuration
          const slicedCandidates = cachedCandidates.slice(0, candidateCount);

          // Slice prompts proportionally to match configured counts
          const directPrompts = cachedPrompts.filter(p => p.category === "direct").slice(0, directPromptCount);
          const indirectPrompts = cachedPrompts.filter(p => p.category === "indirect").slice(0, indirectPromptCount);
          const negativePrompts = cachedPrompts.filter(p => p.category === "negative").slice(0, negativePromptCount);
          const slicedPrompts = [...directPrompts, ...indirectPrompts, ...negativePrompts];

          // Only use cache if we have enough data to satisfy the configuration
          if (slicedCandidates.length === candidateCount && slicedPrompts.length === expectedPromptCount) {
            cachedDataMap.set(tool.name, { candidates: slicedCandidates, prompts: slicedPrompts });
          } else {
            // Not enough cached data for current config - need to regenerate
            toolsWithoutCacheList.push(tool.name);
          }
        } else {
          toolsWithoutCacheList.push(tool.name);
        }
      }

      if (cachedDataMap.size > 0) {
        // Some tools have cached data - show preview
        setCachedData(cachedDataMap);
        setToolsWithoutCache(toolsWithoutCacheList);
        setWorkflowStep("cache-preview");
      } else {
        // No cached data - go directly to generation
        startGeneration();
      }
    } catch (err) {
      logger.error("Failed to check cache", { error: String(err) });
      setError(err instanceof Error ? err.message : "Failed to check cache");
    }
  }

  // Use cached data and skip generation (go directly to evaluation)
  async function useCachedData() {
    if (!workflowServer) return;

    try {
      const storageDir = useAppStore.getState().storageDir;
      const candidates = new Map<string, ToolCandidate[]>();
      const prompts = new Map<string, GoldenPrompt[]>();

      // Load cached data for tools that have it
      for (const [toolName, data] of cachedData.entries()) {
        candidates.set(toolName, data.candidates);
        prompts.set(toolName, data.prompts);
      }

      // Generate fresh data for tools without cache
      if (toolsWithoutCache.length > 0) {
        logger.info("Generating fresh data for tools without cache", { tools: toolsWithoutCache });
        // We'll need to generate these - for now, just proceed with what we have
        // TODO: Optionally generate for missing tools
      }

      logger.info("Using cached data", {
        candidateCount: candidates.size,
        candidateKeys: Array.from(candidates.keys()),
        promptCount: prompts.size,
      });

      setGeneratedCandidates(candidates);
      setGeneratedPrompts(prompts);

      // Skip the duplicate preview and go directly to evaluation
      // (we already showed the preview in cache-preview step)
      // Pass data directly since setState is async
      startEvaluation(candidates, prompts);
    } catch (err) {
      logger.error("Failed to use cached data", { error: String(err) });
      setError(err instanceof Error ? err.message : "Failed to use cached data");
    }
  }

  // Start candidate and prompt generation
  async function startGeneration(forceRegenerate = false) {
    if (!workflowServer) return;

    try {
      const toolsToOptimize = availableTools.filter((t) => selectedTools.has(t.name));

      logger.info("Starting generation", {
        forceRegenerate,
        selectedToolCount: selectedTools.size,
        selectedTools: Array.from(selectedTools),
        toolsToOptimizeCount: toolsToOptimize.length,
      });

      setWorkflowStep("generating");
      setGenerationProgress("Starting generation...");
      setError(null);
      setSubprocessOutput([]);
      setCancelRequested(false);
      setCancelledToolNames(new Set());
      setRunningToolNames(new Set());

      const storageDir = useAppStore.getState().storageDir;

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

        // Generate fresh data (skip cache check when forceRegenerate is true)
        setGenerationProgress(`Tool ${i + 1}/${toolsToOptimize.length}: ${tool.name} - Generating candidates...`);
        setSubprocessOutput((prev) => [...prev, "", `=== Generating ${candidateCount} candidates for ${tool.name} ===`]);

        const candidatesResult = await generateCandidates(
          tool,
          candidateCount,
          60000,
          (line, stream) => {
            setSubprocessOutput((prev) => [...prev.slice(-99), line]);
          }
        );

        if (candidatesResult.error || candidatesResult.candidates.length === 0) {
          logger.error("Failed to generate candidates", {
            toolName: tool.name,
            error: candidatesResult.error,
          });
          setSubprocessOutput((prev) => [...prev, `ERROR: ${candidatesResult.error || "No candidates generated"}`]);
          continue;
        }

        // Show generated candidates summary
        setSubprocessOutput((prev) => [
          ...prev,
          "",
          `✓ Generated ${candidatesResult.candidates.length} candidates:`,
          ...candidatesResult.candidates.map((c, idx) => `  ${idx + 1}. [${c.description.length} chars] ${c.description.substring(0, 150)}${c.description.length > 150 ? "..." : ""}`),
        ]);

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
        setSubprocessOutput((prev) => [...prev, "", `=== Generating test prompts for ${tool.name} ===`]);

        const promptsResult = await generateGoldenPrompts(
          tool,
          {
            direct: directPromptCount,
            indirect: indirectPromptCount,
            negative: negativePromptCount,
          },
          60000,
          (line, stream) => {
            setSubprocessOutput((prev) => [...prev.slice(-99), line]);
          }
        );

        if (promptsResult.error || promptsResult.prompts.length === 0) {
          logger.error("Failed to generate prompts", {
            toolName: tool.name,
            error: promptsResult.error,
          });
          setSubprocessOutput((prev) => [...prev, `ERROR: ${promptsResult.error || "No prompts generated"}`]);
          continue;
        }

        // Show generated prompts summary
        const directCount = promptsResult.prompts.filter(p => p.category === "direct").length;
        const indirectCount = promptsResult.prompts.filter(p => p.category === "indirect").length;
        const negativeCount = promptsResult.prompts.filter(p => p.category === "negative").length;

        setSubprocessOutput((prev) => [
          ...prev,
          "",
          `✓ Generated ${promptsResult.prompts.length} test prompts: ${directCount} direct, ${indirectCount} indirect, ${negativeCount} negative`,
          ...promptsResult.prompts.slice(0, 10).map((p) => `  [${p.category.toUpperCase()}] ${p.prompt.substring(0, 120)}${p.prompt.length > 120 ? "..." : ""}`),
          ...(promptsResult.prompts.length > 10 ? [`  ... and ${promptsResult.prompts.length - 10} more`] : []),
        ]);

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
        for (const candidate of candidateRecords) {
          await saveCandidate(storageDir, workflowServer, tool.name, candidate);
        }
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
  async function startEvaluation(
    candidatesParam?: Map<string, ToolCandidate[]>,
    promptsParam?: Map<string, GoldenPrompt[]>
  ) {
    if (!workflowServer) return;

    // Use passed parameters or fall back to state (for ENTER key press from preview-candidates)
    const candidates = candidatesParam ?? generatedCandidates;
    const prompts = promptsParam ?? generatedPrompts;

    try {
      logger.info("Starting evaluation", {
        candidateCount: candidates.size,
        candidateKeys: Array.from(candidates.keys()),
        promptCount: prompts.size,
      });

      setWorkflowStep("evaluating");
      setEvaluationProgress("Starting evaluation...");
      setError(null);
      setSubprocessOutput([]);
      setCancelRequested(false);

      const storageDir = useAppStore.getState().storageDir;
      const gatewayPort = useAppStore.getState().port;
      const clientManager = useAppStore.getState().clientManager;
      const results = new Map<string, { candidate: ToolCandidate; metrics: any; evalRuns: any[] }[]>();

      // Get registry from app store (shared with HTTP server)
      const registry = useAppStore.getState().registry;

      if (!registry) {
        setError("Registry not initialized");
        setWorkflowStep("idle");
        return;
      }

      const originalServer = registry.servers.find(s => s.name === workflowServer);

      if (!originalServer) {
        setError(`Server '${workflowServer}' not found in registry`);
        setWorkflowStep("idle");
        return;
      }

      // Check cancellation before starting
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

      setEvaluationProgress(
        `Evaluating ${candidates.size} tools concurrently...`
      );

      // Initialize running tools
      const allToolNames = Array.from(candidates.keys());
      setRunningToolNames(new Set(allToolNames));
      setCancelledToolNames(new Set());

      // Evaluate all tools concurrently
      const toolEvaluations = Array.from(candidates.entries()).map(
        async ([toolName, toolCandidates]) => {
          const toolPrompts = prompts.get(toolName);
          if (!toolPrompts) {
            setRunningToolNames((prev) => {
              const next = new Set(prev);
              next.delete(toolName);
              return next;
            });
            return { toolName, results: [] };
          }

          // Evaluate all candidates for this tool concurrently
          const candidateEvaluations = toolCandidates.map(async (candidate, i) => {
            // Check global cancellation or tool-specific cancellation
            if (cancelRequested || cancelledToolNames.has(toolName)) {
              logger.info(`Evaluation cancelled for tool ${toolName}`);
              return null;
            }

            if (!candidate) return null;

            // Update subprocess output with tool-specific header
            setSubprocessOutput((prev) => [
              ...prev.slice(-99),
              `[${toolName}#${i + 1}] Starting: "${candidate.description.substring(0, 50)}..."`,
            ]);

            const evalRuns = await evaluateCandidate(
              candidate,
              toolPrompts,
              originalServer,
              registry,
              storageDir,
              gatewayPort,
              clientManager,
              60000, // timeout
              (line, stream) => {
                // Stream subprocess output to TUI with tool name prefix (keep last 100 lines)
                setSubprocessOutput((prev) => [
                  ...prev.slice(-99),
                  `[${toolName}#${i + 1}] ${line}`,
                ]);
              }
            );

            // Show results summary
            const correct = evalRuns.filter((r) => r.result.correct).length;
            setSubprocessOutput((prev) => [
              ...prev.slice(-99),
              `[${toolName}#${i + 1}] Completed: ${correct}/${evalRuns.length} correct`,
            ]);

            // Save evaluation runs
            for (const run of evalRuns) {
              await saveEvalRun(storageDir, workflowServer, candidate.id, run);
            }

            const metrics = computeMetrics(evalRuns, toolPrompts);

            // Save candidate
            await saveCandidate(storageDir, workflowServer, toolName, candidate);

            return { candidate, metrics, evalRuns };
          });

          // Wait for all candidates in this tool to complete
          const candidateResults = await Promise.all(candidateEvaluations);
          const toolResults = candidateResults.filter((r): r is { candidate: ToolCandidate; metrics: any; evalRuns: any[] } => r !== null);

          // Mark tool as complete
          setRunningToolNames((prev) => {
            const next = new Set(prev);
            next.delete(toolName);
            return next;
          });

          return { toolName, results: toolResults };
        }
      );

      // Wait for all tool evaluations to complete
      const evaluationResults = await Promise.all(toolEvaluations);

      // Aggregate results
      for (const { toolName, results: toolResults } of evaluationResults) {
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
                <box key={run.id} style={{ flexDirection: "column" }}>
                  <text fg={statusColor}>
                    {statusIcon} [{prompt.category}] {prompt.prompt.substring(0, 80)}
                  </text>
                  {run.result.error ? (
                    <text fg={theme.foregroundMuted} style={{ marginLeft: 2 }}>
                      ↳ {run.result.error.split('\n')[0].substring(0, 100)}
                    </text>
                  ) : null}
                </box>
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
      <box style={{ flexDirection: "column", padding: 1 }}>
        <box style={{ justifyContent: "space-between" }}>
          <text fg={theme.accent}>Select Tools to Optimize ({selectedTools.size} selected)</text>
          <text fg={theme.foregroundMuted}>[↑↓] Navigate • [Space] Toggle • [Enter] Continue • [Esc] Cancel</text>
        </box>

        <box style={{ flexDirection: "column", marginTop: 1 }}>
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
      </box>
    );
  }

  // Render configuration screen
  function renderConfiguration() {
    const totalEvals = selectedTools.size * candidateCount * (directPromptCount + indirectPromptCount + negativePromptCount);

    return (
      <box style={{ flexDirection: "column", padding: 1 }}>
        <box style={{ justifyContent: "space-between" }}>
          <text fg={theme.accent}>Configure Optimization ({selectedTools.size} tools)</text>
          <text fg={theme.foregroundMuted}>[↑↓] Navigate • [+/-] Adjust • [Enter] Start • [Esc] Cancel</text>
        </box>

        <box style={{ marginTop: 1 }}>
          <text fg={configFieldIndex === 0 ? theme.accent : theme.foreground}>
            {configFieldIndex === 0 ? "▶ " : "  "}Candidates: {candidateCount}
          </text>
          <text fg={theme.foregroundMuted}> (variations per tool)</text>
        </box>

        <box>
          <text fg={configFieldIndex === 1 ? theme.accent : theme.foregroundMuted}>
            {configFieldIndex === 1 ? "▶ " : "  "}Direct: {directPromptCount}
          </text>
          <text fg={configFieldIndex === 2 ? theme.accent : theme.foregroundMuted}>
            {configFieldIndex === 2 ? "  ▶ " : "    "}Indirect: {indirectPromptCount}
          </text>
          <text fg={configFieldIndex === 3 ? theme.accent : theme.foregroundMuted}>
            {configFieldIndex === 3 ? "  ▶ " : "    "}Negative: {negativePromptCount}
          </text>
          <text fg={theme.foregroundMuted}> (test prompts)</text>
        </box>

        <box style={{ marginTop: 1 }}>
          <text fg={theme.accent}>Total: {totalEvals} evaluations </text>
          <text fg={theme.foregroundMuted}>({selectedTools.size}×{candidateCount}×{directPromptCount + indirectPromptCount + negativePromptCount})</text>
        </box>
      </box>
    );
  }

  // Render cache preview
  function renderCachePreview() {
    return (
      <box style={{ flexDirection: "column", padding: 1 }}>
        <box style={{ justifyContent: "space-between" }}>
          <text fg={theme.accent}>Cached Data Found</text>
          <text fg={theme.foregroundMuted}>[Enter] Use & Evaluate  [R] Regenerate  [Esc] Cancel</text>
        </box>

        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text fg={theme.foregroundMuted}>The following tools have cached data matching your configuration:</text>
          <text fg={theme.foregroundMuted}>────────────────────────────────────────</text>

          {Array.from(cachedData.entries()).map(([toolName, data]) => (
            <box key={toolName} style={{ flexDirection: "column", marginTop: 1 }}>
              <text fg={theme.success}>{toolName}</text>
              <text fg={theme.foregroundMuted}>  • {data.candidates.length} candidates (matching config: {candidateCount})</text>
              <text fg={theme.foregroundMuted}>  • {data.prompts.length} test prompts ({data.prompts.filter(p => p.category === "direct").length}D / {data.prompts.filter(p => p.category === "indirect").length}I / {data.prompts.filter(p => p.category === "negative").length}N)</text>
              {data.candidates.length > 0 && (
                <box style={{ flexDirection: "column", marginLeft: 4, marginTop: 1 }}>
                  <text fg={theme.foregroundMuted}>Preview:</text>
                  {data.candidates.map((c, idx) => (
                    <text key={idx} fg={theme.foreground}>  {idx + 1}. [{c.description.length} chars] {c.description.substring(0, 100)}{c.description.length > 100 ? "..." : ""}</text>
                  ))}
                </box>
              )}
            </box>
          ))}

          {toolsWithoutCache.length > 0 && (
            <>
              <text fg={theme.foregroundMuted} style={{ marginTop: 2 }}>────────────────────────────────────────</text>
              <text fg={theme.warning} style={{ marginTop: 1 }}>Tools requiring fresh generation:</text>
              <text fg={theme.foregroundMuted}>(Cache missing or insufficient for current config)</text>
              {toolsWithoutCache.map((toolName) => (
                <text key={toolName} fg={theme.foregroundMuted}>  • {toolName}</text>
              ))}
            </>
          )}

          <text fg={theme.foregroundMuted} style={{ marginTop: 2 }}>────────────────────────────────────────</text>
          <text fg={theme.info} style={{ marginTop: 1 }}>
            Press [Enter] to use cached data and start evaluation
          </text>
          <text fg={theme.info}>
            Press [R] to regenerate all candidates and prompts from scratch
          </text>
        </box>
      </box>
    );
  }

  // Render generation progress
  function renderGeneration() {
    return (
      <box style={{ flexDirection: "column", padding: 1 }}>
        <box style={{ justifyContent: "space-between" }}>
          <text fg={theme.accent}>{generationProgress || "Generating Candidates & Test Prompts..."}</text>
          <text fg={theme.foregroundMuted}>{cancelRequested ? "Cancelling..." : "[Esc] Cancel"}</text>
        </box>

        <box style={{ flexDirection: "column", marginTop: 1 }}>
          {subprocessOutput.slice(-50).map((line, i) => {
            // Highlight section headers and results
            const isHeader = line.startsWith("===");
            const isSuccess = line.startsWith("✓");
            const isError = line.startsWith("ERROR");

            const color = isError ? theme.foreground :
                         isHeader ? theme.accent :
                         isSuccess ? theme.accent :
                         theme.foregroundMuted;

            return (
              <text key={i} fg={color}>
                {line}
              </text>
            );
          })}
          {subprocessOutput.length === 0 ? (
            <text fg={theme.foregroundSubtle}>Waiting for subprocess output...</text>
          ) : null}
        </box>
      </box>
    );
  }

  // Render candidate preview
  function renderCandidatePreview() {
    return (
      <box style={{ flexDirection: "column", padding: 1 }}>
        <box style={{ justifyContent: "space-between" }}>
          <text fg={theme.accent}>Preview Generated Candidates ({generatedCandidates.size} tools)</text>
          <text fg={theme.foregroundMuted}>[Enter] Start Evaluation • [Esc] Cancel</text>
        </box>

        <box style={{ flexDirection: "column", marginTop: 1 }}>
          {Array.from(generatedCandidates.entries()).map(([toolName, candidates]) => (
            <box key={toolName} style={{ flexDirection: "column", marginBottom: 1 }}>
              <text fg={theme.accent}>{toolName} ({candidates.length} candidates):</text>
              {candidates.map((c, i) => (
                <text key={c.id} fg={theme.foregroundMuted}>
                  {i + 1}. {c.description.substring(0, 120)}{c.description.length > 120 ? "..." : ""}
                </text>
              ))}
            </box>
          ))}
        </box>
      </box>
    );
  }

  // Render evaluation progress
  function renderEvaluation() {
    const runningTools = Array.from(runningToolNames);
    const completedCount = generatedCandidates.size - runningTools.length;

    return (
      <box style={{ flexDirection: "column", padding: 1 }}>
        <box style={{ justifyContent: "space-between" }}>
          <text fg={theme.accent}>
            Evaluating {completedCount}/{generatedCandidates.size} complete
            {runningTools.length > 0 ? ` • Running: ${runningTools.slice(0, 3).map((t, i) => `${i+1}:${t}`).join(" ")}` : ""}
          </text>
          <text fg={theme.foregroundMuted}>{cancelRequested ? "Cancelling..." : "[1-9] Cancel tool • [Esc] Cancel all"}</text>
        </box>

        <box style={{ flexDirection: "column", marginTop: 1 }}>
          {subprocessOutput.slice(-50).map((line, i) => (
            <text key={i} fg={theme.foregroundMuted}>
              {line}
            </text>
          ))}
          {subprocessOutput.length === 0 ? (
            <text fg={theme.foregroundSubtle}>Waiting for subprocess output...</text>
          ) : null}
        </box>
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
      <box style={{ flexDirection: "column", padding: 1 }}>
        <box style={{ justifyContent: "space-between" }}>
          <text fg={theme.accent}>
            {toolName} - Candidate {selectedCandidateIndex + 1}/{results.length} (Tool {selectedToolResultIndex + 1}/{toolEntries.length})
          </text>
          <text fg={theme.foregroundMuted}>[←→] Tools • [↑↓] Candidates • [Esc] Back</text>
        </box>

        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text fg={theme.accent}>
            Overall: {Math.round(selectedResult.metrics.overall * 100)}% •
            Direct: {Math.round(selectedResult.metrics.directSuccess * 100)}% •
            Indirect: {Math.round(selectedResult.metrics.indirectSuccess * 100)}% •
            Negative: {Math.round(selectedResult.metrics.negativeSuccess * 100)}%
          </text>

          <box style={{ marginTop: 1 }}>
            <text fg={theme.foregroundMuted}>Original: </text>
            <text fg={theme.foreground}>{originalDesc}</text>
          </box>

          <box style={{ marginTop: 1 }}>
            <text fg={theme.foregroundMuted}>Optimized: </text>
            <text fg={theme.accent}>{selectedResult.candidate.description}</text>
          </box>

          <box style={{ flexDirection: "column", marginTop: 1 }}>
            <text fg={theme.foregroundMuted}>Evaluation Results:</text>
            {selectedResult.evalRuns.map((run: any, idx: number) => {
              const prompt = prompts.find((p) => p.id === run.promptId);
              if (!prompt) return null;

              const statusIcon = run.result.correct ? "✓" : "✗";
              const statusColor = run.result.correct ? theme.accent : theme.foreground;

              return (
                <box key={run.id} style={{ flexDirection: "column" }}>
                  <text fg={statusColor}>
                    {statusIcon} [{prompt.category}] {prompt.prompt.substring(0, 100)}
                  </text>
                  {run.result.error ? (
                    <text fg={theme.foregroundMuted} style={{ marginLeft: 2 }}>
                      ↳ {run.result.error.split('\n')[0].substring(0, 120)}
                    </text>
                  ) : null}
                </box>
              );
            })}
          </box>
        </box>
      </box>
    );
  }

  // Render results and promotion interface
  function renderResults() {
    if (showDetailedResults) {
      return renderDetailedResults();
    }

    return (
      <box style={{ flexDirection: "column", padding: 1 }}>
        <box style={{ justifyContent: "space-between" }}>
          <text fg={theme.accent}>Evaluation Results ({evaluationResults.size} tools)</text>
          <text fg={theme.foregroundMuted}>[Space] Details • [Enter] Promote Best • [Esc] Cancel</text>
        </box>

        <box style={{ flexDirection: "column", marginTop: 1 }}>
          {Array.from(evaluationResults.entries()).map(([toolName, results]) => {
            // Find best candidate
            const best = results.reduce((prev, curr) =>
              curr.metrics.overall > prev.metrics.overall ? curr : prev
            );

            const overallPct = Math.round(best.metrics.overall * 100);
            const directPct = Math.round(best.metrics.directSuccess * 100);
            const indirectPct = Math.round(best.metrics.indirectSuccess * 100);
            const negativePct = Math.round(best.metrics.negativeSuccess * 100);

            return (
              <box key={toolName} style={{ flexDirection: "column" }}>
                <text fg={theme.accent}>
                  {toolName}: {overallPct}% (D:{directPct}% I:{indirectPct}% N:{negativePct}%)
                </text>
                <text fg={theme.foregroundMuted}>
                  {best.candidate.description.substring(0, 120)}{best.candidate.description.length > 120 ? "..." : ""}
                </text>
              </box>
            );
          })}
        </box>
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

  if (workflowStep === "cache-preview") {
    return renderCachePreview();
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
