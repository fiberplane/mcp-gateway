# Filter Component Type System Design

## Executive Summary

This document provides a comprehensive TypeScript type system design for the MCP Gateway web UI filter component. The design prioritizes **compile-time type safety**, **runtime validation**, and **seamless integration** with existing API types.

## Current Type Landscape

### Existing API Types (`@fiberplane/mcp-gateway-types`)

```typescript
// From packages/types/src/logs.ts
export interface LogQueryOptions {
  serverName?: string;
  sessionId?: string;
  method?: string;
  clientName?: string;
  clientVersion?: string;
  clientIp?: string;
  after?: string; // ISO timestamp
  before?: string; // ISO timestamp
  limit?: number;
  order?: "asc" | "desc";
}
```

### Current API Validation (`@fiberplane/mcp-gateway-api`)

```typescript
// From packages/api/src/routes/index.ts
const logsQuerySchema = z.object({
  server: z.string().optional(),
  session: z.string().optional(),
  method: z.string().optional(),
  after: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  order: z.enum(["asc", "desc"]).optional(),
})
```

## Recommended Type System Design

### 1. Field Type Mapping (Type-Safe Foundation)

```typescript
/**
 * Maps filterable fields to their value types
 *
 * This is the single source of truth for field types.
 * All other types derive from this mapping.
 */
interface FilterFieldTypeMap {
  method: string;
  sessionId: string;
  sender: string;      // From metadata.client.name
  receiver: string;    // From metadata.server.name
  serverName: string;  // From metadata.serverName
  clientName: string;  // From metadata.client.name
  clientIp: string;    // From metadata.clientIp
  duration: number;    // From metadata.durationMs
  httpStatus: number;  // From metadata.httpStatus
  timestamp: Date;     // From timestamp field
}

/**
 * Extract filterable field names
 */
type FilterField = keyof FilterFieldTypeMap;
```

### 2. Operator Type Mapping (Compile-Time Safety)

```typescript
/**
 * Maps value types to their valid operators
 *
 * This ensures operators are only used with compatible field types.
 */
interface OperatorTypeMap {
  string: "eq" | "neq" | "contains" | "startsWith" | "endsWith";
  number: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  Date: "before" | "after" | "between";
}

/**
 * Get valid operators for a specific field
 *
 * Example: FilterOperator<'duration'> = "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
 */
type FilterOperator<F extends FilterField> =
  FilterFieldTypeMap[F] extends string
    ? OperatorTypeMap["string"]
    : FilterFieldTypeMap[F] extends number
    ? OperatorTypeMap["number"]
    : FilterFieldTypeMap[F] extends Date
    ? OperatorTypeMap["Date"]
    : never;
```

### 3. Filter Definition (Discriminated Union)

```typescript
/**
 * Base filter interface with common fields
 */
interface BaseFilter<F extends FilterField> {
  readonly id: string;  // Unique identifier for React keys
  readonly field: F;
  readonly enabled: boolean;
}

/**
 * String filter with string-specific operators
 */
interface StringFilter extends BaseFilter<Extract<FilterField, { [K in FilterField]: FilterFieldTypeMap[K] extends string ? K : never }[FilterField]>> {
  readonly operator: OperatorTypeMap["string"];
  readonly value: string;
}

/**
 * Number filter with number-specific operators
 */
interface NumberFilter extends BaseFilter<Extract<FilterField, { [K in FilterField]: FilterFieldTypeMap[K] extends number ? K : never }[FilterField]>> {
  readonly operator: OperatorTypeMap["number"];
  readonly value: number;
}

/**
 * Date filter with date-specific operators
 *
 * Note: 'between' operator requires a tuple of two dates
 */
interface DateFilter extends BaseFilter<"timestamp"> {
  readonly operator: "before" | "after";
  readonly value: Date;
}

interface DateRangeFilter extends BaseFilter<"timestamp"> {
  readonly operator: "between";
  readonly value: readonly [Date, Date];
}

/**
 * Discriminated union of all filter types
 *
 * TypeScript can discriminate on the 'field' property to narrow the type
 */
type Filter = StringFilter | NumberFilter | DateFilter | DateRangeFilter;
```

### 4. Improved Design with Mapped Types (Recommended)

For better type inference and less repetition:

