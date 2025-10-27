# Filter Component TypeScript Review - Question Responses

## Your Questions Answered

### 1. Type Safety: Is the discriminated union the right approach? Or should we use generics?

**Answer: Use BOTH - Generics wrapped in a discriminated union**

The optimal approach combines the strengths of both patterns:

```typescript
// Generic base for type safety
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

// Discriminated union for all possible filters
type Filter = {
  [F in FilterField]: {
    [O in FilterOperator<F>]: TypedFilter<F, O>;
  }[FilterOperator<F>];
}[FilterField];
```

**Why this is optimal:**
- **Generics** provide compile-time type safety (operator constrained by field)
- **Discriminated union** enables exhaustive type narrowing in switch statements
- TypeScript can discriminate on `filter.field` to narrow to specific filter type
- No redundant type definitions needed

**Example:**
```typescript
function renderFilterValue(filter: Filter) {
  switch (filter.field) {
    case "duration":
      // TypeScript knows: operator is NumberOperator, value is number
      return <NumberInput value={filter.value} />;

    case "method":
      // TypeScript knows: operator is StringOperator, value is string
      return <StringInput value={filter.value} />;

    case "timestamp":
      // TypeScript knows: operator is DateOperator, value is Date | [Date, Date]
      if (filter.operator === "between") {
        return <DateRangeInput value={filter.value} />; // tuple
      }
      return <DateInput value={filter.value} />; // single date
  }
}
```

---

### 2. Type Narrowing: How to ensure operators match field types at compile time?

**Answer: Use mapped types to constrain operators based on field type**

```typescript
// Maps value types to their valid operators
interface OperatorTypeMap {
  string: "eq" | "neq" | "contains" | "startsWith" | "endsWith";
  number: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  Date: "before" | "after" | "between";
}

// Get value type for a field
type FilterFieldTypeMap = {
  method: string;
  duration: number;
  timestamp: Date;
  // ...
};

// Constrain operator based on field's value type
type FilterOperator<F extends FilterField> =
  FilterFieldTypeMap[F] extends string
    ? OperatorTypeMap["string"]
    : FilterFieldTypeMap[F] extends number
    ? OperatorTypeMap["number"]
    : FilterFieldTypeMap[F] extends Date
    ? OperatorTypeMap["Date"]
    : never;
```

**Result:**
```typescript
type DurationOperator = FilterOperator<"duration">;
// "eq" | "neq" | "gt" | "gte" | "lt" | "lte"

type MethodOperator = FilterOperator<"method">;
// "eq" | "neq" | "contains" | "startsWith" | "endsWith"

// TypeScript error: Type '"gt"' is not assignable to type StringOperator
const invalid: FilterOperator<"method"> = "gt"; // ❌
```

**Helper function for type-safe filter creation:**
```typescript
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

// ✅ All valid
createFilter("duration", "gt", 100);
createFilter("method", "contains", "initialize");
createFilter("timestamp", "between", [new Date(), new Date()]);

// ❌ TypeScript errors
createFilter("method", "gt", 100);        // Error: 'gt' not valid for string
createFilter("duration", "contains", ""); // Error: 'contains' not valid for number
createFilter("timestamp", "eq", new Date()); // Error: 'eq' not valid for Date
```

---

### 3. Zod Integration: Should we use Zod schemas for runtime validation?

**Answer: YES - Zod schemas are essential for runtime validation**

**Where to use Zod:**
1. **URL parameter deserialization** - Validate filters from query strings
2. **API validation** - Validate filter requests from clients
3. **User input validation** - Validate form inputs before creating filters
4. **Storage persistence** - Validate loaded filter presets

**Implementation strategy:**

