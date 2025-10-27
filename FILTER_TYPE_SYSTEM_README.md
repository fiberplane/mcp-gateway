# Filter Component Type System - Complete Review

## Overview

This directory contains a comprehensive TypeScript type system design for the MCP Gateway web UI filter component. The design prioritizes **compile-time type safety**, **runtime validation**, and **seamless API integration**.

## Documents

### 1. [FILTER_TYPE_SYSTEM.md](./FILTER_TYPE_SYSTEM.md)
**Comprehensive design document** covering:
- Current type landscape analysis
- Recommended type system architecture
- Field/operator/value type mappings
- Filter state management
- URL serialization strategy
- Zod schema integration
- API integration layer
- Implementation checklist

**Key Highlights:**
- Mapped types for automatic operator constraints
- Discriminated unions for type narrowing
- Hybrid filtering strategy (server + client)
- Type-safe URL serialization/deserialization

### 2. [FILTER_REVIEW_RESPONSES.md](./FILTER_REVIEW_RESPONSES.md)
**Detailed answers to your specific questions:**

1. **Type Safety**: Generics wrapped in discriminated union
2. **Type Narrowing**: Mapped types constrain operators by field
3. **Zod Integration**: Essential for runtime validation
4. **API Alignment**: Shared types + conversion layer
5. **URL Serialization**: Compact format with validation
6. **Immutability**: `readonly` modifiers + Immer
7. **Type Inference**: Helper functions with generics
8. **Error Handling**: Discriminated union for error states

**Each answer includes:**
- Detailed explanation
- Code examples
- Rationale
- Benefits

### 3. [FILTER_IMPLEMENTATION_EXAMPLE.md](./FILTER_IMPLEMENTATION_EXAMPLE.md)
**Production-ready implementation examples:**
- `packages/types/src/filter-types.ts` - Type definitions
- `packages/types/src/filter-schemas.ts` - Zod schemas
- `packages/types/src/filter-utils.ts` - Helper functions
- `packages/web/src/lib/filter-reducer.ts` - State management
- `packages/web/src/lib/filter-url.ts` - URL serialization
- `packages/web/src/lib/filter-api-adapter.ts` - API integration

**Demonstrates:**
- Type-safe filter creation
- Immutable state updates with Immer
- URL parameter handling
- Hybrid filtering (server + client)

### 4. [FILTER_TYPE_BEST_PRACTICES.md](./FILTER_TYPE_BEST_PRACTICES.md)
**Best practices and common pitfalls:**

**TypeScript Best Practices:**
1. Use `satisfies` for type checking without widening
2. Avoid type assertion hell with mapped types
3. Use const assertions for arrays
4. Leverage discriminated unions for exhaustive checking
5. Use template literal types for string validation
6. Prefer type predicates over type assertions

**Common Pitfalls:**
1. Circular type dependencies
2. Overly complex generic constraints
3. Zod schema/TypeScript type mismatches
4. Readonly arrays and spread operations
5. Generic type parameter inference failures
6. Union type widening in arrays

**Performance Considerations:**
- Avoid expensive type computations
- Use type caching for repeated types

**Testing & Documentation:**
- Test type narrowing with `expectTypeOf`
- Document type constraints with JSDoc
- Verify Zod schema alignment

## Quick Start

### Installation

```bash
# Install dependencies in web package
cd packages/web
bun add immer

# Types package uses existing Zod
# No additional dependencies needed
```

### Implementation Steps

#### Phase 1: Add Types to Types Package

1. Create `packages/types/src/filter-types.ts`
2. Create `packages/types/src/filter-schemas.ts`
3. Create `packages/types/src/filter-utils.ts`
4. Export from `packages/types/src/filters.ts`
5. Rebuild types package: `bun run build`

#### Phase 2: Integrate in Web UI

1. Create filter reducer with Immer
2. Add URL serialization helpers
3. Build API adapter for hybrid filtering
4. Create filter UI components
5. Wire up with TanStack Router

#### Phase 3: Test

1. Unit tests for type guards
2. Unit tests for serialization
3. Integration tests for API filtering
4. E2E tests for filter UI

## Key Design Decisions