```typescript
/**
 * Filter value type based on field and operator
 */
type FilterValue<F extends FilterField, O extends FilterOperator<F>> =
  O extends "between"
    ? readonly [FilterFieldTypeMap[F], FilterFieldTypeMap[F]]
    : FilterFieldTypeMap[F];

/**
 * Generic filter type with full type safety
 *
 * The operator is constrained by the field type,
 * and the value type is constrained by both field and operator.
 */
interface TypedFilter<
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
 * Union of all possible typed filters
 *
 * This allows for discriminated union behavior while maintaining
 * complete type safety for field-operator-value combinations.
 */
type Filter = {
  [F in FilterField]: {
    [O in FilterOperator<F>]: TypedFilter<F, O>;
  }[FilterOperator<F>];
}[FilterField];
```

**Benefits:**
- Operators automatically constrained by field type
- Value type automatically inferred from field and operator
- Full type narrowing when checking `filter.field`
- No redundant type definitions

### 5. Filter State Management

```typescript
/**
 * Complete filter state for the application
 */
interface FilterState {
  /**
   * Global text search (searches across all string fields)
   */
  readonly search: string;

  /**
   * Structured filters with type safety
   */
  readonly filters: readonly Filter[];

  /**
   * Quick filters (common preset filters)
   */
  readonly quickFilters: {
    readonly showErrors: boolean;      // httpStatus >= 400
    readonly showSuccessOnly: boolean; // httpStatus < 400
    readonly showSlowRequests: boolean; // duration > threshold
  };
}

/**
 * Filter actions for state updates
 *
 * Using discriminated unions for type-safe action creators
 */
type FilterAction =
  | { type: "SET_SEARCH"; payload: string }
  | { type: "ADD_FILTER"; payload: Filter }
  | { type: "UPDATE_FILTER"; payload: { id: string; filter: Partial<Filter> } }
  | { type: "REMOVE_FILTER"; payload: string }
  | { type: "TOGGLE_FILTER"; payload: string }
  | { type: "CLEAR_FILTERS" }
  | { type: "SET_QUICK_FILTER"; payload: { filter: keyof FilterState["quickFilters"]; enabled: boolean } };

/**
 * Type-safe reducer for filter state
 */
function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "SET_SEARCH":
      return { ...state, search: action.payload };

    case "ADD_FILTER":
      return {
        ...state,
        filters: [...state.filters, action.payload]
      };

    case "UPDATE_FILTER": {
      const filters = state.filters.map(f =>
        f.id === action.payload.id
          ? { ...f, ...action.payload.filter } as Filter
          : f
      );
      return { ...state, filters };
    }

    case "REMOVE_FILTER":
      return {
        ...state,
        filters: state.filters.filter(f => f.id !== action.payload)
      };

    case "TOGGLE_FILTER":
      return {
        ...state,
        filters: state.filters.map(f =>
          f.id === action.payload ? { ...f, enabled: !f.enabled } : f
        )
      };

    case "CLEAR_FILTERS":
      return {
        ...state,
        filters: [],
        quickFilters: {
          showErrors: false,
          showSuccessOnly: false,
          showSlowRequests: false,
        }
      };

    case "SET_QUICK_FILTER":
      return {
        ...state,
        quickFilters: {
          ...state.quickFilters,
          [action.payload.filter]: action.payload.enabled
        }
      };

    default:
      return state;
  }
}
```

### 6. URL Serialization (Type-Safe)

