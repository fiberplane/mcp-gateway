# Filter Component Implementation Example

This document shows practical implementation examples for the filter type system.

## File: `packages/types/src/filter-types.ts`

```typescript
/**
 * Filter types for MCP Gateway log filtering
 *
 * Provides compile-time type safety for filter field/operator/value combinations.
 */

/**
 * Maps filterable fields to their value types
 */
export interface FilterFieldTypeMap {
  // String fields
  method: string;
  sessionId: string;
  serverName: string;
  clientName: string;
  clientIp: string;
  sender: string;    // Alias for client name
  receiver: string;  // Alias for server name

  // Number fields
  duration: number;
  httpStatus: number;

  // Date fields
  timestamp: Date;
}

/**
 * Filterable field names
 */
export type FilterField = keyof FilterFieldTypeMap;

/**
 * Maps value types to their valid operators
 */
export interface OperatorTypeMap {
  string: "eq" | "neq" | "contains" | "startsWith" | "endsWith";
  number: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  Date: "before" | "after" | "between";
}

/**
 * String operator type
 */
export type StringOperator = OperatorTypeMap["string"];

/**
 * Number operator type
 */
export type NumberOperator = OperatorTypeMap["number"];

/**
 * Date operator type
 */
export type DateOperator = OperatorTypeMap["Date"];

/**
 * Get valid operators for a specific field
 */
export type FilterOperator<F extends FilterField> =
  FilterFieldTypeMap[F] extends string
    ? OperatorTypeMap["string"]
    : FilterFieldTypeMap[F] extends number
    ? OperatorTypeMap["number"]
    : FilterFieldTypeMap[F] extends Date
    ? OperatorTypeMap["Date"]
    : never;

/**
 * Get value type for a field and operator combination
 */
export type FilterValue<F extends FilterField, O extends FilterOperator<F>> =
  O extends "between"
    ? readonly [FilterFieldTypeMap[F], FilterFieldTypeMap[F]]
    : FilterFieldTypeMap[F];

/**
 * Generic typed filter with full type safety
 */
export interface TypedFilter<
  F extends FilterField,
  O extends FilterOperator<F> = FilterOperator<F>
> {
  readonly id: string;
  readonly field: F;
  readonly operator: O;
  readonly value: FilterValue<F, O>;
  readonly enabled: boolean;
}

/**
 * Union of all possible filter types
 */
export type Filter = {
  [F in FilterField]: {
    [O in FilterOperator<F>]: TypedFilter<F, O>;
  }[FilterOperator<F>];
}[FilterField];

/**
 * Quick filters for common filter combinations
 */
export interface QuickFilters {
  readonly showErrors: boolean;
  readonly showSuccessOnly: boolean;
  readonly showSlowRequests: boolean;
}

/**
 * Complete filter state
 */
export interface FilterState {
  readonly search: string;
  readonly filters: readonly Filter[];
  readonly quickFilters: QuickFilters;
}

/**
 * Filter actions for state updates
 */
export type FilterAction =
  | { type: "SET_SEARCH"; payload: string }
  | { type: "ADD_FILTER"; payload: Filter }
  | { type: "UPDATE_FILTER"; payload: { id: string; updates: Partial<Omit<Filter, "id">> } }
  | { type: "REMOVE_FILTER"; payload: string }
  | { type: "TOGGLE_FILTER"; payload: string }
  | { type: "CLEAR_FILTERS" }
  | { type: "SET_QUICK_FILTER"; payload: { filter: keyof QuickFilters; enabled: boolean } }
  | { type: "SET_FILTERS"; payload: readonly Filter[] };

/**
 * Filter validation error types
 */
export type FilterValidationError =
  | { type: "invalid_field"; field: string; message: string }
  | { type: "invalid_operator"; field: FilterField; operator: string; message: string }
  | { type: "invalid_value"; field: FilterField; operator: string; value: unknown; message: string }
  | { type: "parse_error"; input: string; message: string };

/**
 * Filter validation result
 */
export type FilterValidationResult =
  | { valid: true; filter: Filter }
  | { valid: false; error: FilterValidationError };
```

## File: `packages/types/src/filter-schemas.ts`