### 1. Generics + Discriminated Union

**Decision:** Use generic `TypedFilter<F, O>` wrapped in a discriminated union.

**Rationale:**
- Generics provide compile-time type safety
- Discriminated unions enable exhaustive checking
- TypeScript can narrow based on `field` property

### 2. Mapped Types for Operator Constraints

**Decision:** Use mapped types to constrain operators by field type.

**Rationale:**
- Automatic constraint without manual type definitions
- Prevents invalid field/operator combinations
- Excellent type inference

### 3. Zod Schemas in Types Package

**Decision:** Add Zod schemas to `@fiberplane/mcp-gateway-types`.

**Rationale:**
- Shared between web UI and API
- Single source of truth
- Enables future API enhancements
- Type-safe runtime validation

### 4. Hybrid Filtering Strategy

**Decision:** Split filters into server-side (API) and client-side (browser).

**Rationale:**
- Current API has limited filter support
- Client-side filtering enables advanced features now
- Clear migration path when API adds support
- No breaking changes to existing code

### 5. Readonly Types + Immer

**Decision:** Use `readonly` modifiers throughout, Immer for updates.

**Rationale:**
- Prevents accidental mutations
- Better React performance
- Simpler update logic
- Type safety preserved

### 6. Compact URL Serialization

**Decision:** Use `field:operator:value` format for URL parameters.

**Rationale:**
- Human-readable URLs
- Easy to share and bookmark
- Supports manual editing
- Graceful degradation for invalid filters

## Type System Architecture

```typescript
// Field type mapping (single source of truth)
interface FilterFieldTypeMap {
  method: string;
  duration: number;
  timestamp: Date;
  // ...
}

// Operator constraints based on value type
type FilterOperator<F extends FilterField> =
  FilterFieldTypeMap[F] extends string ? StringOperator :
  FilterFieldTypeMap[F] extends number ? NumberOperator :
  FilterFieldTypeMap[F] extends Date ? DateOperator :
  never;

// Value type based on field and operator
type FilterValue<F, O> = O extends "between"
  ? readonly [FilterFieldTypeMap[F], FilterFieldTypeMap[F]]
  : FilterFieldTypeMap[F];

// Generic filter with type safety
interface TypedFilter<F extends FilterField, O extends FilterOperator<F>> {
  readonly id: string;
  readonly field: F;
  readonly operator: O;
  readonly value: FilterValue<F, O>;
  readonly enabled: boolean;
}

// Discriminated union for all filters
type Filter = {
  [F in FilterField]: {
    [O in FilterOperator<F>]: TypedFilter<F, O>;
  }[FilterOperator<F>];
}[FilterField];
```

## Usage Examples

### Creating Type-Safe Filters

```typescript
import { createFilter } from "@fiberplane/mcp-gateway-types";

// ✅ All valid - full type inference
const durationFilter = createFilter("duration", "gt", 1000);
const methodFilter = createFilter("method", "contains", "initialize");
const dateFilter = createFilter("timestamp", "between", [
  new Date("2025-01-01"),
  new Date("2025-01-31")
]);

// ❌ TypeScript errors
createFilter("method", "gt", 100);        // Error: 'gt' not valid for string
createFilter("duration", "contains", ""); // Error: 'contains' not valid for number
```

### Type Narrowing

```typescript
function renderFilter(filter: Filter) {
  switch (filter.field) {
    case "duration":
      // TypeScript knows: operator is NumberOperator, value is number
      return <NumberInput value={filter.value} />;

    case "timestamp":
      if (filter.operator === "between") {
        // TypeScript knows: value is [Date, Date]
        return <DateRangeInput value={filter.value} />;
      }
      // TypeScript knows: value is Date
      return <DateInput value={filter.value} />;

    default:
      // Exhaustive check - TypeScript error if case missing
      const _exhaustive: never = filter;
      return null;
  }
}
```

### State Management

```typescript
import { useReducer } from "react";
import { filterReducer, initialFilterState } from "./lib/filter-reducer";

function FilterComponent() {
  const [state, dispatch] = useReducer(filterReducer, initialFilterState);

  const addFilter = (filter: Filter) => {
    dispatch({ type: "ADD_FILTER", payload: filter });
  };

  const toggleFilter = (id: string) => {
    dispatch({ type: "TOGGLE_FILTER", payload: id });
  };

  // State updates are immutable and type-safe
}
```

