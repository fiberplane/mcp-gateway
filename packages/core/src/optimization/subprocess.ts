import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { logger } from "../logger.js";

/**
 * Subprocess evaluation infrastructure for tool description optimization
 *
 * Spawns Claude Code sessions to test tool description candidates against golden prompts.
 */

/**
 * Create a temporary directory with .mcp.json configuration
 *
 * @param serverName - Temporary server name in the gateway
 * @param gatewayPort - Port where the gateway is running
 * @returns Path to temporary directory
 */
async function createTempMcpConfig(
	serverName: string,
	gatewayPort: number,
): Promise<string> {
	const tempDir = await mkdtemp(join(tmpdir(), "mcp-eval-"));
	const mcpUrl = `http://localhost:${gatewayPort}/servers/${serverName}/mcp`;

	const mcpConfig = {
		mcpServers: {
			[serverName]: {
				type: "http",
				url: mcpUrl,
			},
		},
	};

	const configPath = join(tempDir, ".mcp.json");
	await writeFile(
		configPath,
		JSON.stringify(mcpConfig, null, 2),
		"utf8",
	);

	logger.info("Created temp MCP config for evaluation", {
		serverName,
		gatewayPort,
		mcpUrl,
		configPath,
		config: mcpConfig,
	});

	return tempDir;
}

/**
 * Build Claude CLI command for evaluation with MCP server connection
 *
 * @param testPrompt - User prompt to test with
 * @param serverName - Temporary server name in the gateway
 * @param toolName - Name of the tool being evaluated (for allowedTools restriction)
 * @param gatewayPort - Port where the gateway is running
 * @returns Object with command array and temp directory path
 */
export async function buildClaudeCommand(
	testPrompt: string,
	serverName: string,
	toolName: string,
	gatewayPort: number,
): Promise<{ command: string[]; tempDir: string }> {
	const tempDir = await createTempMcpConfig(serverName, gatewayPort);
	const mcpConfigPath = join(tempDir, ".mcp.json");

	// Construct MCP tool name: mcp__{serverName}__{toolName}
	// Example: mcp__greentea-eval-294a6a69__update-my-profile
	const mcpToolName = `mcp__${serverName}__${toolName}`;

	return {
		command: [
			"claude",
			"-p",
			testPrompt, // Prompt must come FIRST as positional argument
			"--output-format",
			"stream-json",
			"--verbose",
			"--model",
			"haiku", // Use Haiku 4.5 for faster, cheaper evaluations
			"--allowedTools",
			mcpToolName, // Only allow the specific tool being evaluated
			"--mcp-config",
			mcpConfigPath, // Variadic flag must come last
		],
		tempDir,
	};
}

/**
 * Result of running an evaluation
 */
export interface EvaluationResult {
  /** Whether the target tool was called during evaluation */
  toolCalled: boolean;
  /** Whether the behavior matches expected outcome */
  correct: boolean;
  /** Duration of evaluation in milliseconds */
  duration: number;
  /** Error message if evaluation failed */
  error?: string;
  /** Optional reasoning about the evaluation */
  reasoning?: string;
  /** Raw stdout from Claude subprocess */
  stdout: string;
  /** Raw stderr from Claude subprocess */
  stderr: string;
}

/**
 * Stream event from Claude --output-format stream-json
 */
interface ClaudeStreamEvent {
  type: string;
  subtype?: string;
  message?: {
    content?: Array<{
      type: string;
      name?: string;
      [key: string]: unknown;
    }>;
  };
  [key: string]: unknown;
}

/**
 * Callback for streaming subprocess output
 */
export type OutputCallback = (line: string, stream: 'stdout' | 'stderr') => void;

/**
 * Options for capturing subprocess output to files
 */
export interface OutputCaptureOptions {
  /** Storage directory base path (e.g., ~/.mcp-gateway) */
  storageDir: string;
  /** Server name */
  serverName: string;
  /** Tool name */
  toolName: string;
  /** Prompt ID */
  promptId: string;
}

/**
 * Save subprocess output to organized files for debugging
 *
 * Creates directory structure: {storageDir}/optimization/{serverName}/eval-outputs/{toolName}/
 * Saves stdout, stderr, and metadata JSON for each evaluation.
 *
 * @param options - Capture options with paths and IDs
 * @param command - Command array that was executed
 * @param expectedBehavior - Expected behavior specification
 * @param result - Evaluation result to save
 * @param stdout - Raw stdout from subprocess
 * @param stderr - Raw stderr from subprocess
 */