```typescript
// Define Zod schemas that match TypeScript types
const stringFilterSchema = z.object({
  id: z.string(),
  field: z.enum(["method", "sessionId", "serverName", "clientName", "clientIp"]),
  operator: z.enum(["eq", "neq", "contains", "startsWith", "endsWith"]),
  value: z.string(),
  enabled: z.boolean(),
});

const numberFilterSchema = z.object({
  id: z.string(),
  field: z.enum(["duration", "httpStatus"]),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]),
  value: z.number(),
  enabled: z.boolean(),
});

const dateFilterSchema = z.object({
  id: z.string(),
  field: z.literal("timestamp"),
  operator: z.enum(["before", "after"]),
  value: z.coerce.date(), // Coerces ISO strings to Date objects
  enabled: z.boolean(),
});

const dateRangeFilterSchema = z.object({
  id: z.string(),
  field: z.literal("timestamp"),
  operator: z.literal("between"),
  value: z.tuple([z.coerce.date(), z.coerce.date()]),
  enabled: z.boolean(),
});

// Discriminated union schema
const filterSchema = z.discriminatedUnion("field", [
  stringFilterSchema,
  numberFilterSchema,
  dateFilterSchema,
  dateRangeFilterSchema,
]);

// Ensure TypeScript and Zod types match
type Filter = z.infer<typeof filterSchema>;
```

**Usage pattern:**
```typescript
// Deserialize from URL with validation
function deserializeFilter(serialized: string): Filter | null {
  try {
    const [field, operator, rawValue] = serialized.split(":");

    // Field-specific schema lookup
    const schema = filterSchemas[field as FilterField];
    if (!schema) return null;

    const parsed = schema.safeParse({
      id: crypto.randomUUID(),
      field,
      operator,
      value: parseValue(rawValue, field),
      enabled: true,
    });

    return parsed.success ? parsed.data : null;
  } catch {
    return null; // Graceful degradation
  }
}
```

**Benefits:**
- Runtime type safety for external data (URLs, API responses, localStorage)
- Automatic type coercion (strings to dates, strings to numbers)
- Detailed error messages for debugging
- Single source of truth with `z.infer<typeof schema>`

**Where to place schemas:**
Add to `@fiberplane/mcp-gateway-types/src/filter-schemas.ts` so they can be shared between web UI and API.

---

### 4. API Type Alignment: How to ensure web UI types match API types?

**Answer: Shared types in `@fiberplane/mcp-gateway-types` + conversion layer**

**Strategy:**

1. **Define filter types in types package** (shared source of truth)
2. **Create conversion functions** between filter types and `LogQueryOptions`
3. **Document API limitations** clearly
4. **Implement hybrid filtering** (server-side where supported, client-side for advanced filters)

**Type alignment pattern:**

```typescript
// packages/types/src/filters.ts
export interface FilterFieldTypeMap {
  // Maps to LogQueryOptions.method
  method: string;

  // Maps to LogQueryOptions.sessionId
  sessionId: string;

  // Maps to LogQueryOptions.serverName
  serverName: string;

  // Maps to LogQueryOptions.clientName
  clientName: string;

  // Maps to LogQueryOptions.clientIp
  clientIp: string;

  // Maps to LogQueryOptions.after/before
  timestamp: Date;

  // NOT supported by API - requires client-side filtering
  duration: number;
  httpStatus: number;
  sender: string;    // metadata.client.name
  receiver: string;  // metadata.server.name
}
```

**Conversion layer:**

```typescript
// packages/web/src/lib/filter-api-adapter.ts

interface FilterStrategy {
  serverSide: LogQueryOptions;  // What API can handle
  clientSide: Filter[];          // What needs client filtering
}

function convertFiltersToStrategy(state: FilterState): FilterStrategy {
  const serverSide: LogQueryOptions = {};
  const clientSide: Filter[] = [];

  for (const filter of state.filters) {
    if (!filter.enabled) continue;

    // Check if API supports this filter
    if (isApiSupported(filter)) {
      applyToQueryOptions(serverSide, filter);
    } else {
      clientSide.push(filter);
    }
  }

  return { serverSide, clientSide };
}

function isApiSupported(filter: Filter): boolean {
  // API only supports exact match for most string fields
  const exactMatchFields: FilterField[] = [
    "method", "sessionId", "serverName", "clientName", "clientIp"
  ];

  if (exactMatchFields.includes(filter.field)) {
    return filter.operator === "eq";
  }

  // API supports timestamp ranges
  if (filter.field === "timestamp") {
    return true;
  }

  // Other fields not supported by API
  return false;
}
```