### API Integration

```typescript
import { convertFiltersToStrategy, applyClientSideFilters } from "./lib/filter-api-adapter";

async function fetchFilteredLogs(filterState: FilterState) {
  // Split filters into server-side and client-side
  const { serverSide, clientSide } = convertFiltersToStrategy(filterState);

  // Fetch with API-supported filters
  const { data } = await api.getLogs(serverSide);

  // Apply client-side filters
  const filtered = applyClientSideFilters(data, clientSide);

  return filtered;
}
```

## API Limitations & Workarounds

### Current API Support

The API (`LogQueryOptions`) currently supports:

| Field | Operators | Notes |
|-------|-----------|-------|
| `method` | `eq` (exact match) | Via `method` parameter |
| `sessionId` | `eq` (exact match) | Via `session` parameter |
| `serverName` | `eq` (exact match) | Via `server` parameter |
| `clientName` | `eq` (exact match) | Via `clientName` parameter |
| `clientIp` | `eq` (exact match) | Via `clientIp` parameter |
| `timestamp` | `before`, `after`, `between` | Via `before`/`after` parameters |

**Not supported:**
- `duration`, `httpStatus` filters (require client-side filtering)
- String operators: `contains`, `startsWith`, `endsWith` (require client-side)
- Number operators: `gt`, `gte`, `lt`, `lte` (require client-side)
- `sender`, `receiver` filters (aliases, require client-side)

### Workaround: Hybrid Filtering

The implementation automatically splits filters:

1. **Server-side** - API-supported filters applied in database query
2. **Client-side** - Advanced filters applied in browser after fetch

**Benefits:**
- Enables advanced filtering now
- Maintains good performance (API does heavy lifting)
- Clear migration path when API adds support
- No breaking changes to web UI code

### Future API Enhancement

When extending the API:

```typescript
// In packages/types/src/logs.ts
export interface LogQueryOptions {
  // Option 1: Add structured filters
  filters?: Filter[];

  // Option 2: Add field-specific filter objects
  methodFilter?: { operator: StringOperator; value: string };
  durationFilter?: { operator: NumberOperator; value: number };

  // Maintain backward compatibility
  method?: string; // Deprecated, use filters
  serverName?: string; // Deprecated, use filters
}
```

Then update `filter-api-adapter.ts` to use new API capabilities.

## Migration Checklist

- [ ] Add filter types to `@fiberplane/mcp-gateway-types`
- [ ] Add Zod schemas to types package
- [ ] Add helper functions (createFilter, serialization)
- [ ] Rebuild types package
- [ ] Install Immer in web package
- [ ] Create filter reducer with Immer
- [ ] Create URL serialization helpers
- [ ] Create API adapter for hybrid filtering
- [ ] Build filter UI components
- [ ] Integrate with TanStack Router
- [ ] Add unit tests for filter logic
- [ ] Add integration tests for API filtering
- [ ] Add E2E tests for filter UI
- [ ] Update documentation
- [ ] Consider API enhancements for future

## Testing Strategy

### Unit Tests

```typescript
describe("Filter type system", () => {
  describe("createFilter", () => {
    it("creates type-safe filters", () => {
      const filter = createFilter("duration", "gt", 1000);
      expect(filter).toMatchObject({
        field: "duration",
        operator: "gt",
        value: 1000,
        enabled: true,
      });
    });
  });

  describe("Type narrowing", () => {
    it("narrows based on field", () => {
      const filter: Filter = createFilter("duration", "gt", 1000);

      if (filter.field === "duration") {
        expectTypeOf(filter.operator).toMatchTypeOf<NumberOperator>();
        expectTypeOf(filter.value).toBeNumber();
      }
    });
  });

  describe("Serialization", () => {
    it("serializes filters to URL format", () => {
      const filter = createFilter("duration", "gt", 1000);
      expect(serializeFilter(filter)).toBe("duration:gt:1000");
    });

    it("deserializes filters from URL format", () => {
      const filter = deserializeFilter("duration:gt:1000");
      expect(filter).toMatchObject({
        field: "duration",
        operator: "gt",
        value: 1000,
      });
    });
  });
});
```