async function saveOutputCapture(
  options: OutputCaptureOptions,
  command: string[],
  expectedBehavior: { shouldCallTool: boolean; notes?: string },
  result: EvaluationResult,
  stdout: string,
  stderr: string,
): Promise<void> {
  try {
    // Create output directory: ~/.mcp-gateway/optimization/{serverName}/eval-outputs/{toolName}/
    const outputDir = join(
      options.storageDir,
      "optimization",
      options.serverName,
      "eval-outputs",
      options.toolName,
    );
    await mkdir(outputDir, { recursive: true });

    // File paths
    const stdoutPath = join(outputDir, `${options.promptId}-stdout.txt`);
    const stderrPath = join(outputDir, `${options.promptId}-stderr.txt`);
    const metadataPath = join(outputDir, `${options.promptId}-metadata.json`);

    // Metadata JSON
    const metadata = {
      toolName: options.toolName,
      promptId: options.promptId,
      command: command.join(" "),
      expectedBehavior,
      timestamp: new Date().toISOString(),
      duration: result.duration,
      exitCode: result.error ? -1 : 0,
      result: {
        toolCalled: result.toolCalled,
        correct: result.correct,
        error: result.error,
      },
    };

    // Write files concurrently
    await Promise.all([
      writeFile(stdoutPath, stdout, "utf8"),
      writeFile(stderrPath, stderr, "utf8"),
      writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8"),
    ]);

    logger.info("Saved evaluation output capture", {
      toolName: options.toolName,
      promptId: options.promptId,
      outputDir,
      stdoutSize: stdout.length,
      stderrSize: stderr.length,
    });
  } catch (error) {
    logger.warn("Failed to save output capture", {
      toolName: options.toolName,
      promptId: options.promptId,
      error: String(error),
    });
  }
}

/**
 * Run an evaluation session by spawning a subprocess
 *
 * This is a low-level function that spawns any command and captures output.
 * Use buildClaudeCommand() to construct the Claude CLI command for production use.
 *
 * @param command - Command array to spawn (e.g., ["echo", "test"] or ["claude", "-p", ...])
 * @param toolName - Name of tool to detect in output
 * @param expectedBehavior - Expected outcome (should tool be called or not)
 * @param cwd - Working directory for the subprocess
 * @param timeout - Maximum time to wait in milliseconds (default: 600 seconds / 10 minutes)
 * @param onOutput - Optional callback for streaming output lines
 * @param captureOptions - Optional output capture configuration for saving to files
 * @returns Evaluation result with tool call detection and correctness
 */
