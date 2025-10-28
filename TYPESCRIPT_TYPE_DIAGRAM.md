# TypeScript Filter System - Type Relationships

Visual guide to understanding the filter type system architecture.

---

## Type Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    Zod Schemas (Source of Truth)             │
│                                                              │
│  filterFieldSchema = z.enum([                                │
│    "client", "method", "session", "server",                  │
│    "duration", "tokens"                                      │
│  ])                                                          │
│                                                              │
│  stringOperatorSchema = z.enum(["is", "contains"])           │
│  numericOperatorSchema = z.enum(["eq","gt","lt","gte","lte"])│
└──────────────────┬───────────────────────────────────────────┘
                   │ z.infer<typeof ...>
                   ↓
┌─────────────────────────────────────────────────────────────┐
│                    Base TypeScript Types                     │
│                                                              │
│  type FilterField = "client" | "method" | "session" |        │
│                     "server" | "duration" | "tokens"         │
│                                                              │
│  type StringOperator = "is" | "contains"                     │
│  type NumericOperator = "eq" | "gt" | "lt" | "gte" | "lte"  │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│              Individual Filter Type Schemas                  │
│                                                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │ clientFilterSchema = z.object({                 │        │
│  │   id: z.string().uuid(),                        │        │
│  │   field: z.literal("client"),                   │        │
│  │   operator: stringOperatorSchema,               │        │
│  │   value: z.union([string, string[]])            │        │
│  │ })                                              │        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
│  (Similar schemas for: method, session, server,              │
│   duration, tokens)                                          │
└──────────────────┬───────────────────────────────────────────┘
                   │ z.infer<typeof ...>
                   ↓
