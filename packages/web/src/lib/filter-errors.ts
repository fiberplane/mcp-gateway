/**
 * Error types for filter input parsing
 */

import type { FilterField } from "@fiberplane/mcp-gateway-types";

/**
 * Filter parse error types
 */
export type FilterParseError =
  | {
      type: "unknown_field";
      field: string;
      suggestion?: FilterField;
    }
  | {
      type: "invalid_operator";
      operator: string;
      validOperators: string[];
    }
  | {
      type: "invalid_value";
      message: string;
    }
  | {
      type: "incomplete";
      message: string;
    };

/**
 * Format error message for display
 */
export function formatErrorMessage(error: FilterParseError): string {
  switch (error.type) {
    case "unknown_field":
      if (error.suggestion) {
        return `Unknown field '${error.field}'. Did you mean '${error.suggestion}'?`;
      }
      return `Unknown field '${error.field}'. Valid fields: client, method, session, server, duration, tokens`;

    case "invalid_operator":
      return `Invalid operator '${error.operator}'. Valid operators: ${error.validOperators.join(", ")}`;

    case "invalid_value":
      return error.message;

    case "incomplete":
      return error.message;

    default:
      return "Invalid filter input";
  }
}

/**
 * Find closest matching field using Levenshtein distance
 */
export function findClosestField(input: string): FilterField | undefined {
  const fields: FilterField[] = [
    "client",
    "method",
    "session",
    "server",
    "duration",
    "tokens",
  ];

  const distances = fields.map((field) => ({
    field,
    distance: levenshteinDistance(input.toLowerCase(), field),
  }));

  // Sort by distance
  distances.sort((a, b) => a.distance - b.distance);

  // Only suggest if distance is reasonable (< 3 edits)
  if (distances[0] && distances[0].distance < 3) {
    return distances[0].field;
  }

  return undefined;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    const row = matrix[0];
    if (row) row[j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const currentRow = matrix[i];
      const prevRow = matrix[i - 1];
      const leftRow = matrix[i];

      if (!currentRow || !prevRow || !leftRow) continue;

      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        currentRow[j] = prevRow[j - 1] ?? 0;
      } else {
        currentRow[j] = Math.min(
          (prevRow[j - 1] ?? 0) + 1, // substitution
          (currentRow[j - 1] ?? 0) + 1, // insertion
          (prevRow[j] ?? 0) + 1, // deletion
        );
      }
    }
  }

  const lastRow = matrix[b.length];
  return lastRow?.[a.length] ?? 0;
}
