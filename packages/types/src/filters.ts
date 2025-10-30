/**
 * Filter system for MCP Gateway web UI
 *
 * Design Reference: https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground?node-id=216-2812
 *
 * This module provides type-safe filter definitions with runtime validation.
 * Zod schemas are the source of truth; TypeScript types are inferred from them.
 */

import { z } from "zod";

// ============================================================================
// Zod Schemas (Source of Truth)
// ============================================================================

/**
 * Available filter fields
 */
export const filterFieldSchema = z.enum([
  "client", // Client name (sender)
  "method", // JSON-RPC method
  "session", // Session ID
  "server", // Server name (receiver)
  "duration", // Duration in milliseconds
  "tokens", // Token count
]);

/**
 * String operators for text fields
 */
export const stringOperatorSchema = z.enum(["is", "contains"]);

/**
 * Numeric operators for number fields
 */
export const numericOperatorSchema = z.enum(["eq", "gt", "lt", "gte", "lte"]);

/**
 * Client filter schema (sender)
 * Supports single value or array for multi-select
 */
export const clientFilterSchema = z.object({
  id: z.string().uuid(),
  field: z.literal("client"),
  operator: stringOperatorSchema,
  value: z.union([
    z.string().min(1, "Client name cannot be empty"),
    z.array(z.string().min(1)).min(1, "At least one client must be selected"),
  ]),
});

/**
 * Method filter schema
 * Supports single value or array for multi-select
 */
export const methodFilterSchema = z.object({
  id: z.string().uuid(),
  field: z.literal("method"),
  operator: stringOperatorSchema,
  value: z.union([
    z.string().min(1, "Method cannot be empty"),
    z.array(z.string().min(1)).min(1, "At least one method must be selected"),
  ]),
});

/**
 * Session filter schema
 * Supports single value or array for multi-select
 */
export const sessionFilterSchema = z.object({
  id: z.string().uuid(),
  field: z.literal("session"),
  operator: stringOperatorSchema,
  value: z.union([
    z.string().min(1, "Session ID cannot be empty"),
    z.array(z.string().min(1)).min(1, "At least one session must be selected"),
  ]),
});

/**
 * Server filter schema (receiver)
 * Supports single value or array for multi-select
 */
export const serverFilterSchema = z.object({
  id: z.string().uuid(),
  field: z.literal("server"),
  operator: stringOperatorSchema,
  value: z.union([
    z.string().min(1, "Server name cannot be empty"),
    z.array(z.string().min(1)).min(1, "At least one server must be selected"),
  ]),
});

/**
 * Duration filter schema (milliseconds)
 * Supports single value or array for multi-select
 */
export const durationFilterSchema = z.object({
  id: z.string().uuid(),
  field: z.literal("duration"),
  operator: numericOperatorSchema,
  value: z.union([
    z.number().int().nonnegative("Duration must be non-negative"),
    z
      .array(z.number().int().nonnegative())
      .min(1, "At least one duration must be selected"),
  ]),
});

/**
 * Tokens filter schema
 * Supports single value or array for multi-select
 */
export const tokensFilterSchema = z.object({
  id: z.string().uuid(),
  field: z.literal("tokens"),
  operator: numericOperatorSchema,
  value: z.union([
    z.number().int().nonnegative("Tokens must be non-negative"),
    z
      .array(z.number().int().nonnegative())
      .min(1, "At least one token count must be selected"),
  ]),
});

/**
 * Discriminated union of all filter types
 *
 * Zod automatically narrows the type based on the `field` discriminator.
 */
export const filterSchema = z.discriminatedUnion("field", [
  clientFilterSchema,
  methodFilterSchema,
  sessionFilterSchema,
  serverFilterSchema,
  durationFilterSchema,
  tokensFilterSchema,
]);

/**
 * Search term schema (for text search pills)
 */
export const searchTermSchema = z.object({
  id: z.string().uuid(),
  query: z.string().min(1, "Search term cannot be empty"),
});

/**
 * Filter state schema (search terms + filters)
 */
export const filterStateSchema = z.object({
  searchTerms: z.array(searchTermSchema).default([]),
  filters: z.array(filterSchema).default([]),
});

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

export type FilterField = z.infer<typeof filterFieldSchema>;
export type StringOperator = z.infer<typeof stringOperatorSchema>;
export type NumericOperator = z.infer<typeof numericOperatorSchema>;

export type ClientFilter = z.infer<typeof clientFilterSchema>;
export type MethodFilter = z.infer<typeof methodFilterSchema>;
export type SessionFilter = z.infer<typeof sessionFilterSchema>;
export type ServerFilter = z.infer<typeof serverFilterSchema>;
export type DurationFilter = z.infer<typeof durationFilterSchema>;
export type TokensFilter = z.infer<typeof tokensFilterSchema>;