```typescript
import { z } from "zod";
import type {
  DateOperator,
  Filter,
  FilterField,
  FilterState,
  NumberOperator,
  QuickFilters,
  StringOperator,
} from "./filter-types.js";

/**
 * Zod schemas for filter validation
 */

// Operator schemas
export const stringOperatorSchema = z.enum([
  "eq",
  "neq",
  "contains",
  "startsWith",
  "endsWith",
]) satisfies z.ZodType<StringOperator>;

export const numberOperatorSchema = z.enum([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
]) satisfies z.ZodType<NumberOperator>;

export const dateOperatorSchema = z.enum([
  "before",
  "after",
  "between",
]) satisfies z.ZodType<DateOperator>;

// Field schemas
const stringFieldSchema = z.enum([
  "method",
  "sessionId",
  "serverName",
  "clientName",
  "clientIp",
  "sender",
  "receiver",
]);

const numberFieldSchema = z.enum(["duration", "httpStatus"]);

const dateFieldSchema = z.literal("timestamp");

// Filter schemas
export const stringFilterSchema = z.object({
  id: z.string(),
  field: stringFieldSchema,
  operator: stringOperatorSchema,
  value: z.string(),
  enabled: z.boolean(),
});

export const numberFilterSchema = z.object({
  id: z.string(),
  field: numberFieldSchema,
  operator: numberOperatorSchema,
  value: z.number(),
  enabled: z.boolean(),
});

export const dateFilterSchema = z.object({
  id: z.string(),
  field: dateFieldSchema,
  operator: z.enum(["before", "after"]),
  value: z.coerce.date(),
  enabled: z.boolean(),
});

export const dateRangeFilterSchema = z.object({
  id: z.string(),
  field: dateFieldSchema,
  operator: z.literal("between"),
  value: z.tuple([z.coerce.date(), z.coerce.date()]),
  enabled: z.boolean(),
});

// Combined filter schema
export const filterSchema = z.discriminatedUnion("field", [
  stringFilterSchema,
  numberFilterSchema,
  dateFilterSchema,
  dateRangeFilterSchema,
]) satisfies z.ZodType<Filter>;

// Quick filters schema
export const quickFiltersSchema = z.object({
  showErrors: z.boolean(),
  showSuccessOnly: z.boolean(),
  showSlowRequests: z.boolean(),
}) satisfies z.ZodType<QuickFilters>;

// Filter state schema
export const filterStateSchema = z.object({
  search: z.string(),
  filters: z.array(filterSchema),
  quickFilters: quickFiltersSchema,
}) satisfies z.ZodType<FilterState>;

/**
 * Field-specific schema lookup
 */
export const filterSchemasByField: Record<FilterField, z.ZodTypeAny> = {
  method: stringFilterSchema,
  sessionId: stringFilterSchema,
  serverName: stringFilterSchema,
  clientName: stringFilterSchema,
  clientIp: stringFilterSchema,
  sender: stringFilterSchema,
  receiver: stringFilterSchema,
  duration: numberFilterSchema,
  httpStatus: numberFilterSchema,
  timestamp: z.union([dateFilterSchema, dateRangeFilterSchema]),
};
```

## File: `packages/types/src/filter-utils.ts`