**Usage:**
```typescript
// In web UI query hook
async function fetchFilteredLogs(filterState: FilterState) {
  const { serverSide, clientSide } = convertFiltersToStrategy(filterState);

  // Fetch with API-supported filters
  const { data } = await api.getLogs(serverSide);

  // Apply client-side filters
  const filtered = applyClientSideFilters(data, clientSide);

  return filtered;
}
```

**Future-proofing:**

When API adds support for advanced filters:

```typescript
// packages/types/src/logs.ts
export interface LogQueryOptions {
  // Existing fields...
  serverName?: string;
  sessionId?: string;

  // NEW: Support structured filters
  filters?: Filter[];

  // Maintain backward compatibility
  method?: string;  // Deprecated in favor of filters
}
```

Then update conversion layer without changing web UI code.

---

### 5. URL Serialization: Best way to serialize/deserialize complex filter objects to/from URL params?

**Answer: Use compact string encoding with Zod validation**

**Encoding format:**
```
field:operator:value
```

**Examples:**
```
duration:gt:1000
method:contains:initialize
timestamp:between:2025-01-01T00:00:00Z,2025-01-31T23:59:59Z
httpStatus:eq:404
```

**Implementation:**

```typescript
/**
 * Serialize filter to URL-safe string
 */
function serializeFilter(filter: Filter): string {
  const value = Array.isArray(filter.value)
    ? filter.value.map(formatValue).join(",")
    : formatValue(filter.value);

  return `${filter.field}:${filter.operator}:${value}`;
}

function formatValue(value: string | number | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

/**
 * Deserialize filter from URL string
 */
function deserializeFilter(serialized: string): Filter | null {
  try {
    const [field, operator, rawValue] = serialized.split(":");

    if (!isValidField(field)) {
      return null;
    }

    // Use field-specific Zod schema for parsing
    const schema = filterSchemas[field];
    const value = parseValue(rawValue, field);

    const result = schema.safeParse({
      id: crypto.randomUUID(),
      field,
      operator,
      value,
      enabled: true,
    });

    return result.success ? result.data : null;
  } catch {
    return null; // Graceful degradation for invalid filters
  }
}

function parseValue(rawValue: string, field: FilterField): unknown {
  const fieldType = typeof filterFieldTypeMap[field];

  if (fieldType === "number") {
    return Number(rawValue);
  }

  if (field === "timestamp") {
    // Handle date ranges
    if (rawValue.includes(",")) {
      return rawValue.split(",").map(s => new Date(s));
    }
    return new Date(rawValue);
  }

  return rawValue; // String value
}
```

**URL params structure:**

```typescript
interface FilterURLParams {
  search?: string;              // Global search
  filters?: string;             // Comma-separated filter strings
  quick?: string;               // Comma-separated quick filter keys
}

// Example URL:
// /logs?search=initialize&filters=duration:gt:1000,httpStatus:eq:200&quick=showErrors
```

**Integration with TanStack Router:**

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/logs")({
  validateSearch: (search: Record<string, unknown>): FilterURLParams => {
    return {
      search: search.search as string | undefined,
      filters: search.filters as string | undefined,
      quick: search.quick as string | undefined,
    };
  },

  loaderDeps: ({ search }) => search,

  loader: async ({ deps }) => {
    const filterState = deserializeFilterState(deps);
    const { serverSide, clientSide } = convertFiltersToStrategy(filterState);
    const logs = await api.getLogs(serverSide);

    return {
      logs: applyClientSideFilters(logs.data, clientSide),
      filterState,
    };
  },
});
```

**Benefits:**
- Compact URLs (important for sharing)
- Human-readable (can edit manually)
- Type-safe deserialization with Zod
- Graceful degradation (invalid filters silently ignored)
- Works with browser history (back/forward)

---

### 6. Immutability: Should we use `readonly` modifiers? Immer for updates?

**Answer: YES to both - `readonly` for types, Immer for updates**

**Type definitions with `readonly`:**

```typescript
interface TypedFilter<F extends FilterField, O extends FilterOperator<F>> {
  readonly id: string;
  readonly field: F;
  readonly operator: O;
  readonly value: FilterValue<F, O>;
  readonly enabled: boolean;
}

