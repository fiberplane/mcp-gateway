export interface ExecutionContext {
  /** The generated runtime API code (JavaScript) */
  runtimeApi: string;

  /** Function that routes tool calls to actual MCP servers */
  rpcHandler: (
    serverName: string,
    toolName: string,
    args: unknown,
  ) => Promise<unknown>;

  /** Optional timeout in milliseconds */
  timeout?: number;
}

export interface ExecutionResult {
  /** Console output captured during execution */
  output: string;

  /** Whether execution completed successfully */
  success: boolean;

  /** Error message if execution failed */
  error?: string;

  /** Error stack trace if available */
  stack?: string;

  /** Return value from the code (if any) */
  returnValue?: unknown;
}

export function formatExecutionResult(
  result: ExecutionResult,
  compact = false,
): string {
  if (compact) {
    return formatCompact(result);
  }
  return formatVerbose(result);
}

function formatVerbose(result: ExecutionResult): string {
  const sections: string[] = [];

  // 1. Status - Most important information first
  sections.push(`## Execution ${result.success ? "✓ SUCCESS" : "✗ FAILED"}`);

  // 2. Output - Console logs and stdout (if present)
  if (result.output.trim()) {
    sections.push("\n### Console Output:");
    sections.push("```");
    sections.push(result.output);
    sections.push("```");
  }

  // 3. Return Value - Show the actual result (if present and successful)
  if (result.returnValue !== undefined) {
    sections.push("\n### Return Value:");
    sections.push("```json");
    sections.push(formatReturnValue(result.returnValue));
    sections.push("```");
  }

  // 4. Error Details - Group error information together
  if (result.error || result.stack) {
    sections.push("\n### Error Details:");
    if (result.error) {
      sections.push(`**Message:** ${result.error}`);
    }
    if (result.stack) {
      sections.push("\n**Stack Trace:**");
      sections.push("```");
      sections.push(result.stack);
      sections.push("```");
    }
  }

  return sections.join("\n");
}

function formatCompact(result: ExecutionResult): string {
  const parts: string[] = [`Status: ${result.success ? "SUCCESS" : "FAILED"}`];

  if (result.output.trim()) {
    parts.push(`Output: ${result.output}`);
  }

  if (result.returnValue !== undefined) {
    parts.push(`Result: ${formatReturnValue(result.returnValue)}`);
  }

  if (result.error) {
    parts.push(`Error: ${result.error}`);
  }

  if (result.stack) {
    parts.push(`Stack: ${result.stack}`);
  }

  return parts.join("\n\n");
}

function formatReturnValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  try {
    return safeStringify(value, 2);
  } catch (error) {
    // Final fallback for any unexpected errors
    return `[Serialization Error: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * Safe JSON stringification that handles:
 * - Circular references
 * - Functions
 * - Symbols
 * - BigInt
 * - Undefined values in objects
 * - Other non-serializable types
 */
function safeStringify(value: unknown, indent = 2): string {
  const seen = new WeakSet();
  const paths = new WeakMap<object, string>();

  function replacer(key: string, val: unknown): unknown {
    // Handle primitives
    if (val === null) return null;
    if (val === undefined) return "[undefined]";

    // Handle primitive types that need special formatting
    if (typeof val === "bigint") return `[BigInt: ${val}]`;
    if (typeof val === "symbol") return `[Symbol: ${val.toString()}]`;
    if (typeof val === "function") {
      return `[Function: ${val.name || "anonymous"}]`;
    }

    // Handle objects and arrays (circular reference detection)
    if (typeof val === "object" && val !== null) {
      // Check for circular reference
      if (seen.has(val)) {
        const path = paths.get(val) || "unknown";
        return `[Circular: ${path}]`;
      }

      // Mark as seen and track the path
      seen.add(val);
      const currentPath = key ? `${key}` : "root";
      paths.set(val, currentPath);

      // Handle special object types
      if (val instanceof Date) {
        return `[Date: ${val.toISOString()}]`;
      }
      if (val instanceof RegExp) {
        return `[RegExp: ${val.toString()}]`;
      }
      if (val instanceof Error) {
        return {
          __type: "Error",
          name: val.name,
          message: val.message,
          stack: val.stack,
        };
      }
      if (val instanceof Set) {
        return {
          __type: "Set",
          values: Array.from(val),
        };
      }
      if (val instanceof Map) {
        return {
          __type: "Map",
          entries: Array.from(val.entries()),
        };
      }
      if (ArrayBuffer.isView(val)) {
        return `[${val.constructor.name}: length ${(val as Uint8Array).length}]`;
      }
    }

    return val;
  }

  return JSON.stringify(value, replacer, indent);
}