export async function runEvaluation(
  command: string[],
  toolName: string,
  expectedBehavior: { shouldCallTool: boolean; notes?: string },
  cwd: string,
  timeout = 600000,
  onOutput?: OutputCallback,
  captureOptions?: OutputCaptureOptions,
): Promise<EvaluationResult> {
  const startTime = Date.now();

  logger.info("Starting subprocess evaluation", {
    toolName,
    expectedBehavior,
    command: command.join(" "),
    cwd,
    timeout,
  });

  try {
    // Spawn subprocess with all environment variables from parent process
    // Set HOME to /tmp/claude to avoid sandbox permission issues with ~/.claude.json
    const subprocessEnv = {
      ...process.env,
      HOME: "/tmp/claude",
    };

    logger.debug("Subprocess environment", {
      toolName,
      hasAnthropicKey: !!(subprocessEnv as Record<string, string | undefined>).ANTHROPIC_API_KEY,
      hasBaseUrl: !!(subprocessEnv as Record<string, string | undefined>).ANTHROPIC_BASE_URL,
      home: subprocessEnv.HOME,
    });

    const proc = Bun.spawn(command, {
      stdout: "pipe",
      stderr: "pipe",
      cwd,
      env: subprocessEnv,
    });

    logger.info("Subprocess spawned", {
      toolName,
      pid: proc.pid,
      spawnedAt: new Date().toISOString(),
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
    let firstOutputReceived = false;
    let lastOutputTime = Date.now();

    const readStdout = async () => {
      if (!proc.stdout) return;
      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          stdoutChunks.push(value);
          lastOutputTime = Date.now();

          // Log first output received (indicates subprocess started successfully)
          if (!firstOutputReceived) {
            firstOutputReceived = true;
            const timeToFirstOutput = Date.now() - startTime;
            logger.info("Subprocess first output received", {
              toolName,
              pid: proc.pid,
              timeToFirstOutputMs: timeToFirstOutput,
            });
          }

          // Always decode for logging, stream to callback if provided
          const chunk = decoder.decode(value, { stream: true });
          stdoutBuffer += chunk;
          const lines = stdoutBuffer.split('\n');
          stdoutBuffer = lines.pop() || '';  // Keep incomplete line

          for (const line of lines) {
            // Log all stdout lines
            logger.debug("Subprocess stdout", { toolName, line });

            // Also stream to callback if provided
            if (onOutput) {
              onOutput(line, 'stdout');
            }
          }
        }

        // Handle any remaining buffered content
        if (stdoutBuffer) {
          logger.debug("Subprocess stdout", { toolName, line: stdoutBuffer });
          if (onOutput) {
            onOutput(stdoutBuffer, 'stdout');
          }
        }
      } catch (error) {
        logger.warn("Subprocess stdout stream error", { toolName, error: String(error) });
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

          // Always decode for logging, stream to callback if provided
          const chunk = decoder.decode(value, { stream: true });
          stderrBuffer += chunk;
          const lines = stderrBuffer.split('\n');
          stderrBuffer = lines.pop() || '';  // Keep incomplete line

          for (const line of lines) {
            // Log all stderr lines
            logger.warn("Subprocess stderr", { toolName, line });

            // Also stream to callback if provided
            if (onOutput) {
              onOutput(line, 'stderr');
            }
          }
        }

        // Handle any remaining buffered content
        if (stderrBuffer) {
          logger.warn("Subprocess stderr", { toolName, line: stderrBuffer });
          if (onOutput) {
            onOutput(stderrBuffer, 'stderr');
          }
        }
      } catch (error) {
        logger.warn("Subprocess stderr stream error", { toolName, error: String(error) });
      }
    };

    // Monitor process exit and log early termination
    const processExitMonitor = proc.exited.then((exitCode) => {
      const exitTime = Date.now() - startTime;

      if (!killed) {
        logger.info("Subprocess exited", {
          toolName,
          pid: proc.pid,
          exitCode,
          exitTimeMs: exitTime,
          hadOutput: firstOutputReceived,
        });
      }

      return exitCode;
    });

    // Read streams concurrently while process runs
    await Promise.all([
      readStdout(),
      readStderr(),
      processExitMonitor,
    ]);

    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;

    // Log if subprocess never produced output
    if (!firstOutputReceived) {
      logger.warn("Subprocess completed without producing output", {
        toolName,
        pid: proc.pid,
        duration,
        exitCode: proc.exitCode,
      });
    }

    // Combine chunks for final result
    const stdout = new TextDecoder().decode(
      Buffer.concat(stdoutChunks.map((chunk) => Buffer.from(chunk))),
    );
    const stderr = new TextDecoder().decode(
      Buffer.concat(stderrChunks.map((chunk) => Buffer.from(chunk))),
    );

    logger.info("Subprocess completed", {
      toolName,
      exitCode: proc.exitCode,
      duration,
      stdoutLength: stdout.length,
      stderrLength: stderr.length,
      wasKilled: killed,
    });

    // Check if process was killed by timeout
    if (killed) {
      const timeSinceLastOutput = Date.now() - lastOutputTime;

      logger.warn("Subprocess timed out", {
        toolName,
        duration,
        timeout,
        hadAnyOutput: firstOutputReceived,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
        timeSinceLastOutputMs: timeSinceLastOutput,
        exitCode: proc.exitCode,
      });

      // Parse partial output to detect tool calls even on timeout
      const toolCalled = detectToolCall(stdout, toolName);
      const correct = toolCalled === expectedBehavior.shouldCallTool;

      logger.info("Parsed partial output from timeout", {
        toolName,
        toolCalled,
        expectedShouldCall: expectedBehavior.shouldCallTool,
        correct,
        stdoutLength: stdout.length,
      });

      const result: EvaluationResult = {
        toolCalled,
        correct,
        duration,
        error: "Evaluation timed out (partial results parsed)",
        stdout,
        stderr,
      };

      // Save output capture if configured
      if (captureOptions) {
        await saveOutputCapture(captureOptions, command, expectedBehavior, result, stdout, stderr);
      }

      return result;
    }

    // Check exit code
    if (proc.exitCode !== 0) {
      // Extract meaningful error message from stderr
      const errorMessage = extractErrorMessage(stderr);
      const errorLogPath = join(cwd, "error.log");

      logger.error("Claude subprocess failed", {
        exitCode: proc.exitCode,
        command: command.join(" "),
        cwd,
        errorMessage,
        errorLogPath,
        stdoutPreview: stdout.substring(0, 1000),
        stderrPreview: stderr.substring(0, 1000),
      });

      // Write full error to file for debugging
      try {
        await writeFile(
          errorLogPath,
          `Exit Code: ${proc.exitCode}\n\n=== COMMAND ===\n${command.join(" ")}\n\n=== STDOUT ===\n${stdout}\n\n=== STDERR ===\n${stderr}`,
          "utf8"
        );
        logger.info(`Full error details written to ${errorLogPath}`);
      } catch (writeError) {
        logger.warn("Failed to write error log", { error: String(writeError) });
      }

      // Parse partial output to detect tool calls even on error
      const toolCalled = detectToolCall(stdout, toolName);
      const correct = toolCalled === expectedBehavior.shouldCallTool;

      logger.info("Parsed partial output from failed subprocess", {
        toolName,
        exitCode: proc.exitCode,
        toolCalled,
        expectedShouldCall: expectedBehavior.shouldCallTool,
        correct,
        stdoutLength: stdout.length,
      });

      const result: EvaluationResult = {
        toolCalled,
        correct,
        duration,
        error: `${errorMessage}\n\nFull logs: ${errorLogPath}`,
        stdout,
        stderr,
      };

      // Save output capture if configured
      if (captureOptions) {
        await saveOutputCapture(captureOptions, command, expectedBehavior, result, stdout, stderr);
      }

      return result;
    }

    // Parse stream-json output to detect tool calls
    const toolCalled = detectToolCall(stdout, toolName);
    const correct = toolCalled === expectedBehavior.shouldCallTool;

    const result: EvaluationResult = {
      toolCalled,
      correct,
      duration,
      stdout,
      stderr,
    };

    // Save output capture if configured
    if (captureOptions) {
      await saveOutputCapture(captureOptions, command, expectedBehavior, result, stdout, stderr);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const result: EvaluationResult = {
      toolCalled: false,
      correct: false,
      duration,
      error: `Evaluation subprocess failed: ${error}`,
      stdout: "",
      stderr: "",
    };

    // Save output capture if configured (even on exception)
    if (captureOptions) {
      await saveOutputCapture(captureOptions, command, expectedBehavior, result, "", "");
    }

    return result;
  }
}

