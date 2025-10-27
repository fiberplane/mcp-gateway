# Filter Type System - Best Practices and Pitfalls

## TypeScript Best Practices

### 1. Use `satisfies` for Type Checking Without Widening

**Problem:** Type assertions can widen types unnecessarily.

```typescript
// ❌ Bad: Type assertion widens to ZodType<StringOperator>
const stringOperatorSchema: z.ZodType<StringOperator> = z.enum([
  "eq",
  "neq",
  "contains",
  "startsWith",
  "endsWith",
]);

// Type: ZodType<StringOperator> - loses specific enum information

// ✅ Good: satisfies checks type without widening
const stringOperatorSchema = z.enum([
  "eq",
  "neq",
  "contains",
  "startsWith",
  "endsWith",
]) satisfies z.ZodType<StringOperator>;

// Type: ZodEnum<["eq", "neq", "contains", "startsWith", "endsWith"]>
// Retains specific enum type while ensuring it matches StringOperator
```

**Why this matters:**
- Preserves autocomplete and type narrowing
- Catches mismatches between Zod schema and TypeScript type
- Better error messages from TypeScript

---

### 2. Avoid Type Assertion Hell with Mapped Types

**Problem:** Type assertions scatter throughout code.

```typescript
// ❌ Bad: Manual type assertions everywhere
function updateFilter(state: FilterState, id: string, updates: Partial<Filter>) {
  return {
    ...state,
    filters: state.filters.map(f =>
      f.id === id ? ({ ...f, ...updates } as Filter) : f
    )
  };
}

// ✅ Good: Use helper types to avoid assertions
type FilterUpdate<F extends FilterField> = {
  id: string;
  field?: F;
  operator?: FilterOperator<F>;
  value?: FilterValue<F, FilterOperator<F>>;
  enabled?: boolean;
};

function updateFilter<F extends FilterField>(
  state: FilterState,
  update: FilterUpdate<F>
): FilterState {
  return produce(state, draft => {
    const filter = draft.filters.find(f => f.id === update.id);
    if (filter && filter.field === update.field) {
      Object.assign(filter, update);
    }
  });
}
```

**Benefits:**
- Type-safe updates without assertions
- Better IDE support
- Catches errors at compile time

---

### 3. Use Const Assertions for Arrays

**Problem:** Arrays lose literal types.

```typescript
// ❌ Bad: Type is string[]
const operators = ["eq", "neq", "gt"];
type Operator = typeof operators[number]; // string (too wide!)

// ✅ Good: Type is readonly ["eq", "neq", "gt"]
const operators = ["eq", "neq", "gt"] as const;
type Operator = typeof operators[number]; // "eq" | "neq" | "gt"
```

**Usage in component:**

```typescript
function OperatorSelect() {
  const operators = ["eq", "neq", "contains"] as const;

  return (
    <select>
      {operators.map(op => (
        <option key={op} value={op}>
          {op}
        </option>
      ))}
    </select>
  );
}
```

---

### 4. Leverage Discriminated Unions for Exhaustive Checking

**Problem:** Missing cases in switch statements.

```typescript
// ✅ Good: TypeScript ensures all cases are handled
function renderFilterInput(filter: Filter) {
  switch (filter.field) {
    case "duration":
    case "httpStatus":
      return <NumberInput value={filter.value} />;

    case "method":
    case "sessionId":
    case "serverName":
    case "clientName":
    case "clientIp":
    case "sender":
    case "receiver":
      return <StringInput value={filter.value} />;

    case "timestamp":
      return <DateInput value={filter.value} />;

    default:
      // TypeScript error if any case is missing
      const _exhaustive: never = filter;
      return _exhaustive;
  }
}
```

**Benefits:**
- TypeScript error if you add a new field and forget to handle it
- Refactoring safety
- Self-documenting code

---

### 5. Use Template Literal Types for String Validation

**Problem:** String parameters accept any value.