┌─────────────────────────────────────────────────────────────┐
│              Individual Filter Types                         │
│                                                              │
│  type ClientFilter = {                                       │
│    id: string                                                │
│    field: "client"                                           │
│    operator: "is" | "contains"                               │
│    value: string | string[]                                  │
│  }                                                           │
│                                                              │
│  type MethodFilter = { ... }  // Similar structure           │
│  type SessionFilter = { ... }                                │
│  type ServerFilter = { ... }                                 │
│  type DurationFilter = { ... } // value: number | number[]   │
│  type TokensFilter = { ... }                                 │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│                  Discriminated Union                         │
│                                                              │
│  type Filter = ClientFilter | MethodFilter | SessionFilter | │
│                ServerFilter | DurationFilter | TokensFilter  │
│                                                              │
│  Discriminator: 'field' property                             │
│                                                              │
│  if (filter.field === "client") {                            │
│    // TypeScript knows: filter is ClientFilter              │
│    // filter.operator is StringOperator                     │
│    // filter.value is string | string[]                     │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Generic Type Utilities

### FilterOperator\<F extends FilterField\>

Maps filter field to its allowed operators:

```typescript
type FilterOperator<F extends FilterField> =
  F extends "client" | "method" | "session" | "server"
    ? StringOperator          // "is" | "contains"
    : F extends "duration" | "tokens"
    ? NumericOperator         // "eq" | "gt" | "lt" | "gte" | "lte"
    : never;                  // Exhaustiveness check

// Examples:
FilterOperator<"client">   → StringOperator
FilterOperator<"duration"> → NumericOperator
FilterOperator<"unknown">  → never (compile error)
```

**Type Flow:**
```
FilterField
    ↓ (conditional type)
    ↓
    ├─→ String fields  → StringOperator
    ├─→ Numeric fields → NumericOperator
    └─→ Unknown fields → never (error)
```

---

### FilterValue\<F extends FilterField\>

Maps filter field to its value type:

```typescript
type FilterValue<F extends FilterField> =
  F extends "duration" | "tokens"
    ? number | number[]       // Numeric values
    : string | string[];      // String values

// Examples:
FilterValue<"client">   → string | string[]
FilterValue<"duration"> → number | number[]
```

**Type Flow:**
```
FilterField
    ↓ (conditional type)
    ↓
    ├─→ Numeric fields → number | number[]
    └─→ String fields  → string | string[]
```

---

### FiltersForField\<F extends FilterField\>

Extracts specific filter type from union:

```typescript
type FiltersForField<F extends FilterField> = Extract<
  Filter,
  { field: F }
>;

// Examples:
FiltersForField<"client">   → ClientFilter
FiltersForField<"duration"> → DurationFilter
FiltersForField<"method">   → MethodFilter
```

**Type Flow:**
```
Filter (union of all filter types)
    ↓ Extract<Filter, { field: F }>
    ↓
Specific Filter Type
    (ClientFilter | DurationFilter | etc.)
```

---

## Type Narrowing Patterns

### Pattern 1: Type Guards

```typescript
function isClientFilter(filter: Filter): filter is ClientFilter {
  return filter.field === "client";
}

// Usage:
const filter: Filter = getFilter();

if (isClientFilter(filter)) {
  // TypeScript knows: filter is ClientFilter
  console.log(filter.operator);  // "is" | "contains"
  console.log(filter.value);     // string | string[]
}
```

**Type Flow:**
```
Filter (union)
    ↓ isClientFilter() predicate
    ↓
ClientFilter (narrowed)
    ├─→ field: "client" (literal)
    ├─→ operator: StringOperator
    └─→ value: string | string[]
```

---

### Pattern 2: Discriminated Union

```typescript
function handleFilter(filter: Filter) {
  switch (filter.field) {
    case "client":
      // TypeScript knows: filter is ClientFilter
      console.log(filter.operator);  // StringOperator
      break;

    case "duration":
      // TypeScript knows: filter is DurationFilter
      console.log(filter.operator);  // NumericOperator
      break;

    default:
      const _check: never = filter;  // Exhaustiveness
  }
}
```

**Type Flow:**
```
Filter (union)
    ↓ switch on discriminator (field)
    │
    ├─→ case "client":   Filter → ClientFilter
    ├─→ case "method":   Filter → MethodFilter
    ├─→ case "session":  Filter → SessionFilter
    ├─→ case "server":   Filter → ServerFilter
    ├─→ case "duration": Filter → DurationFilter
    ├─→ case "tokens":   Filter → TokensFilter
    └─→ default:         Filter → never (all cases handled)
```

---

### Pattern 3: Generic Type Guard

```typescript
function isFilterField<F extends FilterField>(
  filter: Filter,
  field: F
): filter is FiltersForField<F> {
  return filter.field === field;
}

// Usage:
const filter: Filter = getFilter();

if (isFilterField(filter, "duration")) {
  // TypeScript knows: filter is DurationFilter
  console.log(filter.operator);  // NumericOperator
  console.log(filter.value);     // number | number[]
}
```

**Type Flow:**
```
Filter (union) + FilterField (literal)
    ↓ Generic type parameter F
    ↓ FiltersForField<F> = Extract<Filter, { field: F }>
    ↓
Specific Filter Type
    (type-safe at compile time)
```

---

## Multi-Value Type Handling

### Schema Definition

```typescript
// Zod schema allows single OR array
value: z.union([
  z.string().min(1),                    // Single value
  z.array(z.string().min(1)).min(1)     // Multiple values
])
```

**Type Flow:**
```
Zod Schema
    ↓ z.union([string, string[]])
    ↓
TypeScript Type
    value: string | string[]
    ↓
Runtime Validation
    ├─→ "value"           → Valid (string)
    ├─→ ["v1", "v2"]      → Valid (string[])
    ├─→ []                → Invalid (min 1 element)
    └─→ ""                → Invalid (min 1 char)
```

### Type-Safe Handling

```typescript
function handleValue(value: string | string[]): void {
  if (Array.isArray(value)) {
    // TypeScript knows: value is string[]
    value.forEach(v => console.log(v));  // ✅ Type-safe
  } else {
    // TypeScript knows: value is string
    console.log(value.toUpperCase());    // ✅ Type-safe
  }
}
```

**Type Narrowing:**
```
value: string | string[]
    ↓ Array.isArray(value)
    │
    ├─→ true:  value is string[]
    └─→ false: value is string
```

---

## Factory Function Type Safety

### createFilter\<F extends FilterField\>

```typescript
export function createFilter<F extends FilterField>(
  input: FilterInput<F>        // Omit<FiltersForField<F>, "id">
): FiltersForField<F> {        // Full filter with id
  return {
    id: crypto.randomUUID(),
    ...input,
  } as FiltersForField<F>;     // Required assertion
}
```

**Type Flow:**
```
FilterInput<F> (without id)
    ↓ Generic parameter F
    ↓
    ├─→ field: F (literal)
    ├─→ operator: FilterOperator<F>
    └─→ value: FilterValue<F>
    ↓ Add UUID
    ↓ Type assertion (necessary for generic spread)
    ↓
FiltersForField<F> (complete filter)
```

**Why Type Assertion is Required:**

TypeScript cannot prove that spreading `...input` preserves the discriminated union structure with generics. The type assertion is safe because:

1. Input is already typed as `FilterInput<F>`
2. We're only adding an `id` field
3. The generic constraint ensures type safety

---

## URL Parsing Type Safety

### parseFiltersFromUrl

```typescript
export function parseFiltersFromUrl(
  params: URLSearchParams
): Filter[] {
  const filters: Filter[] = [];

  for (const field of fieldKeys) {
    // Parse raw values from URL
    let value: string | number | string[] | number[];

    // ... parsing logic ...

    // Create unvalidated filter
    const filterInput = { field, operator, value };

    // Validate with Zod (runtime type checking)
    const result = safeParseFilter({
      id: crypto.randomUUID(),
      ...filterInput,
    });

    if (result.success) {
      filters.push(result.data);  // ✅ Type-safe Filter
    }
    // Invalid filters are dropped
  }

  return filters;
}
```

**Type Flow:**
```
URLSearchParams (untyped strings)
    ↓ Manual parsing
    ↓
Unvalidated object
    { field: string, operator: string, value: any }
    ↓ safeParseFilter() (Zod validation)
    ↓
    ├─→ Success: Filter (type-safe)
    └─→ Failure: dropped (invalid)
    ↓
Filter[] (all elements validated)
```

**Key Points:**
- Input is untyped (URL strings)
- Zod provides runtime validation
- TypeScript types guaranteed after validation
- Invalid data never enters type system

---

## Type Safety Guarantees

### ✅ Compile-Time Guarantees

1. **Field-Operator Compatibility**
   ```typescript
   // ✅ Valid
   const f: ClientFilter = {
     field: "client",
     operator: "is",  // StringOperator
     value: "test"
   };

   // ❌ Compile error
   const f: ClientFilter = {
     field: "client",
     operator: "gt",  // NumericOperator not allowed
     value: "test"
   };
   ```

2. **Field-Value Type Compatibility**
   ```typescript
   // ✅ Valid
   const f: DurationFilter = {
     field: "duration",
     value: 100  // number
   };

   // ❌ Compile error
   const f: DurationFilter = {
     field: "duration",
     value: "100"  // string not allowed
   };
   ```

3. **Exhaustive Switch Handling**
   ```typescript
   switch (filter.field) {
     case "client":   return ...;
     case "method":   return ...;
     case "session":  return ...;
     case "server":   return ...;
     case "duration": return ...;
     case "tokens":   return ...;
     default:
       const _check: never = filter;  // ✅ Compile error if case missing
   }
   ```

### ✅ Runtime Guarantees (via Zod)

1. **Schema Validation**
   - Empty strings rejected (`min(1)`)
   - Empty arrays rejected (`min(1)`)
   - Invalid UUIDs rejected (`uuid()`)
   - Type mismatches rejected (string vs number)

2. **Discriminated Union Validation**
   - Zod validates field-operator-value combinations
   - Invalid combinations rejected at parse time

---

## Common Type Patterns

### Pattern 1: Safe Filter Creation

```typescript
// ✅ Type-safe with validation
const filter = createFilter({
  field: "client",
  operator: "is",
  value: "test"
});
// Type: ClientFilter
```

### Pattern 2: Safe Filter Matching

```typescript
// ✅ Type-safe with narrowing
if (isClientFilter(filter)) {
  // filter is ClientFilter
  matchesStringFilter(value, filter.operator, filter.value);
}
```

### Pattern 3: Safe Generic Operations

```typescript
// ✅ Type-safe with generic constraints
function getFilterValue<F extends FilterField>(
  filter: FiltersForField<F>
): FilterValue<F> {
  return filter.value;
}

const clientFilter: ClientFilter = { ... };
const value = getFilterValue(clientFilter);
// Type: string | string[]
```

---

## Type Safety Checklist

| Concern | Status | Mechanism |
|---------|--------|-----------|
| Field-operator compatibility | ✅ | Generic `FilterOperator<F>` |
| Field-value compatibility | ✅ | Generic `FilterValue<F>` |
| Discriminated union narrowing | ✅ | Type guards + switch |
| Exhaustive case handling | ⚠️ | Missing `never` check |
| Multi-value support | ✅ | Union types + array checks |
| URL parsing safety | ✅ | Zod validation |
| Factory function safety | ✅ | Generic constraints |
| Runtime validation | ✅ | Zod schemas |

---

## Extending the System

### Adding a New Filter Type

**Step 1:** Add to schema enum
```typescript
export const filterFieldSchema = z.enum([
  "client", "method", "session", "server", "duration", "tokens",
  "status"  // ← NEW
]);
```

**Step 2:** Create filter schema
```typescript
export const statusFilterSchema = z.object({
  id: z.string().uuid(),
  field: z.literal("status"),
  operator: stringOperatorSchema,
  value: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
});
```

**Step 3:** Add to discriminated union
```typescript
export const filterSchema = z.discriminatedUnion("field", [
  // ... existing schemas ...
  statusFilterSchema,  // ← NEW
]);
```

**Step 4:** Update type utilities
```typescript
// FilterOperator - TypeScript will show error if not updated
type FilterOperator<F extends FilterField> =
  F extends "client" | "method" | "session" | "server" | "status"  // ← Add "status"
    ? StringOperator
    : F extends "duration" | "tokens"
    ? NumericOperator
    : never;
```

**Step 5:** Add type guard
```typescript
export function isStatusFilter(filter: Filter): filter is StatusFilter {
  return filter.field === "status";
}
```

**Step 6:** Handle in matchesFilter
```typescript
case "status":  // ← TypeScript will error here until added
  return matchesStringFilter(log.status, filter.operator, filter.value);
```

**TypeScript will guide you through all required changes!**

---

## Conclusion

The filter system provides **strong type safety** through:

1. **Zod schemas** - Runtime validation
2. **Discriminated unions** - Compile-time narrowing
3. **Generic utilities** - Type-safe operations
4. **Type guards** - Safe type narrowing
5. **Exhaustiveness checks** - Catch missing cases

The type system ensures **no runtime type errors** when used correctly.