### Integration Tests

```typescript
describe("Filter API integration", () => {
  it("converts filters to API query options", () => {
    const state: FilterState = {
      search: "",
      filters: [
        createFilter("method", "eq", "initialize"),
        createFilter("duration", "gt", 1000),
      ],
      quickFilters: {
        showErrors: false,
        showSuccessOnly: false,
        showSlowRequests: false,
      },
    };

    const { serverSide, clientSide } = convertFiltersToStrategy(state);

    expect(serverSide).toEqual({
      method: "initialize",
    });

    expect(clientSide).toHaveLength(1);
    expect(clientSide[0]).toMatchObject({
      field: "duration",
      operator: "gt",
      value: 1000,
    });
  });
});
```

## Performance Considerations

### Type System Performance

- **Compilation time**: Mapped types are efficient, no performance issues expected
- **Bundle size**: Types don't affect runtime bundle (erased at build time)
- **Type checking**: Fast with TypeScript 5.3+

### Runtime Performance

- **State updates**: Immer uses structural sharing (efficient)
- **Filtering**: Client-side filtering is fast for typical log volumes (<10k entries)
- **Serialization**: URL serialization is O(n) where n = number of filters

### Optimization Tips

1. **Debounce filter updates** to reduce re-renders
2. **Memoize filtered results** with `useMemo`
3. **Virtualize log list** if >1000 entries
4. **Add pagination** for better performance with large datasets

## Troubleshooting

### TypeScript Errors

**Error:** "Type 'string' is not assignable to type 'FilterOperator<F>'"

**Solution:** Use type assertion or helper function:
```typescript
// ❌ Bad
const operator: string = "gt";
createFilter("duration", operator, 1000); // Error!

// ✅ Good
const operator = "gt" as const;
createFilter("duration", operator, 1000);

// ✅ Better
const operator: NumberOperator = "gt";
createFilter("duration", operator, 1000);
```

**Error:** "Cannot infer type argument 'O'"

**Solution:** Ensure operator is properly constrained:
```typescript
// ❌ Bad
function createFilter<F, O>(field: F, operator: O, value: any) { }

// ✅ Good
function createFilter<F extends FilterField, O extends FilterOperator<F>>(
  field: F,
  operator: O,
  value: FilterValue<F, O>
) { }
```

### Zod Validation Errors

**Error:** "Validation failed for filter"

**Solution:** Check Zod schema matches TypeScript type:
```typescript
// Ensure schemas use satisfies
const stringOperatorSchema = z.enum([...]) satisfies z.ZodType<StringOperator>;
```

### URL Deserialization Failures

**Error:** "Filter not loaded from URL"

**Solution:** Check URL format and add error logging:
```typescript
const { filters, errors } = deserializeFiltersFromURL(urlParams.filters);

if (errors.length > 0) {
  console.warn("Failed to load filters:", errors);
  // Show user-friendly message
}
```

## Resources

- [TypeScript Handbook - Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [TypeScript Handbook - Discriminated Unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
- [Zod Documentation](https://zod.dev/)
- [Immer Documentation](https://immerjs.github.io/immer/)
- [TanStack Router - Search Params](https://tanstack.com/router/latest/docs/framework/react/guide/search-params)

## Summary

This type system provides:

✅ **Compile-time type safety** - Invalid filters caught by TypeScript
✅ **Runtime validation** - Zod schemas validate external data
✅ **Type inference** - Minimal type annotations required
✅ **Immutability** - Readonly types + Immer for updates
✅ **API integration** - Seamless conversion to query options
✅ **URL serialization** - Type-safe bookmark/share support
✅ **Extensibility** - Easy to add new fields/operators
✅ **Error handling** - Type-safe error states
✅ **Performance** - Efficient types and runtime code
✅ **Developer experience** - Excellent autocomplete and error messages

The recommended implementation balances type safety, developer experience, and practical constraints of the existing API.