```typescript
// ❌ Bad: Accepts any string
function deserializeFilter(serialized: string): Filter | null {
  // ...
}

deserializeFilter("invalid"); // No type error

// ✅ Good: Type-safe string format
type SerializedFilter = `${FilterField}:${string}:${string}`;

function deserializeFilter(serialized: SerializedFilter): Filter | null {
  // ...
}

deserializeFilter("invalid"); // Type error!
deserializeFilter("duration:gt:1000"); // ✅
```

**Benefits:**
- Catches format errors at compile time
- Self-documenting function signatures
- Better autocomplete

---

### 6. Prefer Type Predicates Over Type Assertions

**Problem:** Type assertions bypass type checking.

```typescript
// ❌ Bad: Type assertion can be wrong
function processFilter(filter: unknown) {
  const typedFilter = filter as Filter;
  console.log(typedFilter.field); // Runtime error if wrong!
}

// ✅ Good: Type predicate validates at runtime
function isFilter(value: unknown): value is Filter {
  return filterSchema.safeParse(value).success;
}

function processFilter(filter: unknown) {
  if (isFilter(filter)) {
    console.log(filter.field); // Type-safe!
  }
}
```

**Benefits:**
- Runtime validation
- Type narrowing
- No silent failures

---

## Common Pitfalls and Solutions

### Pitfall 1: Circular Type Dependencies

**Problem:**

```typescript
// ❌ Bad: Circular dependency
type Filter = StringFilter | NumberFilter;

interface StringFilter {
  filters: Filter[]; // Circular!
}
```

**Solution:**

```typescript
// ✅ Good: Use interface merging or separate types
interface BaseFilter {
  id: string;
  enabled: boolean;
}

interface StringFilter extends BaseFilter {
  field: string;
  operator: StringOperator;
  value: string;
}

type Filter = StringFilter | NumberFilter;
```

---

### Pitfall 2: Overly Complex Generic Constraints

**Problem:**

```typescript
// ❌ Bad: Too complex to read
type FilterValue<
  F extends FilterField,
  O extends FilterOperator<F>
> = O extends "between"
  ? FilterFieldTypeMap[F] extends Date
    ? readonly [Date, Date]
    : FilterFieldTypeMap[F] extends number
    ? readonly [number, number]
    : readonly [string, string]
  : FilterFieldTypeMap[F];
```

**Solution:**

```typescript
// ✅ Good: Break into smaller types
type SingleValue<F extends FilterField> = FilterFieldTypeMap[F];

type RangeValue<F extends FilterField> = readonly [
  FilterFieldTypeMap[F],
  FilterFieldTypeMap[F]
];

type FilterValue<
  F extends FilterField,
  O extends FilterOperator<F>
> = O extends "between" ? RangeValue<F> : SingleValue<F>;
```

---

### Pitfall 3: Zod Schema Mismatch with TypeScript Types

**Problem:** Zod schema doesn't match TypeScript type.

```typescript
// ❌ Bad: Schema and type can diverge
type StringOperator = "eq" | "neq" | "contains";

const stringOperatorSchema = z.enum(["eq", "neq"]); // Missing "contains"!

// No type error, but runtime mismatch
```

**Solution:**

```typescript
// ✅ Good: Use satisfies to catch mismatches
const stringOperatorSchema = z.enum([
  "eq",
  "neq",
  "contains",
]) satisfies z.ZodType<StringOperator>;

// Or derive type from schema
const stringOperatorSchema = z.enum(["eq", "neq", "contains"]);
type StringOperator = z.infer<typeof stringOperatorSchema>;
```

---

### Pitfall 4: Readonly Arrays and Spread Operations

**Problem:** Spreading readonly arrays loses readonly.

```typescript
// ❌ Problem: Type becomes mutable
const filters: readonly Filter[] = [...];

const updated = [...filters, newFilter];
// Type: Filter[] (not readonly!)

// Later mutation (should be prevented):
updated.push(anotherFilter); // No error!
```

**Solution:**

