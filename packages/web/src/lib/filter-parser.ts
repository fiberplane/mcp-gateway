/**
 * Parser for command-based filter input
 *
 * Supports syntax like:
 * - tokens > 150
 * - duration < 25
 * - client is claude-code
 * - method contains tools
 */

import type {
  FilterField,
  FilterInput,
  NumericOperator,
  StringOperator,
} from "@fiberplane/mcp-gateway-types";
import type { ReactNode } from "react";
import { type FilterParseError, findClosestField } from "./filter-errors";

/**
 * Autocomplete suggestion
 */
export interface FilterSuggestion {
  text: string; // Text to insert
  display: string; // Text to display
  description?: string; // Help text
  example?: string; // Example usage
  icon?: ReactNode; // Optional icon
}

/**
 * Validation result
 */
export type ValidationResult =
  | { valid: true; filter: FilterInput }
  | { valid: false; error: FilterParseError };

/**
 * Operator mappings (support multiple syntaxes)
 */
const OPERATOR_MAP: Record<string, NumericOperator | StringOperator> = {
  // Numeric operators
  ">": "gt",
  "<": "lt",
  "=": "eq",
  "==": "eq",
  ">=": "gte",
  "<=": "lte",
  "≥": "gte",
  "≤": "lte",
  // String operators
  is: "is",
  contains: "contains",
};

/**
 * Reverse operator map for display
 */
const OPERATOR_DISPLAY: Record<string, string> = {
  gt: ">",
  lt: "<",
  eq: "=",
  gte: "≥",
  lte: "≤",
  is: "is",
  contains: "contains",
};

/**
 * Field descriptions
 */
const FIELD_DESCRIPTIONS: Record<FilterField, string> = {
  tokens: "Filter by token count (input + output)",
  duration: "Filter by request duration in milliseconds",
  client: "Filter by client name",
  method: "Filter by JSON-RPC method",
  session: "Filter by session ID",
  server: "Filter by server name",
};

/**
 * Field examples
 */
const FIELD_EXAMPLES: Record<FilterField, string[]> = {
  tokens: ["tokens > 150", "tokens < 1000"],
  duration: ["duration < 25", "duration > 1000"],
  client: ["client is claude-code", "client contains claude"],
  method: ["method contains tools", "method is tools/list"],
  session: ["session is abc123"],
  server: ["server is my-server"],
};

/**
 * Parse filter input text into structured filter
 */
export function parseFilterInput(text: string): FilterInput | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Stage 1: Extract field
  const fieldMatch = trimmed.match(
    /^(tokens|duration|client|method|session|server)\s*/i,
  );
  if (!fieldMatch) return null;

  const field = fieldMatch[1]?.toLowerCase() as FilterField;
  const afterField = trimmed.slice(fieldMatch[0]?.length ?? 0);

  // Stage 2: Extract operator
  const operatorPattern = /^(>=|<=|>|<|=|==|≥|≤|is|contains)\s*/i;
  const operatorMatch = afterField.match(operatorPattern);
  if (!operatorMatch) return null;

  const operatorInput = operatorMatch[1]?.toLowerCase();
  if (!operatorInput) return null;

  const operator = OPERATOR_MAP[operatorInput];
  if (!operator) return null;

  const valueStr = afterField.slice(operatorMatch[0]?.length ?? 0).trim();

  // Stage 3: Parse value based on field type
  if (field === "duration" || field === "tokens") {
    // Numeric field
    const numValue = Number.parseInt(valueStr, 10);
    if (Number.isNaN(numValue) || numValue < 0) return null;
    return {
      field,
      operator: operator as NumericOperator,
      value: numValue,
    } as FilterInput;
  }

  // String field
  if (!valueStr) return null;
  return {
    field,
    operator: operator as StringOperator,
    value: valueStr,
  } as FilterInput;
}

/**
 * Validate filter input and return detailed result
 */
