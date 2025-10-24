import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
				transport: "http",
				url: mcpUrl,
			},
		},
	};

	await writeFile(
		join(tempDir, ".mcp.json"),
		JSON.stringify(mcpConfig, null, 2),
		"utf8",
	);

	return tempDir;
}

/**
 * Build Claude CLI command for evaluation with MCP server connection
 *
 * @param testPrompt - User prompt to test with
 * @param serverName - Temporary server name in the gateway
 * @param gatewayPort - Port where the gateway is running
 * @returns Object with command array and temp directory path
 */
export async function buildClaudeCommand(
	testPrompt: string,
	serverName: string,
	gatewayPort: number,
): Promise<{ command: string[]; tempDir: string }> {
	const tempDir = await createTempMcpConfig(serverName, gatewayPort);

	return {
		command: [
			"claude",
			"-p",
			"--output-format",
			"stream-json",
			"--verbose",
			testPrompt,
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
 * Run an evaluation session by spawning a subprocess
 *
 * This is a low-level function that spawns any command and captures output.
 * Use buildClaudeCommand() to construct the Claude CLI command for production use.
 *
 * @param command - Command array to spawn (e.g., ["echo", "test"] or ["claude", "-p", ...])
 * @param toolName - Name of tool to detect in output
 * @param expectedBehavior - Expected outcome (should tool be called or not)
 * @param cwd - Working directory for the subprocess
 * @param timeout - Maximum time to wait in milliseconds (default: 60 seconds)
 * @returns Evaluation result with tool call detection and correctness
 */
export async function runEvaluation(
  command: string[],
  toolName: string,
  expectedBehavior: { shouldCallTool: boolean; notes?: string },
  cwd: string,
  timeout = 60000,
): Promise<EvaluationResult> {
  const startTime = Date.now();

  try {
    // Spawn subprocess
    const proc = Bun.spawn(command, {
      stdout: "pipe",
      stderr: "pipe",
      cwd,
    });

    // Set up timeout
    let killed = false;
    const timeoutId = setTimeout(() => {
      proc.kill();
      killed = true;
    }, timeout);

    // Wait for process to complete
    await proc.exited;
    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;

    // Read stdout and stderr
    const stdoutChunks: Uint8Array[] = [];
    const stderrChunks: Uint8Array[] = [];

    // Read stdout
    if (proc.stdout) {
      const stdoutReader = proc.stdout.getReader();
      while (true) {
        const { done, value } = await stdoutReader.read();
        if (done) break;
        stdoutChunks.push(value);
      }
    }

    // Read stderr
    if (proc.stderr) {
      const stderrReader = proc.stderr.getReader();
      while (true) {
        const { done, value } = await stderrReader.read();
        if (done) break;
        stderrChunks.push(value);
      }
    }

    // Combine chunks and decode
    const stdout = new TextDecoder().decode(
      Buffer.concat(stdoutChunks.map((chunk) => Buffer.from(chunk))),
    );
    const stderr = new TextDecoder().decode(
      Buffer.concat(stderrChunks.map((chunk) => Buffer.from(chunk))),
    );

    // Check if process was killed by timeout
    if (killed) {
      return {
        toolCalled: false,
        correct: false,
        duration,
        error: "Evaluation timed out",
        stdout,
        stderr,
      };
    }

    // Check exit code
    if (proc.exitCode !== 0) {
      return {
        toolCalled: false,
        correct: false,
        duration,
        error: `Claude exited with code ${proc.exitCode}`,
        stdout,
        stderr,
      };
    }

    // Parse stream-json output to detect tool calls
    const toolCalled = detectToolCall(stdout, toolName);
    const correct = toolCalled === expectedBehavior.shouldCallTool;

    return {
      toolCalled,
      correct,
      duration,
      stdout,
      stderr,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      toolCalled: false,
      correct: false,
      duration,
      error: `Evaluation subprocess failed: ${error}`,
      stdout: "",
      stderr: "",
    };
  }
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
            if (item.type === "tool_use" && item.name === toolName) {
              return true;
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