```typescript
// ✅ Good: Preserve readonly
const filters: readonly Filter[] = [...];

const updated: readonly Filter[] = [...filters, newFilter] as const;

updated.push(anotherFilter); // Type error! ✅
```

**Better solution with Immer:**

```typescript
const updated = produce(filters, draft => {
  draft.push(newFilter);
});
// Type: readonly Filter[] (Immer preserves readonly)
```

---

### Pitfall 5: Generic Type Parameter Inference Failures

**Problem:** TypeScript can't infer generic types.

```typescript
// ❌ Bad: TypeScript can't infer O from operator string
function createFilter<F extends FilterField, O extends FilterOperator<F>>(
  field: F,
  operator: string, // Too wide!
  value: FilterValue<F, O>
) { /* ... */ }

createFilter("duration", "gt", 1000);
// Error: Can't infer O
```

**Solution:**

```typescript
// ✅ Good: Constrain operator parameter
function createFilter<F extends FilterField, O extends FilterOperator<F>>(
  field: F,
  operator: O, // Constrained by F
  value: FilterValue<F, O>
) { /* ... */ }

createFilter("duration", "gt", 1000); // ✅ All types inferred
```

---

### Pitfall 6: Union Type Widening in Arrays

**Problem:** Arrays of union types lose specificity.

```typescript
// ❌ Bad: Type widens to Filter[]
const filters = [
  createFilter("duration", "gt", 1000),
  createFilter("method", "contains", "initialize"),
];
// Type: Filter[] (loses specific filter types)

// Can't narrow type later
for (const filter of filters) {
  if (filter.field === "duration") {
    // TypeScript still thinks filter might be any Filter type
  }
}
```

**Solution:**

```typescript
// ✅ Good: Preserve specific types with const assertion
const filters = [
  createFilter("duration", "gt", 1000),
  createFilter("method", "contains", "initialize"),
] as const;
// Type: readonly [TypedFilter<"duration", "gt">, TypedFilter<"method", "contains">]

// ✅ Better: Use discriminated union
for (const filter of filters) {
  switch (filter.field) {
    case "duration":
      // TypeScript knows: filter is TypedFilter<"duration", ...>
      break;
  }
}
```

---

## Performance Considerations

### 1. Avoid Expensive Type Computations

**Problem:** Complex mapped types can slow down TypeScript compiler.

```typescript
// ⚠️ Potentially slow
type AllPossibleFilters = {
  [F in FilterField]: {
    [O in FilterOperator<F>]: {
      [V in FilterValue<F, O>]: TypedFilter<F, O>;
    }[FilterValue<F, O>];
  }[FilterOperator<F>];
}[FilterField];
```

**Solution:**

```typescript
// ✅ Good: Simpler mapped type
type Filter = {
  [F in FilterField]: {
    [O in FilterOperator<F>]: TypedFilter<F, O>;
  }[FilterOperator<F>];
}[FilterField];
```

---

### 2. Use Type Caching for Repeated Types

**Problem:** TypeScript recomputes types multiple times.

```typescript
// ❌ Bad: Type computed on every use
function a(filter: { [F in FilterField]: ... }[FilterField]) { }
function b(filter: { [F in FilterField]: ... }[FilterField]) { }
function c(filter: { [F in FilterField]: ... }[FilterField]) { }
```

**Solution:**

```typescript
// ✅ Good: Type computed once
type Filter = { [F in FilterField]: ... }[FilterField];

function a(filter: Filter) { }
function b(filter: Filter) { }
function c(filter: Filter) { }
```

---

## Testing Recommendations

### 1. Test Type Narrowing