```typescript
/**
 * Serialized filter format for URL parameters
 *
 * Format: field:operator:value
 * Example: duration:gt:100
 */
type SerializedFilter = `${FilterField}:${string}:${string}`;

/**
 * Serialize a filter to URL-safe string
 */
function serializeFilter(filter: Filter): SerializedFilter {
  const value = Array.isArray(filter.value)
    ? filter.value.map(v => v instanceof Date ? v.toISOString() : String(v)).join(",")
    : filter.value instanceof Date
    ? filter.value.toISOString()
    : String(filter.value);

  return `${filter.field}:${filter.operator}:${value}`;
}

/**
 * Deserialize filter from URL string
 *
 * Returns null if parsing fails (graceful degradation)
 */
function deserializeFilter(serialized: string): Filter | null {
  try {
    const [field, operator, value] = serialized.split(":");

    if (!isValidField(field) || !operator || !value) {
      return null;
    }

    // Type-safe deserialization using Zod schemas
    const schema = filterSchemas[field];
    const parsed = schema.safeParse({ field, operator, value });

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Type guard for valid filter fields
 */
function isValidField(field: string): field is FilterField {
  return field in filterFieldTypeMap;
}

/**
 * URL state serialization
 */
interface FilterURLParams {
  search?: string;
  filters?: string; // Comma-separated serialized filters
  quick?: string;   // Comma-separated quick filter keys
}

function serializeFilterState(state: FilterState): FilterURLParams {
  const params: FilterURLParams = {};

  if (state.search) {
    params.search = state.search;
  }

  if (state.filters.length > 0) {
    params.filters = state.filters
      .filter(f => f.enabled)
      .map(serializeFilter)
      .join(",");
  }

  const enabledQuickFilters = Object.entries(state.quickFilters)
    .filter(([_, enabled]) => enabled)
    .map(([key]) => key);

  if (enabledQuickFilters.length > 0) {
    params.quick = enabledQuickFilters.join(",");
  }

  return params;
}

function deserializeFilterState(params: FilterURLParams): Partial<FilterState> {
  const state: Partial<FilterState> = {};

  if (params.search) {
    state.search = params.search;
  }

  if (params.filters) {
    state.filters = params.filters
      .split(",")
      .map(deserializeFilter)
      .filter((f): f is Filter => f !== null);
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

### 7. Zod Schema Integration (Runtime Validation)

```typescript
import { z } from "zod";

/**
 * Zod schemas for runtime validation
 *
 * These schemas should be added to @fiberplane/mcp-gateway-types
 */

const stringOperatorSchema = z.enum(["eq", "neq", "contains", "startsWith", "endsWith"]);
const numberOperatorSchema = z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]);
const dateOperatorSchema = z.enum(["before", "after", "between"]);

const stringFilterSchema = z.object({
  id: z.string(),
  field: z.enum(["method", "sessionId", "sender", "receiver", "serverName", "clientName", "clientIp"]),
  operator: stringOperatorSchema,
  value: z.string(),
  enabled: z.boolean(),
});

const numberFilterSchema = z.object({
  id: z.string(),
  field: z.enum(["duration", "httpStatus"]),
  operator: numberOperatorSchema,
  value: z.number(),
  enabled: z.boolean(),
});

const dateFilterSchema = z.object({
  id: z.string(),
  field: z.literal("timestamp"),
  operator: z.enum(["before", "after"]),
  value: z.coerce.date(),
  enabled: z.boolean(),
});

const dateRangeFilterSchema = z.object({
  id: z.string(),
  field: z.literal("timestamp"),
  operator: z.literal("between"),
  value: z.tuple([z.coerce.date(), z.coerce.date()]),
  enabled: z.boolean(),
});

const filterSchema = z.discriminatedUnion("field", [
  stringFilterSchema,
  numberFilterSchema,
  dateFilterSchema,
  dateRangeFilterSchema,
]);

const filterStateSchema = z.object({
  search: z.string(),
  filters: z.array(filterSchema),
  quickFilters: z.object({
    showErrors: z.boolean(),
    showSuccessOnly: z.boolean(),
    showSlowRequests: z.boolean(),
  }),
});

/**
 * Map of field-specific schemas for deserialization
 */
const filterSchemas: Record<FilterField, z.ZodSchema<Filter>> = {
  method: stringFilterSchema,
  sessionId: stringFilterSchema,
  sender: stringFilterSchema,
  receiver: stringFilterSchema,
  serverName: stringFilterSchema,
  clientName: stringFilterSchema,
  clientIp: stringFilterSchema,
  duration: numberFilterSchema,
  httpStatus: numberFilterSchema,
  timestamp: z.union([dateFilterSchema, dateRangeFilterSchema]),
};

/**
 * Type-safe filter validation
 */
function validateFilter(filter: unknown): filter is Filter {
  return filterSchema.safeParse(filter).success;
}