export function validateFilterInput(text: string): ValidationResult {
  const trimmed = text.trim();

  // Empty input is not an error (just not valid yet)
  if (!trimmed) {
    return {
      valid: false,
      error: { type: "incomplete", message: "Enter a filter" },
    };
  }

  // Try to extract field
  const fieldMatch = trimmed.match(
    /^(tokens|duration|client|method|session|server)\s*/i,
  );
  if (!fieldMatch) {
    // Unknown field - try to suggest
    const words = trimmed.split(/\s+/);
    const firstWord = words[0];
    const suggestion = firstWord ? findClosestField(firstWord) : undefined;
    return {
      valid: false,
      error: {
        type: "unknown_field",
        field: firstWord || "",
        suggestion,
      },
    };
  }

  const field = fieldMatch[1]?.toLowerCase() as FilterField;
  const afterField = trimmed.slice(fieldMatch[0]?.length ?? 0);

  // Check if we have an operator
  const operatorPattern = /^(>=|<=|>|<|=|==|≥|≤|is|contains)\s*/i;
  const operatorMatch = afterField.match(operatorPattern);
  if (!operatorMatch) {
    // Missing operator
    const isNumericField = field === "duration" || field === "tokens";
    const validOperators = isNumericField
      ? [">", "<", "=", ">=", "<="]
      : ["is", "contains"];
    return {
      valid: false,
      error: {
        type: "incomplete",
        message: `Add operator: ${validOperators.join(", ")}`,
      },
    };
  }

  const operatorInput = operatorMatch[1]?.toLowerCase();
  if (!operatorInput) {
    return {
      valid: false,
      error: {
        type: "incomplete",
        message: "Add operator",
      },
    };
  }

  const operator = OPERATOR_MAP[operatorInput];
  if (!operator) {
    const isNumericField = field === "duration" || field === "tokens";
    const validOperators = isNumericField
      ? [">", "<", "=", ">=", "<="]
      : ["is", "contains"];
    return {
      valid: false,
      error: {
        type: "invalid_operator",
        operator: operatorInput,
        validOperators,
      },
    };
  }

  const valueStr = afterField.slice(operatorMatch[0]?.length ?? 0).trim();

  // Check if we have a value
  if (!valueStr) {
    return {
      valid: false,
      error: {
        type: "incomplete",
        message: "Add value",
      },
    };
  }

  // Validate value based on field type
  if (field === "duration" || field === "tokens") {
    // Numeric field
    const numValue = Number.parseInt(valueStr, 10);
    if (Number.isNaN(numValue)) {
      return {
        valid: false,
        error: {
          type: "invalid_value",
          message: `Value must be a number for '${field}'`,
        },
      };
    }
    if (numValue < 0) {
      return {
        valid: false,
        error: {
          type: "invalid_value",
          message: `${field === "duration" ? "Duration" : "Tokens"} must be non-negative`,
        },
      };
    }
    return {
      valid: true,
      filter: {
        field,
        operator: operator as NumericOperator,
        value: numValue,
      } as FilterInput,
    };
  }

  // String field - any non-empty string is valid
  return {
    valid: true,
    filter: {
      field,
      operator: operator as StringOperator,
      value: valueStr,
    } as FilterInput,
  };
}

/**
 * Get autocomplete suggestions for current input
 */
export function getAutocompleteSuggestions(input: string): FilterSuggestion[] {
  // Don't trim - we need to preserve spaces to detect when user has typed field + space
  const text = input;

  // Stage 1: Field suggestions
  if (!text || !text.includes(" ")) {
    const fields: FilterField[] = [
      "tokens",
      "duration",
      "client",
      "method",
      "session",
      "server",
    ];
    return fields
      .filter((field) => field.startsWith(text.toLowerCase()))
      .map((field) => ({
        text: `${field} `,
        display: field,
        description: FIELD_DESCRIPTIONS[field],
        example: FIELD_EXAMPLES[field][0],
      }));
  }

  // Try to parse field
  const fieldMatch = text.match(
    /^(tokens|duration|client|method|session|server)\s*/i,
  );
  if (!fieldMatch) return [];

  const field = fieldMatch[1]?.toLowerCase() as FilterField;
  const afterField = text.slice(fieldMatch[0]?.length ?? 0);

  // Stage 2: Operator suggestions
  const operatorPattern = /^(>=|<=|>|<|=|==|≥|≤|is|contains)\s*/i;
  const operatorMatch = afterField.match(operatorPattern);

  if (!operatorMatch) {
    // Suggest operators
    const isNumericField = field === "duration" || field === "tokens";
    const operators = isNumericField
      ? [
          { op: ">", desc: "greater than" },
          { op: "<", desc: "less than" },
          { op: "=", desc: "equals" },
          { op: ">=", desc: "greater or equal" },
          { op: "<=", desc: "less or equal" },
        ]
      : [
          { op: "is", desc: "exact match" },
          { op: "contains", desc: "partial match" },
        ];

    return operators.map(({ op, desc }) => ({
      text: `${field} ${op} `,
      display: op,
      description: desc,
      example: FIELD_EXAMPLES[field].find((ex) => ex.includes(op)),
    }));
  }

  const operator = operatorMatch[1]?.toLowerCase();
  if (!operator) return [];
  const valueStr = afterField.slice(operatorMatch[0]?.length ?? 0).trim();

  // Stage 3: Value suggestions (common values)
  if (field === "tokens") {
    const commonValues = [100, 500, 1000, 5000];
    return commonValues
      .filter((val) => !valueStr || String(val).startsWith(valueStr))
      .map((val) => ({
        text: `${field} ${operator} ${val}`,
        display: String(val),
        description: `${val} tokens`,
      }));
  }

  if (field === "duration") {
    const commonValues = [25, 100, 500, 1000, 2000];
    return commonValues
      .filter((val) => !valueStr || String(val).startsWith(valueStr))
      .map((val) => ({
        text: `${field} ${operator} ${val}`,
        display: String(val),
        description: `${val}ms`,
      }));
  }

  // For string fields, we can't suggest values without API data
  // Could add hook to fetch available values here
  return [];
}

/**
 * Format parsed filter for display
 */
export function formatParsedFilter(parsed: FilterInput): string {
  const opDisplay = OPERATOR_DISPLAY[parsed.operator] || parsed.operator;
  const value =
    parsed.field === "duration" ? `${parsed.value}ms` : parsed.value;
  return `${parsed.field} ${opDisplay} ${value}`;
}