```typescript
import type {
  Filter,
  FilterField,
  FilterFieldTypeMap,
  FilterOperator,
  FilterValidationError,
  FilterValidationResult,
  FilterValue,
  TypedFilter,
} from "./filter-types.js";
import { filterSchema, filterSchemasByField } from "./filter-schemas.js";

/**
 * Create a type-safe filter
 */
export function createFilter<
  F extends FilterField,
  O extends FilterOperator<F>
>(
  field: F,
  operator: O,
  value: FilterValue<F, O>,
  enabled = true
): TypedFilter<F, O> {
  return {
    id: crypto.randomUUID(),
    field,
    operator,
    value,
    enabled,
  };
}

/**
 * Type guard for valid filter fields
 */
export function isValidField(field: string): field is FilterField {
  return field in filterSchemasByField;
}

/**
 * Validate a filter
 */
export function validateFilter(input: unknown): FilterValidationResult {
  const result = filterSchema.safeParse(input);

  if (result.success) {
    return { valid: true, filter: result.data };
  }

  const zodError = result.error.errors[0];

  switch (zodError.path[0]) {
    case "field":
      return {
        valid: false,
        error: {
          type: "invalid_field",
          field: String((input as any)?.field),
          message: `Invalid filter field: ${zodError.message}`,
        },
      };

    case "operator":
      return {
        valid: false,
        error: {
          type: "invalid_operator",
          field: (input as any)?.field,
          operator: String((input as any)?.operator),
          message: `Invalid operator: ${zodError.message}`,
        },
      };

    case "value":
      return {
        valid: false,
        error: {
          type: "invalid_value",
          field: (input as any)?.field,
          operator: (input as any)?.operator,
          value: (input as any)?.value,
          message: zodError.message,
        },
      };

    default:
      return {
        valid: false,
        error: {
          type: "parse_error",
          input: JSON.stringify(input),
          message: zodError.message,
        },
      };
  }
}

/**
 * Serialize filter to URL string
 */
export function serializeFilter(filter: Filter): string {
  const value = Array.isArray(filter.value)
    ? filter.value.map(formatValue).join(",")
    : formatValue(filter.value);

  return `${filter.field}:${filter.operator}:${value}`;
}

/**
 * Deserialize filter from URL string
 */
export function deserializeFilter(serialized: string): Filter | null {
  try {
    const [field, operator, rawValue] = serialized.split(":");

    if (!isValidField(field) || !operator || rawValue === undefined) {
      return null;
    }

    const value = parseValue(rawValue, field);
    const schema = filterSchemasByField[field];

    const result = schema.safeParse({
      id: crypto.randomUUID(),
      field,
      operator,
      value,
      enabled: true,
    });

    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Format value for URL serialization
 */
function formatValue(value: string | number | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

/**
 * Parse value from URL string
 */
function parseValue(rawValue: string, field: FilterField): unknown {
  const sampleValue = {} as FilterFieldTypeMap;
  const fieldType = typeof sampleValue[field];

  if (fieldType === "number") {
    return Number(rawValue);
  }

  if (field === "timestamp") {
    if (rawValue.includes(",")) {
      return rawValue.split(",").map((s) => new Date(s));
    }
    return new Date(rawValue);
  }

  return rawValue;
}

/**
 * Get operators for a field
 */
export function getOperatorsForField<F extends FilterField>(
  field: F
): readonly FilterOperator<F>[] {
  const sampleValue = {} as FilterFieldTypeMap;
  const fieldType = typeof sampleValue[field];

  if (fieldType === "number") {
    return ["eq", "neq", "gt", "gte", "lt", "lte"] as const;
  }

  if (field === "timestamp") {
    return ["before", "after", "between"] as const;
  }

  return ["eq", "neq", "contains", "startsWith", "endsWith"] as const;
}

/**
 * Get label for operator
 */
export function getOperatorLabel(operator: string): string {
  const labels: Record<string, string> = {
    eq: "equals",
    neq: "not equals",
    contains: "contains",
    startsWith: "starts with",
    endsWith: "ends with",
    gt: "greater than",
    gte: "greater than or equal",
    lt: "less than",
    lte: "less than or equal",
    before: "before",
    after: "after",
    between: "between",
  };

  return labels[operator] || operator;
}

/**
 * Get label for field
 */
export function getFieldLabel(field: FilterField): string {
  const labels: Record<FilterField, string> = {
    method: "Method",
    sessionId: "Session ID",
    serverName: "Server",
    clientName: "Client",
    clientIp: "Client IP",
    sender: "Sender",
    receiver: "Receiver",
    duration: "Duration (ms)",
    httpStatus: "HTTP Status",
    timestamp: "Timestamp",
  };

  return labels[field];
}
```

## File: `packages/types/src/filters.ts`

```typescript
/**
 * Filter types, schemas, and utilities for MCP Gateway
 */

export * from "./filter-types.js";
export * from "./filter-schemas.js";
export * from "./filter-utils.js";
```

## File: `packages/web/src/lib/filter-reducer.ts`

```typescript
import { produce } from "immer";
import type { FilterAction, FilterState } from "@fiberplane/mcp-gateway-types";

/**
 * Initial filter state
 */
export const initialFilterState: FilterState = {
  search: "",
  filters: [],
  quickFilters: {
    showErrors: false,
    showSuccessOnly: false,
    showSlowRequests: false,
  },
};

/**
 * Filter state reducer
 */
export function filterReducer(
  state: FilterState,
  action: FilterAction
): FilterState {
  switch (action.type) {
    case "SET_SEARCH":
      return { ...state, search: action.payload };

    case "ADD_FILTER":
      return { ...state, filters: [...state.filters, action.payload] };

    case "UPDATE_FILTER":
      return produce(state, (draft) => {
        const filter = draft.filters.find((f) => f.id === action.payload.id);
        if (filter) {
          Object.assign(filter, action.payload.updates);
        }
      });

    case "REMOVE_FILTER":
      return {
        ...state,
        filters: state.filters.filter((f) => f.id !== action.payload),
      };

    case "TOGGLE_FILTER":
      return produce(state, (draft) => {
        const filter = draft.filters.find((f) => f.id === action.payload);
        if (filter) {
          filter.enabled = !filter.enabled;
        }
      });

    case "CLEAR_FILTERS":
      return {
        ...state,
        filters: [],
        quickFilters: {
          showErrors: false,
          showSuccessOnly: false,
          showSlowRequests: false,
        },
      };

    case "SET_QUICK_FILTER":
      return produce(state, (draft) => {
        draft.quickFilters[action.payload.filter] = action.payload.enabled;
      });

    case "SET_FILTERS":
      return { ...state, filters: action.payload as Filter[] };

    default:
      return state;
  }
}
```