function validateFilterState(state: unknown): state is FilterState {
  return filterStateSchema.safeParse(state).success;
}
```

### 8. API Integration Layer

```typescript
/**
 * Convert internal filter state to API query parameters
 *
 * This bridges the gap between the web UI filter system
 * and the existing LogQueryOptions API.
 */
function convertFiltersToQueryOptions(state: FilterState): LogQueryOptions {
  const options: LogQueryOptions = {};

  // Apply search as method filter (could be expanded to multi-field search)
  if (state.search) {
    options.method = state.search;
  }

  // Apply structured filters
  for (const filter of state.filters) {
    if (!filter.enabled) continue;

    switch (filter.field) {
      case "method":
        if (filter.operator === "eq") {
          options.method = filter.value;
        }
        // Note: API only supports exact match for method
        // Other operators would need backend support
        break;

      case "sessionId":
        if (filter.operator === "eq") {
          options.sessionId = filter.value;
        }
        break;

      case "serverName":
        if (filter.operator === "eq") {
          options.serverName = filter.value;
        }
        break;

      case "clientName":
        if (filter.operator === "eq") {
          options.clientName = filter.value;
        }
        break;

      case "clientIp":
        if (filter.operator === "eq") {
          options.clientIp = filter.value;
        }
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

      // Duration and httpStatus filters require client-side filtering
      // (not currently supported by API)
      case "duration":
      case "httpStatus":
        // Store in separate array for client-side filtering
        break;
    }
  }

  // Apply quick filters
  if (state.quickFilters.showErrors) {
    // Would need API support or client-side filtering
  }

  return options;
}

/**
 * Client-side filter function for fields not supported by API
 */
function applyClientSideFilters(
  logs: ApiLogEntry[],
  state: FilterState
): ApiLogEntry[] {
  return logs.filter(log => {
    // Check each enabled filter
    for (const filter of state.filters) {
      if (!filter.enabled) continue;

      // Apply client-side filters
      switch (filter.field) {
        case "duration": {
          const duration = log.metadata.durationMs;
          switch (filter.operator) {
            case "eq": if (duration !== filter.value) return false; break;
            case "neq": if (duration === filter.value) return false; break;
            case "gt": if (duration <= filter.value) return false; break;
            case "gte": if (duration < filter.value) return false; break;
            case "lt": if (duration >= filter.value) return false; break;
            case "lte": if (duration > filter.value) return false; break;
          }
          break;
        }

        case "httpStatus": {
          const status = log.metadata.httpStatus;
          switch (filter.operator) {
            case "eq": if (status !== filter.value) return false; break;
            case "neq": if (status === filter.value) return false; break;
            case "gt": if (status <= filter.value) return false; break;
            case "gte": if (status < filter.value) return false; break;
            case "lt": if (status >= filter.value) return false; break;
            case "lte": if (status > filter.value) return false; break;
          }
          break;
        }

        // String filters on fields not supported by API
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
      }
    }

    // Apply quick filters
    if (state.quickFilters.showErrors && log.metadata.httpStatus < 400) {
      return false;
    }

    if (state.quickFilters.showSuccessOnly && log.metadata.httpStatus >= 400) {
      return false;
    }

    if (state.quickFilters.showSlowRequests && log.metadata.durationMs < 1000) {
      return false;
    }

    return true;
  });
}

/**
 * Helper function to match string filters
 */
function matchStringFilter(
  value: string,
  operator: OperatorTypeMap["string"],
  filterValue: string
): boolean {
  const lowerValue = value.toLowerCase();
  const lowerFilter = filterValue.toLowerCase();

  switch (operator) {
    case "eq": return lowerValue === lowerFilter;
    case "neq": return lowerValue !== lowerFilter;
    case "contains": return lowerValue.includes(lowerFilter);
    case "startsWith": return lowerValue.startsWith(lowerFilter);
    case "endsWith": return lowerValue.endsWith(lowerFilter);
  }
}
```

## Recommendations

### 1. Type Safety

**Recommendation:** Use the mapped types approach (`TypedFilter<F, O>`) for maximum type safety with minimal boilerplate.

**Rationale:**
- Operators automatically constrained by field type
- Value types automatically inferred
- Excellent type narrowing with discriminated unions
- Prevents invalid filter combinations at compile time

### 2. Runtime Validation

**Recommendation:** Add Zod schemas to `@fiberplane/mcp-gateway-types` package.

**Rationale:**
- Validates filter state from URL parameters
- Type-safe deserialization with `z.infer`
- Catches invalid filters before they cause runtime errors
- Consistent validation between frontend and backend

**Implementation:**
```typescript
// In packages/types/src/filters.ts
export * from "./filter-schemas";
export * from "./filter-types";
```

### 3. Immutability

**Recommendation:** Use `readonly` modifiers throughout + Immer for updates.

**Rationale:**
- Prevents accidental mutations
- Better React performance (referential equality checks)
- Clearer mental model for state updates

**Implementation:**
```typescript
import { produce } from "immer";