```typescript
import { describe, it, expectTypeOf } from "vitest";
import type { Filter } from "./filter-types";

describe("Filter type narrowing", () => {
  it("narrows to number filter based on field", () => {
    const filter: Filter = createFilter("duration", "gt", 1000);

    if (filter.field === "duration") {
      expectTypeOf(filter.operator).toMatchTypeOf<NumberOperator>();
      expectTypeOf(filter.value).toBeNumber();
    }
  });

  it("narrows to date range for between operator", () => {
    const filter: Filter = createFilter("timestamp", "between", [
      new Date(),
      new Date(),
    ]);

    if (filter.operator === "between") {
      expectTypeOf(filter.value).toMatchTypeOf<readonly [Date, Date]>();
    }
  });
});
```

### 2. Test Zod Schema Alignment

```typescript
describe("Zod schema alignment", () => {
  it("stringFilterSchema matches StringFilter type", () => {
    const filter = createFilter("method", "contains", "initialize");

    const result = stringFilterSchema.safeParse(filter);

    expect(result.success).toBe(true);
    if (result.success) {
      expectTypeOf(result.data).toMatchTypeOf<StringFilter>();
    }
  });
});
```

### 3. Test Type Guards

```typescript
describe("Type guards", () => {
  it("isValidField narrows string to FilterField", () => {
    const field: string = "duration";

    if (isValidField(field)) {
      expectTypeOf(field).toMatchTypeOf<FilterField>();
    }
  });
});
```

---

## Documentation Guidelines

### 1. Document Type Constraints

```typescript
/**
 * Create a type-safe filter
 *
 * @template F - The filter field (automatically inferred)
 * @template O - The operator (must be valid for field type)
 *
 * @param field - The field to filter on
 * @param operator - The comparison operator (constrained by field type)
 * @param value - The filter value (type depends on field and operator)
 *
 * @example
 * // Number filter
 * const durationFilter = createFilter("duration", "gt", 1000);
 *
 * @example
 * // Date range filter
 * const dateFilter = createFilter("timestamp", "between", [
 *   new Date("2025-01-01"),
 *   new Date("2025-01-31")
 * ]);
 *
 * @example
 * // This would be a TypeScript error:
 * // createFilter("method", "gt", 100); // 'gt' not valid for string fields
 */
export function createFilter<
  F extends FilterField,
  O extends FilterOperator<F>
>(
  field: F,
  operator: O,
  value: FilterValue<F, O>
): TypedFilter<F, O> {
  // ...
}
```

### 2. Document Complex Types

```typescript
/**
 * Union of all possible filter types
 *
 * This is a discriminated union where the `field` property determines
 * which operator and value types are valid.
 *
 * Type narrowing works based on the field:
 *
 * @example
 * function processFilter(filter: Filter) {
 *   if (filter.field === "duration") {
 *     // TypeScript knows: operator is NumberOperator, value is number
 *     console.log(filter.value.toFixed(2));
 *   }
 * }
 */
export type Filter = {
  [F in FilterField]: {
    [O in FilterOperator<F>]: TypedFilter<F, O>;
  }[FilterOperator<F>];
}[FilterField];
```

---

## Summary

**Key Takeaways:**

1. **Use `satisfies`** to check types without widening
2. **Prefer mapped types** over manual type assertions
3. **Use const assertions** for literal types in arrays
4. **Leverage discriminated unions** for exhaustive checking
5. **Use template literal types** for string validation
6. **Prefer type predicates** over type assertions
7. **Keep types simple** - break complex types into smaller pieces
8. **Test type narrowing** with `expectTypeOf`
9. **Document constraints** clearly with JSDoc
10. **Profile type performance** if compilation is slow

**Common Pitfalls to Avoid:**

1. ❌ Circular type dependencies
2. ❌ Overly complex generic constraints
3. ❌ Zod schema/TypeScript type mismatches
4. ❌ Losing readonly with spread operations
5. ❌ Generic type inference failures
6. ❌ Union type widening in arrays

**Recommended Tools:**

- `typescript` 5.3+ (for `satisfies` operator)
- `zod` 3.22+ (for runtime validation)
- `immer` (for immutable updates)
- `vitest` with `expectTypeOf` (for type testing)
- `@typescript-eslint` (for linting)

This type system provides maximum safety with minimal complexity when following these best practices.