interface FilterState {
  readonly search: string;
  readonly filters: readonly Filter[];
  readonly quickFilters: {
    readonly showErrors: boolean;
    readonly showSuccessOnly: boolean;
    readonly showSlowRequests: boolean;
  };
}
```

**Benefits of `readonly`:**
- Prevents accidental mutations (`filter.enabled = false` is compile error)
- Better React performance (referential equality checks)
- Clear intent (this is immutable data)
- Works well with React's strict mode

**State updates with Immer:**

```typescript
import { produce } from "immer";

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "UPDATE_FILTER":
      return produce(state, draft => {
        const filter = draft.filters.find(f => f.id === action.payload.id);
        if (filter) {
          // Immer allows mutation syntax on draft
          Object.assign(filter, action.payload.filter);
        }
      });

    case "TOGGLE_FILTER":
      return produce(state, draft => {
        const filter = draft.filters.find(f => f.id === action.payload);
        if (filter) {
          filter.enabled = !filter.enabled;
        }
      });

    case "REMOVE_FILTER":
      return produce(state, draft => {
        const index = draft.filters.findIndex(f => f.id === action.payload);
        if (index !== -1) {
          draft.filters.splice(index, 1);
        }
      });

    default:
      return state;
  }
}
```

**Why Immer is valuable:**
- Simpler update logic (mutation syntax on draft)
- Structural sharing (unchanged parts reuse same references)
- No manual spreading (`{ ...state, filters: [...state.filters, newFilter] }`)
- Better performance for deep updates
- TypeScript integration (preserves readonly types)

**Installation:**
```bash
cd packages/web
bun add immer
```

**Alternative without Immer (for simple updates):**

```typescript
// Simple updates don't require Immer
case "SET_SEARCH":
  return { ...state, search: action.payload };

case "ADD_FILTER":
  return { ...state, filters: [...state.filters, action.payload] };

// But complex updates benefit from Immer
case "UPDATE_FILTER":
  // Without Immer - verbose and error-prone
  return {
    ...state,
    filters: state.filters.map(f =>
      f.id === action.payload.id
        ? { ...f, ...action.payload.filter }
        : f
    )
  };
```

**Recommendation:** Use Immer for all filter state updates to maintain consistency and simplify future changes.

---

### 7. Type Inference: How to maximize type inference to reduce boilerplate?

**Answer: Use helper functions, const assertions, and template literal types**

**1. Helper functions with generics:**

```typescript
// Instead of this (verbose):
const filter: TypedFilter<"duration", "gt"> = {
  id: crypto.randomUUID(),
  field: "duration",
  operator: "gt",
  value: 1000,
  enabled: true,
};

// Use this (inferred):
const filter = createFilter("duration", "gt", 1000);
// Type automatically inferred: TypedFilter<"duration", "gt">