function updateFilter(state: FilterState, id: string, updates: Partial<Filter>): FilterState {
  return produce(state, draft => {
    const index = draft.filters.findIndex(f => f.id === id);
    if (index !== -1) {
      Object.assign(draft.filters[index], updates);
    }
  });
}
```

### 4. Type Inference

**Recommendation:** Use helper functions with generics for creating filters.

**Rationale:**
- Reduces boilerplate
- Maximizes type inference
- Prevents typos and invalid combinations

**Implementation:**
```typescript
/**
 * Type-safe filter builder
 */
function createFilter<F extends FilterField, O extends FilterOperator<F>>(
  field: F,
  operator: O,
  value: FilterValue<F, O>
): TypedFilter<F, O> {
  return {
    id: crypto.randomUUID(),
    field,
    operator,
    value,
    enabled: true,
  };
}

// Usage with full type safety:
const durationFilter = createFilter("duration", "gt", 100);
// Type: TypedFilter<"duration", "gt">

const methodFilter = createFilter("method", "contains", "initialize");
// Type: TypedFilter<"method", "contains">

// TypeScript error: 'gt' is not valid for string fields
// const invalidFilter = createFilter("method", "gt", 100);
```

### 5. Error Handling

**Recommendation:** Use discriminated unions for error states.

**Rationale:**
- Type-safe error handling
- Clear error messaging
- Graceful degradation for invalid filters

**Implementation:**
```typescript
/**
 * Filter validation result
 */
type FilterValidationResult =
  | { valid: true; filter: Filter }
  | { valid: false; error: FilterValidationError };

/**
 * Filter validation error types
 */
type FilterValidationError =
  | { type: "invalid_field"; field: string }
  | { type: "invalid_operator"; field: FilterField; operator: string }
  | { type: "invalid_value"; field: FilterField; value: unknown; message: string }
  | { type: "parse_error"; message: string };

/**
 * Validate and parse a filter
 */
function validateAndParseFilter(input: unknown): FilterValidationResult {
  const result = filterSchema.safeParse(input);

  if (result.success) {
    return { valid: true, filter: result.data };
  }

  // Extract specific error type from Zod error
  const error = result.error.errors[0];

  if (error.path[0] === "field") {
    return {
      valid: false,
      error: { type: "invalid_field", field: String(error.message) }
    };
  }

  if (error.path[0] === "operator") {
    return {
      valid: false,
      error: {
        type: "invalid_operator",
        field: "method", // Extract from input
        operator: String(error.message)
      }
    };
  }

  if (error.path[0] === "value") {
    return {
      valid: false,
      error: {
        type: "invalid_value",
        field: "method", // Extract from input
        value: error.message,
        message: error.message
      }
    };
  }

  return {
    valid: false,
    error: { type: "parse_error", message: error.message }
  };
}
```

### 6. API Type Alignment

**Recommendation:** Extend `LogQueryOptions` to support all filter types, or clearly document client-side vs server-side filtering.

**Current Gap:**
- API only supports exact match for most fields
- No support for `duration`, `httpStatus`, `sender`, `receiver` filters
- No support for operators like `contains`, `gt`, `between`

**Options:**

**Option A: Extend API** (Recommended for production)
```typescript
// In packages/types/src/logs.ts
export interface LogQueryOptions {
  // Existing fields...
  serverName?: string;
  sessionId?: string;
  method?: string;

  // Extended filter support
  filters?: Filter[];  // Support structured filters

  // Or individual field filters with operators
  methodFilter?: { operator: StringOperator; value: string };
  durationFilter?: { operator: NumberOperator; value: number };
  // etc.
}
```

**Option B: Hybrid Approach** (Quick implementation)
```typescript
/**
 * Filter application strategy
 */