/**
 * Union of all possible filter types
 *
 * This is a discriminated union where the `field` property
 * determines which operators and value types are valid.
 */
export type Filter = z.infer<typeof filterSchema>;

/**
 * Search term for text search
 */
export type SearchTerm = z.infer<typeof searchTermSchema>;

/**
 * Filter state including search terms and filters
 */
export type FilterState = z.infer<typeof filterStateSchema>;

// ============================================================================
// Utility Types (Manually Defined - Cannot Be Inferred)
// ============================================================================

/**
 * Map filter fields to their allowed operators
 */
export type FilterOperator<F extends FilterField> = F extends
  | "client"
  | "method"
  | "session"
  | "server"
  ? StringOperator
  : F extends "duration" | "tokens"
    ? NumericOperator
    : never;

/**
 * Map filter field to value type
 * Supports both single values and arrays for multi-select
 */
export type FilterValue<F extends FilterField> = F extends "duration" | "tokens"
  ? number | number[]
  : string | string[];

/**
 * Extract filters for a specific field
 */
export type FiltersForField<F extends FilterField> = Extract<
  Filter,
  { field: F }
>;

/**
 * Get the value type for a field (from actual filter type)
 */
export type FieldValueType<F extends FilterField> = FiltersForField<F>["value"];

/**
 * Filter input without ID (for creating new filters)
 */
export type FilterInput<F extends FilterField = FilterField> = Omit<
  FiltersForField<F>,
  "id"
>;

/**
 * Partial filter for form state (before validation)
 */
export type PartialFilterInput<F extends FilterField = FilterField> = {
  field: F;
  operator?: FilterOperator<F>;
  value?: FilterValue<F>;
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if filter is for string fields
 */
export function isStringFilter(
  filter: Filter,
): filter is ClientFilter | MethodFilter | SessionFilter | ServerFilter {
  return (
    filter.field === "client" ||
    filter.field === "method" ||
    filter.field === "session" ||
    filter.field === "server"
  );
}

/**
 * Type guard to check if filter is for numeric fields
 */
export function isNumericFilter(
  filter: Filter,
): filter is DurationFilter | TokensFilter {
  return filter.field === "duration" || filter.field === "tokens";
}

/**
 * Type guard for specific filter field
 */
export function isFilterField<F extends FilterField>(
  filter: Filter,
  field: F,
): filter is FiltersForField<F> {
  return filter.field === field;
}

/**
 * Type guard for client filter
 */
export function isClientFilter(filter: Filter): filter is ClientFilter {
  return filter.field === "client";
}

/**
 * Type guard for method filter
 */
export function isMethodFilter(filter: Filter): filter is MethodFilter {
  return filter.field === "method";
}

/**
 * Type guard for session filter
 */
export function isSessionFilter(filter: Filter): filter is SessionFilter {
  return filter.field === "session";
}

/**
 * Type guard for server filter
 */
export function isServerFilter(filter: Filter): filter is ServerFilter {
  return filter.field === "server";
}

/**
 * Type guard for duration filter
 */
export function isDurationFilter(filter: Filter): filter is DurationFilter {
  return filter.field === "duration";
}

/**
 * Type guard for tokens filter
 */
export function isTokensFilter(filter: Filter): filter is TokensFilter {
  return filter.field === "tokens";
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new filter with auto-generated UUID
 *
 * @example
 * const clientFilter = createFilter({
 *   field: "client",
 *   operator: "is",
 *   value: "claude-code"
 * });
 */
export function createFilter<F extends FilterField>(
  input: FilterInput<F>,
): FiltersForField<F> {
  return {
    id: crypto.randomUUID(),
    ...input,
  } as FiltersForField<F>;
}

/**
 * Create a new search term with auto-generated UUID
 *
 * @example
 * const searchTerm = createSearchTerm("error");
 */
export function createSearchTerm(query: string): SearchTerm {
  return {
    id: crypto.randomUUID(),
    query,
  };
}

/**
 * Validate a filter object at runtime
 *
 * @throws {ZodError} if validation fails
 */
export function validateFilter(value: unknown): Filter {
  return filterSchema.parse(value);
}

/**
 * Safely parse a filter object (returns result with error info)
 */
export function safeParseFilter(value: unknown) {
  return filterSchema.safeParse(value);
}

/**
 * Validate filter state at runtime
 *
 * @throws {ZodError} if validation fails
 */
export function validateFilterState(value: unknown): FilterState {
  return filterStateSchema.parse(value);
}

/**
 * Safely parse filter state (returns result with error info)
 */
export function safeParseFilterState(value: unknown) {
  return filterStateSchema.safeParse(value);
}