/**
 * Extract meaningful error message from stderr output
 *
 * Parses stderr to find actual error messages, avoiding minified code from stack traces.
 * Looks for lines starting with "Error:" or common error patterns.
 *
 * @param stderr - Raw stderr output
 * @returns Extracted error message or generic message if no clear error found
 */
function extractErrorMessage(stderr: string): string {
  if (!stderr.trim()) {
    return "Claude subprocess failed with no error output";
  }

  const lines = stderr.split("\n");
  const errorLines: string[] = [];

  // Look for explicit error messages
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip minified code lines (contain pipe characters with line numbers like "3747 |")
    if (/^\d+\s*\|/.test(trimmed)) {
      continue;
    }

    // Collect lines that look like error messages
    if (
      trimmed.startsWith("Error:") ||
      trimmed.startsWith("error:") ||
      trimmed.startsWith("ERROR:") ||
      trimmed.includes("Error:") ||
      (trimmed.length > 0 && !trimmed.includes("process.exit") && !trimmed.includes("function("))
    ) {
      errorLines.push(trimmed);
    }
  }

  // Return collected error lines or first few non-minified lines
  if (errorLines.length > 0) {
    return errorLines.slice(0, 5).join("\n");
  }

  // Fallback: return first 500 chars of stderr
  return stderr.substring(0, 500);
}

/**
 * Detect if a specific tool was called from Claude stream-json output
 *
 * Parses NDJSON (newline-delimited JSON) output from Claude --output-format stream-json
 * and checks if any assistant messages contain tool_use for the target tool.
 *
 * @param stdout - Raw stdout from Claude subprocess
 * @param toolName - Name of tool to detect
 * @returns True if tool was called, false otherwise
 */
function detectToolCall(stdout: string, toolName: string): boolean {
  try {
    // Split by newlines and parse each JSON object
    const lines = stdout.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      try {
        const event: ClaudeStreamEvent = JSON.parse(line);

        // Look for assistant messages with tool_use content
        if (event.type === "assistant" && event.message?.content) {
          for (const item of event.message.content) {
            if (item.type === "tool_use" && item.name) {
              // Handle both exact matches and MCP-prefixed names
              // MCP tools are prefixed like: mcp__greentea-eval-294a6a69__update-my-profile
              const isExactMatch = item.name === toolName;
              const isPrefixedMatch = item.name.endsWith(`__${toolName}`);

              if (isExactMatch || isPrefixedMatch) {
                return true;
              }
            }
          }
        }
      } catch {}
    }

    return false;
  } catch {
    // If parsing fails entirely, assume tool not called
    return false;
  }
}
