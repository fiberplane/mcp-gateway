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
 * Result of parsing input - either a filter or search term
 */
export type ParseResult =
  | { type: "filter"; filter: FilterInput }
  | { type: "search"; query: string };

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
 * Parse input and detect if it's a filter or search term
 *
 * @example
 * parseInput("tokens > 150") // { type: "filter", filter: {...} }
 * parseInput("error message") // { type: "search", query: "error message" }
 */
export function parseInput(text: string): ParseResult | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Try to parse as filter
  const filter = parseFilterInput(trimmed);
  if (filter) {
    return { type: "filter", filter };
  }

  // Not a valid filter → treat as search term
  return { type: "search", query: trimmed };
}

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
 * Available autocomplete values fetched from API
 */
export interface AutocompleteValues {
  servers: string[];
  clients: string[];
  methods: string[];
  sessions: string[];
}

/**
 * Get autocomplete suggestions for current input
 */
export function getAutocompleteSuggestions(
  input: string,
  values?: AutocompleteValues,
): FilterSuggestion[] {
  // Don't trim - we need to preserve spaces to detect when user has typed field + space
  const text = input;

  // Stage 1: Field suggestions
  // Only show field suggestions for partial matches (not exact matches)
  // This allows searching for words like "duration", "method", etc.
  if (!text || !text.includes(" ")) {
    const fields: FilterField[] = [
      "tokens",
      "duration",
      "client",
      "method",
      "session",
      "server",
    ];
    const lowerText = text.toLowerCase();
    return fields
      .filter(
        (field) => field.startsWith(lowerText) && field !== lowerText, // Exclude exact matches
      )
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
    // Suggest operators (filter by partial input)
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

    // Filter operators by partial input
    const partialOp = afterField.trim().toLowerCase();
    const filtered = partialOp
      ? operators.filter(({ op }) => op.toLowerCase().startsWith(partialOp))
      : operators;

    return filtered.map(({ op, desc }) => ({
      text: `${field} ${op} `,
      display: op,
      description: desc,
      example: FIELD_EXAMPLES[field].find((ex) => ex.includes(op)),
    }));
  }

  const operator = operatorMatch[1]?.toLowerCase();
  if (!operator) return [];
  const valueStr = afterField.slice(operatorMatch[0]?.length ?? 0).trim();

  // Stage 3: Value suggestions
  if (field === "tokens") {
    // Numeric field - preset common values
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
    // Numeric field - preset common values
    const commonValues = [25, 100, 500, 1000, 2000];
    return commonValues
      .filter((val) => !valueStr || String(val).startsWith(valueStr))
      .map((val) => ({
        text: `${field} ${operator} ${val}`,
        display: String(val),
        description: `${val}ms`,
      }));
  }

  // String fields - use values from API
  if (field === "server" && values?.servers) {
    return values.servers
      .filter(
        (server) =>
          !valueStr || server.toLowerCase().includes(valueStr.toLowerCase()),
      )
      .map((server) => ({
        text: `${field} ${operator} ${server}`,
        display: server,
      }));
  }

  if (field === "client" && values?.clients) {
    return values.clients
      .filter(
        (client) =>
          !valueStr || client.toLowerCase().includes(valueStr.toLowerCase()),
      )
      .map((client) => ({
        text: `${field} ${operator} ${client}`,
        display: client,
      }));
  }

  if (field === "method" && values?.methods) {
    return values.methods
      .filter(
        (method) =>
          !valueStr || method.toLowerCase().includes(valueStr.toLowerCase()),
      )
      .map((method) => ({
        text: `${field} ${operator} ${method}`,
        display: method,
      }));
  }

  if (field === "session" && values?.sessions) {
    // Limit sessions to first 20 to avoid overwhelming the dropdown
    return values.sessions
      .filter(
        (session) =>
          !valueStr || session.toLowerCase().includes(valueStr.toLowerCase()),
      )
      .slice(0, 20)
      .map((session) => ({
        text: `${field} ${operator} ${session}`,
        display: session,
        description: "Recent session",
      }));
  }

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

/**
 * Format a Filter object back to input text for editing
 *
 * @example
 * formatFilterForEditing(filter) // "tokens > 150"
 */
export function formatFilterForEditing(filter: {
  field: string;
  operator: string;
  value: string | number | string[] | number[];
}): string {
  const opDisplay = OPERATOR_DISPLAY[filter.operator] || filter.operator;

  // Handle arrays by taking first value (for simplicity in editing)
  let value: string | number;
  if (Array.isArray(filter.value)) {
    value = filter.value[0] ?? "";
  } else {
    value = filter.value;
  }

  // Don't add "ms" suffix for editing (user types plain number)
  return `${filter.field} ${opDisplay} ${value}`;
}
