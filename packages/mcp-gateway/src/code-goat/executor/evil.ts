/**
 * Code Executor - Eval-based prototype implementation
 *
 * Executes user code with access to MCP tools via a runtime API.
 * This is a PROTOTYPE ONLY - runs code in the same process with no sandboxing.
 */

import type { ExecutionContext, ExecutionResult } from "./types";

/**
 * Executes user code with access to MCP tools.
 *
 * @param userCode - The JavaScript/TypeScript code to execute
 * @param context - Execution context including runtime API and RPC handler
 * @returns Execution result with output and errors
 */
export async function executeCode(
  userCode: string,
  context: ExecutionContext,
): Promise<ExecutionResult> {
  const LOGS: string[] = [];
  let returnValue: unknown;

  // Create a captured console for logging
  // biome-ignore lint/correctness/noUnusedVariables: used in eval context
  const capturedConsole = {
    log: (...args: unknown[]) => {
      LOGS.push(args.map(formatLogValue).join(" "));
    },
    error: (...args: unknown[]) => {
      LOGS.push(`[ERROR] ${args.map(formatLogValue).join(" ")}`);
    },
    warn: (...args: unknown[]) => {
      LOGS.push(`[WARN] ${args.map(formatLogValue).join(" ")}`);
    },
    info: (...args: unknown[]) => {
      LOGS.push(`[INFO] ${args.map(formatLogValue).join(" ")}`);
    },
    debug: (...args: unknown[]) => {
      LOGS.push(`[DEBUG] ${args.map(formatLogValue).join(" ")}`);
    },
  };

  // Build the complete code to execute
  const fullCode = `
    (async () => {
      // Override console in this scope - use the capturedConsole from outer scope
      const console = {
        log: (...args) => capturedConsole.log(...args),
        error: (...args) => capturedConsole.error(...args),
        warn: (...args) => capturedConsole.warn(...args),
        info: (...args) => capturedConsole.info(...args),
        debug: (...args) => capturedConsole.debug(...args),
      };
      
      // Inject the runtime API
      ${context.runtimeApi}
      
      // Execute user code and return result
      return await (async () => {
        ${userCode}
      })();
    })()
  `;

  try {
    // Create the RPC handler in scope for eval
    const __rpcCall = context.rpcHandler;

    // biome-ignore lint/correctness/noUnusedVariables: used in eval context
    const capturedConsole = {
      log: (...args: unknown[]) => {
        LOGS.push(args.map(formatLogValue).join(" "));
      },
      error: (...args: unknown[]) => {
        LOGS.push(`[ERROR] ${args.map(formatLogValue).join(" ")}`);
      },
      warn: (...args: unknown[]) => {
        LOGS.push(`[WARN] ${args.map(formatLogValue).join(" ")}`);
      },
      info: (...args: unknown[]) => {
        LOGS.push(`[INFO] ${args.map(formatLogValue).join(" ")}`);
      },
      debug: (...args: unknown[]) => {
        LOGS.push(`[DEBUG] ${args.map(formatLogValue).join(" ")}`);
      },
    };

    // Execute with timeout if specified
    if (context.timeout) {
      returnValue = await Promise.race([
        // biome-ignore lint/security/noGlobalEval: intentional for prototype
        eval(fullCode),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(new Error(`Execution timeout after ${context.timeout}ms`)),
            context.timeout,
          ),
        ),
      ]);
    } else {
      // biome-ignore lint/security/noGlobalEval: intentional for prototype
      returnValue = await eval(fullCode);
    }

    return {
      output: LOGS.join("\n"),
      success: true,
      returnValue,
    };
  } catch (error) {
    const err = error as Error;
    LOGS.push(`[ERROR] ${err.message}`);

    return {
      output: LOGS.join("\n"),
      success: false,
      error: err.message,
      stack: err.stack,
    };
  }
}

/**
 * Formats a value for console output
 */
function formatLogValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