interface FilterStrategy {
  serverSide: Filter[];   // Filters applied by API
  clientSide: Filter[];   // Filters applied in browser
}

function determineFilterStrategy(filters: Filter[]): FilterStrategy {
  const strategy: FilterStrategy = {
    serverSide: [],
    clientSide: [],
  };

  for (const filter of filters) {
    // Check if API supports this filter
    const supportsServerSide =
      (filter.field === "method" && filter.operator === "eq") ||
      (filter.field === "sessionId" && filter.operator === "eq") ||
      (filter.field === "serverName" && filter.operator === "eq") ||
      (filter.field === "timestamp" && filter.operator !== "between");

    if (supportsServerSide) {
      strategy.serverSide.push(filter);
    } else {
      strategy.clientSide.push(filter);
    }
  }

  return strategy;
}
```

### 7. Package Organization

**Recommendation:** Add filter types to `@fiberplane/mcp-gateway-types`.

**File Structure:**
```
packages/types/src/
├── filters.ts           # Main export
├── filter-types.ts      # TypeScript types
├── filter-schemas.ts    # Zod schemas
└── filter-utils.ts      # Type guards and utilities
```

**Why:**
- Shared between web UI and API
- Can be reused by other consumers
- Maintains single source of truth
- Enables API to support structured filters in future

## Implementation Checklist

### Phase 1: Types Package
- [ ] Add `filter-types.ts` with type definitions
- [ ] Add `filter-schemas.ts` with Zod schemas
- [ ] Add `filter-utils.ts` with helper functions
- [ ] Export from `filters.ts`
- [ ] Update package.json and rebuild

### Phase 2: Web UI Integration
- [ ] Install Immer for immutable updates
- [ ] Create `useFilterState` hook with reducer
- [ ] Implement URL serialization with TanStack Router
- [ ] Create filter UI components
- [ ] Integrate with API client

### Phase 3: API Enhancement (Optional)
- [ ] Extend `LogQueryOptions` to support structured filters
- [ ] Update API validation schema
- [ ] Implement server-side filter application
- [ ] Add tests for filter combinations

### Phase 4: Testing
- [ ] Unit tests for filter validation
- [ ] Unit tests for URL serialization
- [ ] Integration tests for API filtering
- [ ] E2E tests for filter UI

## Example Usage

```typescript
import { createFilter, filterReducer, type FilterState } from "@fiberplane/mcp-gateway-types";

// Create type-safe filters
const filters: Filter[] = [
  createFilter("method", "contains", "tool"),
  createFilter("duration", "gt", 1000),
  createFilter("timestamp", "between", [
    new Date("2025-01-01"),
    new Date("2025-01-31")
  ]),
];

// Initialize state
const initialState: FilterState = {
  search: "",
  filters: [],
  quickFilters: {
    showErrors: false,
    showSuccessOnly: false,
    showSlowRequests: false,
  },
};

// Use reducer for state updates
const state1 = filterReducer(initialState, {
  type: "ADD_FILTER",
  payload: filters[0]
});

// TypeScript ensures type safety
const state2 = filterReducer(state1, {
  type: "UPDATE_FILTER",
  payload: {
    id: filters[0].id,
    filter: { enabled: false }
  }
});

// Convert to API query
const queryOptions = convertFiltersToQueryOptions(state2);

// Apply filters
const logs = await api.getLogs(queryOptions);
const filteredLogs = applyClientSideFilters(logs.data, state2);
```

## Conclusion

This type system design provides:

1. **Compile-time safety** - Invalid filter combinations caught by TypeScript
2. **Runtime validation** - Zod schemas validate user input and URL parameters
3. **Type inference** - Minimal type annotations required
4. **Immutability** - Readonly types prevent accidental mutations
5. **API alignment** - Clear integration with existing query system
6. **Extensibility** - Easy to add new fields and operators
7. **Error handling** - Type-safe error states with helpful messages

The recommended approach uses mapped types for maximum type safety while maintaining clean, readable code. Integration with Zod ensures runtime safety, and the hybrid filtering strategy allows for immediate implementation while planning future API enhancements.