## File: `packages/web/src/lib/filter-url.ts`

```typescript
import {
  deserializeFilter,
  serializeFilter,
  type FilterState,
} from "@fiberplane/mcp-gateway-types";

/**
 * URL parameter structure for filters
 */
export interface FilterURLParams {
  search?: string;
  filters?: string;
  quick?: string;
}

/**
 * Serialize filter state to URL parameters
 */
export function serializeFilterState(state: FilterState): FilterURLParams {
  const params: FilterURLParams = {};

  if (state.search) {
    params.search = state.search;
  }

  const enabledFilters = state.filters.filter((f) => f.enabled);
  if (enabledFilters.length > 0) {
    params.filters = enabledFilters.map(serializeFilter).join(",");
  }

  const enabledQuickFilters = Object.entries(state.quickFilters)
    .filter(([_, enabled]) => enabled)
    .map(([key]) => key);

  if (enabledQuickFilters.length > 0) {
    params.quick = enabledQuickFilters.join(",");
  }

  return params;
}

/**
 * Deserialize filter state from URL parameters
 */
export function deserializeFilterState(
  params: FilterURLParams
): Partial<FilterState> {
  const state: Partial<FilterState> = {};

  if (params.search) {
    state.search = params.search;
  }

  if (params.filters) {
    const filters = params.filters
      .split(",")
      .map(deserializeFilter)
      .filter((f): f is NonNullable<typeof f> => f !== null);

    if (filters.length > 0) {
      state.filters = filters;
    }
  }

  if (params.quick) {
    const quickFilters = {
      showErrors: false,
      showSuccessOnly: false,
      showSlowRequests: false,
    };

    for (const key of params.quick.split(",")) {
      if (key in quickFilters) {
        quickFilters[key as keyof typeof quickFilters] = true;
      }
    }

    state.quickFilters = quickFilters;
  }

  return state;
}
```

## File: `packages/web/src/lib/filter-api-adapter.ts`