// Type-safe builder with full inference
function createFilter<F extends FilterField, O extends FilterOperator<F>>(
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
```

**2. Const assertions for literal types:**

```typescript
// Without const assertion
const operators = ["eq", "neq", "gt"]; // Type: string[]

// With const assertion
const operators = ["eq", "neq", "gt"] as const;
// Type: readonly ["eq", "neq", "gt"]

type Operator = typeof operators[number];
// Type: "eq" | "neq" | "gt"

// Use in component
function OperatorSelect({ field }: { field: FilterField }) {
  const operators = getOperatorsForField(field);
  // Type automatically inferred from field

  return (
    <select>
      {operators.map(op => (
        <option key={op} value={op}>{op}</option>
      ))}
    </select>
  );
}

function getOperatorsForField<F extends FilterField>(
  field: F
): readonly FilterOperator<F>[] {
  // Return type automatically inferred based on field
  const fieldType = typeof filterFieldTypeMap[field];

  if (fieldType === "number") {
    return ["eq", "neq", "gt", "gte", "lt", "lte"] as const;
  }

  if (field === "timestamp") {
    return ["before", "after", "between"] as const;
  }

  return ["eq", "neq", "contains", "startsWith", "endsWith"] as const;
}
```

**3. Template literal types for string validation:**

```typescript
// Serialized filter format with type safety
type SerializedFilter = `${FilterField}:${string}:${string}`;

// Function accepts only valid format
function deserializeFilter(serialized: SerializedFilter): Filter | null {
  // Implementation
}

// TypeScript ensures correct format
deserializeFilter("duration:gt:1000"); // ✅
deserializeFilter("invalid");           // ❌ Type error
```

**4. Type predicates for narrowing:**

```typescript
// Type guard with inference
function isNumberFilter(filter: Filter): filter is TypedFilter<"duration" | "httpStatus", NumberOperator> {
  return filter.field === "duration" || filter.field === "httpStatus";
}

function isStringFilter(filter: Filter): filter is TypedFilter<"method" | "serverName", StringOperator> {
  const stringFields: FilterField[] = ["method", "serverName", "sessionId"];
  return stringFields.includes(filter.field);
}

// Usage with automatic narrowing
function renderFilterInput(filter: Filter) {
  if (isNumberFilter(filter)) {
    // TypeScript knows: filter.value is number, filter.operator is NumberOperator
    return <NumberInput value={filter.value} operator={filter.operator} />;
  }

  if (isStringFilter(filter)) {
    // TypeScript knows: filter.value is string, filter.operator is StringOperator
    return <StringInput value={filter.value} operator={filter.operator} />;
  }

  // TypeScript knows: filter must be DateFilter
  return <DateInput value={filter.value} />;
}
```

**5. Discriminated union inference:**

```typescript
// Reducer with automatic action payload inference
type FilterAction =
  | { type: "SET_SEARCH"; payload: string }
  | { type: "ADD_FILTER"; payload: Filter }
  | { type: "REMOVE_FILTER"; payload: string };

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "SET_SEARCH":
      // TypeScript infers: action.payload is string
      return { ...state, search: action.payload };

    case "ADD_FILTER":
      // TypeScript infers: action.payload is Filter
      return { ...state, filters: [...state.filters, action.payload] };

    case "REMOVE_FILTER":
      // TypeScript infers: action.payload is string
      return {
        ...state,
        filters: state.filters.filter(f => f.id !== action.payload)
      };
  }
}
```

**Result:** Minimal type annotations with maximum type safety.

---

### 8. Error Handling: How to type error states for invalid filters?

**Answer: Use discriminated unions for error states with specific error types**

```typescript
/**
 * Filter validation error types
 */
type FilterValidationError =
  | { type: "invalid_field"; field: string; message: string }
  | { type: "invalid_operator"; field: FilterField; operator: string; message: string }
  | { type: "invalid_value"; field: FilterField; operator: string; value: unknown; message: string }
  | { type: "parse_error"; input: string; message: string }
  | { type: "constraint_violation"; constraint: string; message: string };

/**
 * Filter validation result
 */
type FilterValidationResult =
  | { valid: true; filter: Filter }
  | { valid: false; error: FilterValidationError };

/**
 * Validate filter with detailed error information
 */
function validateFilter(input: unknown): FilterValidationResult {
  const result = filterSchema.safeParse(input);

  if (result.success) {
    return { valid: true, filter: result.data };
  }

  // Extract specific error type from Zod error
  const zodError = result.error.errors[0];

  switch (zodError.path[0]) {
    case "field":
      return {
        valid: false,
        error: {
          type: "invalid_field",
          field: String(zodError.message),
          message: `Invalid filter field: ${zodError.message}`
        }
      };

    case "operator":
      return {
        valid: false,
        error: {
          type: "invalid_operator",
          field: (input as any).field,
          operator: String(zodError.message),
          message: `Invalid operator for field ${(input as any).field}: ${zodError.message}`
        }
      };

    case "value":
      return {
        valid: false,
        error: {
          type: "invalid_value",
          field: (input as any).field,
          operator: (input as any).operator,
          value: (input as any).value,
          message: zodError.message
        }
      };

    default:
      return {
        valid: false,
        error: {
          type: "parse_error",
          input: JSON.stringify(input),
          message: zodError.message
        }
      };
  }
}

/**
 * Error display component with type-safe error handling
 */
function FilterErrorMessage({ error }: { error: FilterValidationError }) {
  switch (error.type) {
    case "invalid_field":
      return (
        <div className="error">
          Unknown filter field: <code>{error.field}</code>
        </div>
      );

    case "invalid_operator":
      return (
        <div className="error">
          Operator <code>{error.operator}</code> is not valid for field{" "}
          <code>{error.field}</code>
        </div>
      );

    case "invalid_value":
      return (
        <div className="error">
          Invalid value for {error.field} {error.operator}:{" "}
          <code>{JSON.stringify(error.value)}</code>
        </div>
      );

    case "parse_error":
      return (
        <div className="error">
          Failed to parse filter: {error.message}
        </div>
      );

    case "constraint_violation":
      return (
        <div className="error">
          Constraint violation: {error.message}
        </div>
      );
  }
}

/**
 * Type-safe error boundary for filter operations
 */
function useFilterWithValidation() {
  const [errors, setErrors] = useState<FilterValidationError[]>([]);

  const addFilter = useCallback((input: unknown) => {
    const result = validateFilter(input);

    if (result.valid) {
      dispatch({ type: "ADD_FILTER", payload: result.filter });
      setErrors([]);
    } else {
      setErrors([result.error]);
    }
  }, []);

  return { addFilter, errors };
}
```

**Error recovery strategies:**

```typescript
/**
 * Graceful degradation for URL filters
 */
function deserializeFiltersFromURL(filterString: string): {
  filters: Filter[];
  errors: FilterValidationError[];
} {
  const filters: Filter[] = [];
  const errors: FilterValidationError[] = [];

  for (const serialized of filterString.split(",")) {
    const result = validateFilter(deserializeFilter(serialized));

    if (result.valid) {
      filters.push(result.filter);
    } else {
      errors.push(result.error);
    }
  }

  return { filters, errors };
}

// Usage
const { filters, errors } = deserializeFiltersFromURL(urlParams.filters);

if (errors.length > 0) {
  console.warn("Some filters could not be loaded:", errors);
  // Optionally show toast notification
}

// Continue with valid filters
dispatch({ type: "SET_FILTERS", payload: filters });
```

**Benefits:**
- Type-safe error handling (switch exhaustiveness checking)
- Detailed error information for debugging
- User-friendly error messages
- Graceful degradation (partial filter loading)
- Testable error states

---

## Summary

| Question | Answer | Key Recommendation |
|----------|--------|-------------------|
| **1. Type Safety** | Generics + Discriminated Union | Use `TypedFilter<F, O>` wrapped in mapped union type |
| **2. Type Narrowing** | Mapped types | Constrain operators using `FilterOperator<F>` type |
| **3. Zod Integration** | Yes, essential | Add schemas to `@fiberplane/mcp-gateway-types` |
| **4. API Alignment** | Shared types + adapter | Create conversion layer, document limitations |
| **5. URL Serialization** | Compact format with Zod | Use `field:operator:value` format |
| **6. Immutability** | Both readonly + Immer | Use `readonly` in types, Immer for updates |
| **7. Type Inference** | Helper functions | Use `createFilter()` builder with generics |
| **8. Error Handling** | Discriminated unions | Define specific error types for each failure mode |

## Next Steps

1. **Add filter types to types package** (`packages/types/src/filters.ts`)
2. **Create Zod schemas** for runtime validation
3. **Implement helper functions** (`createFilter`, serialization)
4. **Build web UI components** using these types
5. **Write comprehensive tests** for type safety

This type system provides compile-time safety, runtime validation, and excellent developer experience with minimal boilerplate.