```typescript
import type {
  ApiLogEntry,
  Filter,
  FilterState,
  LogQueryOptions,
} from "@fiberplane/mcp-gateway-types";

/**
 * Filter application strategy
 */
interface FilterStrategy {
  serverSide: LogQueryOptions;
  clientSide: readonly Filter[];
}

/**
 * Convert filter state to API query options and client-side filters
 */
export function convertFiltersToStrategy(
  state: FilterState
): FilterStrategy {
  const serverSide: LogQueryOptions = {};
  const clientSide: Filter[] = [];

  // Apply search as method filter (simple implementation)
  if (state.search) {
    serverSide.method = state.search;
  }

  // Process structured filters
  for (const filter of state.filters) {
    if (!filter.enabled) continue;

    if (isApiSupported(filter)) {
      applyToQueryOptions(serverSide, filter);
    } else {
      clientSide.push(filter);
    }
  }

  // Apply quick filters (client-side for now)
  // Could be converted to structured filters

  return { serverSide, clientSide };
}

/**
 * Check if filter is supported by API
 */
function isApiSupported(filter: Filter): boolean {
  // API only supports exact match for string fields
  const exactMatchFields = [
    "method",
    "sessionId",
    "serverName",
    "clientName",
    "clientIp",
  ] as const;

  if (exactMatchFields.includes(filter.field as any)) {
    return filter.operator === "eq";
  }

  // API supports timestamp ranges
  if (filter.field === "timestamp") {
    return true;
  }

  return false;
}

/**
 * Apply filter to query options
 */
function applyToQueryOptions(options: LogQueryOptions, filter: Filter): void {
  switch (filter.field) {
    case "method":
      if (filter.operator === "eq") options.method = filter.value;
      break;
    case "sessionId":
      if (filter.operator === "eq") options.sessionId = filter.value;
      break;
    case "serverName":
      if (filter.operator === "eq") options.serverName = filter.value;
      break;
    case "clientName":
      if (filter.operator === "eq") options.clientName = filter.value;
      break;
    case "clientIp":
      if (filter.operator === "eq") options.clientIp = filter.value;
      break;
    case "timestamp":
      if (filter.operator === "before") {
        options.before = filter.value.toISOString();
      } else if (filter.operator === "after") {
        options.after = filter.value.toISOString();
      } else if (filter.operator === "between") {
        const [start, end] = filter.value;
        options.after = start.toISOString();
        options.before = end.toISOString();
      }
      break;
  }
}

/**
 * Apply client-side filters to log entries
 */
export function applyClientSideFilters(
  logs: ApiLogEntry[],
  filters: readonly Filter[]
): ApiLogEntry[] {
  return logs.filter((log) => {
    for (const filter of filters) {
      if (!filter.enabled) continue;

      switch (filter.field) {
        case "duration": {
          const duration = log.metadata.durationMs;
          if (!matchNumberFilter(duration, filter.operator, filter.value)) {
            return false;
          }
          break;
        }

        case "httpStatus": {
          const status = log.metadata.httpStatus;
          if (!matchNumberFilter(status, filter.operator, filter.value)) {
            return false;
          }
          break;
        }

        case "sender": {
          const sender = log.metadata.client?.name ?? "";
          if (!matchStringFilter(sender, filter.operator, filter.value)) {
            return false;
          }
          break;
        }

        case "receiver": {
          const receiver = log.metadata.server?.name ?? "";
          if (!matchStringFilter(receiver, filter.operator, filter.value)) {
            return false;
          }
          break;
        }

        // String filters not supported by API
        case "method":
        case "sessionId":
        case "serverName":
        case "clientName":
        case "clientIp":
          if (filter.operator !== "eq") {
            const value = getFieldValue(log, filter.field);
            if (!matchStringFilter(value, filter.operator, filter.value)) {
              return false;
            }
          }
          break;
      }
    }

    return true;
  });
}

/**
 * Get field value from log entry
 */
function getFieldValue(log: ApiLogEntry, field: string): string {
  switch (field) {
    case "method":
      return log.method;
    case "sessionId":
      return log.metadata.sessionId;
    case "serverName":
      return log.metadata.serverName;
    case "clientName":
      return log.metadata.client?.name ?? "";
    case "clientIp":
      return log.metadata.clientIp ?? "";
    default:
      return "";
  }
}

/**
 * Match string filter
 */
function matchStringFilter(
  value: string,
  operator: string,
  filterValue: string
): boolean {
  const lower = value.toLowerCase();
  const lowerFilter = filterValue.toLowerCase();

  switch (operator) {
    case "eq":
      return lower === lowerFilter;
    case "neq":
      return lower !== lowerFilter;
    case "contains":
      return lower.includes(lowerFilter);
    case "startsWith":
      return lower.startsWith(lowerFilter);
    case "endsWith":
      return lower.endsWith(lowerFilter);
    default:
      return true;
  }
}

/**
 * Match number filter
 */
function matchNumberFilter(
  value: number,
  operator: string,
  filterValue: number
): boolean {
  switch (operator) {
    case "eq":
      return value === filterValue;
    case "neq":
      return value !== filterValue;
    case "gt":
      return value > filterValue;
    case "gte":
      return value >= filterValue;
    case "lt":
      return value < filterValue;
    case "lte":
      return value <= filterValue;
    default:
      return true;
  }
}
```

## Usage Example

```typescript
import { useReducer } from "react";
import { createFilter } from "@fiberplane/mcp-gateway-types";
import { filterReducer, initialFilterState } from "./lib/filter-reducer";
import { convertFiltersToStrategy, applyClientSideFilters } from "./lib/filter-api-adapter";
import { api } from "./lib/api";

function LogsPage() {
  const [filterState, dispatch] = useReducer(filterReducer, initialFilterState);

  // Add filter
  const addDurationFilter = () => {
    const filter = createFilter("duration", "gt", 1000);
    dispatch({ type: "ADD_FILTER", payload: filter });
  };

  // Fetch logs with filters
  const fetchLogs = async () => {
    const { serverSide, clientSide } = convertFiltersToStrategy(filterState);

    const { data } = await api.getLogs(serverSide);
    const filtered = applyClientSideFilters(data, clientSide);

    return filtered;
  };

  return (
    <div>
      <button onClick={addDurationFilter}>
        Add slow request filter
      </button>
      {/* Filter UI components */}
    </div>
  );
}
```

This implementation provides:
- ✅ Full type safety
- ✅ Runtime validation with Zod
- ✅ URL serialization
- ✅ Hybrid filtering (server + client)
- ✅ Immutable updates with Immer
- ✅ Clean separation of concerns
