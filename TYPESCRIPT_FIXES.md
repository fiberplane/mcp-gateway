# TypeScript Filter System - Recommended Fixes

**Priority:** HIGH
**Estimated Time:** 15 minutes
**Files Affected:** 2 files

---

## Fix #1: Unsafe Type Assertion in AddFilterDropdown

**File:** `/Users/jaccoflenter/dev/fiberplane/gateway/filter/packages/web/src/components/add-filter-dropdown.tsx`

**Line:** 100

**Issue:** Using `as string` to cast first element of array without proper type safety.

### Current Code
```typescript
const handleApply = (filterType: string, values: string[]) => {
  const field = filterType as FilterField;

  if (values.length === 0) {
    if (onRemove) {
      onRemove(field);
    }
    return;
  }

  // Create filter with array values for multi-select
  // Use single value if only one selected, otherwise use array
  let filterValue: string | string[];
  if (values.length === 1) {
    // Safe to access first element since we checked length
    filterValue = values[0] as string;  // ⚠️ UNSAFE ASSERTION
  } else {
    filterValue = values;
  }

  const newFilter = createFilter({
    field,
    operator: "is" as const,
    value: filterValue,
  });

  onAdd(newFilter);
};
```

### Recommended Fix
```typescript
const handleApply = (filterType: string, values: string[]) => {
  const field = filterType as FilterField;

  if (values.length === 0) {
    if (onRemove) {
      onRemove(field);
    }
    return;
  }

  // Create filter with array values for multi-select
  // Use single value if only one selected, otherwise use array
  let filterValue: string | string[];
  if (values.length === 1) {
    // Non-null assertion is safe here because length check guarantees element exists
    filterValue = values[0]!;  // ✅ SAFE: Non-null assertion operator
  } else {
    filterValue = values;
  }

  const newFilter = createFilter({
    field,
    operator: "is" as const,
    value: filterValue,
  });

  onAdd(newFilter);
};
```

**Why This is Better:**
- `values[0]!` is semantically correct - we're asserting non-null, not changing type
- TypeScript understands `!` in context of length checks
- More explicit about what we're asserting (existence, not type)

**Alternative (Even Safer):**
```typescript
if (values.length === 1) {
  const firstValue = values[0];
  if (firstValue !== undefined) {
    filterValue = firstValue;
  } else {
    // This should never happen, but provides runtime safety
    filterValue = values;
  }
}
```

---

## Fix #2: Add Exhaustiveness Check to matchesFilter

**File:** `/Users/jaccoflenter/dev/fiberplane/gateway/filter/packages/web/src/lib/filter-utils.ts`

**Line:** 183-224

**Issue:** Switch statement doesn't enforce exhaustiveness checking, could miss new filter types.

### Current Code
```typescript
export function matchesFilter(log: ApiLogEntry, filter: Filter): boolean {
  switch (filter.field) {
    case "client":
      return matchesStringFilter(
        log.metadata.client?.name,
        filter.operator,
        filter.value,
      );

    case "method":
      return matchesStringFilter(log.method, filter.operator, filter.value);

    case "session":
      return matchesStringFilter(
        log.metadata.sessionId,
        filter.operator,
        filter.value,
      );

    case "server":
      return matchesStringFilter(
        log.metadata.server?.name,
        filter.operator,
        filter.value,
      );

    case "duration":
      return matchesNumericFilter(
        log.metadata.durationMs,
        filter.operator,
        filter.value,
      );

    case "tokens":
      // Note: tokens field doesn't exist yet in ApiLogEntry
      // This is a placeholder for future implementation
      return true;

    default:
      // Exhaustiveness check - TypeScript will error if we miss a case
      return false;  // ⚠️ UNSAFE: Silently returns false
  }
}
```

### Recommended Fix
```typescript
export function matchesFilter(log: ApiLogEntry, filter: Filter): boolean {
  switch (filter.field) {
    case "client":
      return matchesStringFilter(
        log.metadata.client?.name,
        filter.operator,
        filter.value,
      );

    case "method":
      return matchesStringFilter(log.method, filter.operator, filter.value);

    case "session":
      return matchesStringFilter(
        log.metadata.sessionId,
        filter.operator,
        filter.value,
      );

    case "server":
      return matchesStringFilter(
        log.metadata.server?.name,
        filter.operator,
        filter.value,
      );

    case "duration":
      return matchesNumericFilter(
        log.metadata.durationMs,
        filter.operator,
        filter.value,
      );

    case "tokens":
      // Note: tokens field doesn't exist yet in ApiLogEntry
      // This is a placeholder for future implementation
      return true;

    default: {
      // Exhaustiveness check: TypeScript will error if we add a new FilterField
      // and don't handle it in the switch statement above
      const _exhaustiveCheck: never = filter;

      // This code should never execute at runtime if TypeScript types are correct
      console.error(
        `Unhandled filter field: ${(filter as Filter).field}`,
        filter
      );
      return false;
    }
  }
}
```

**Why This is Better:**
- TypeScript will show a compile error if you add a new `FilterField` and forget to handle it
- Explicit runtime error logging helps debug issues
- The `never` type assignment forces exhaustiveness
- Better maintainability when extending filter types

**Example Error When Adding New Filter Type:**

If you add a new filter type to the schema:
```typescript
export const filterFieldSchema = z.enum([
  "client",
  "method",
  "session",
  "server",
  "duration",
  "tokens",
  "status",  // ← NEW FIELD
]);
```

TypeScript will error in `matchesFilter`:
```
Error: Type 'Filter' is not assignable to type 'never'.
  Type 'StatusFilter' is not assignable to type 'never'.
```

This forces you to add the case:
```typescript
case "status":
  return matchesStringFilter(log.status, filter.operator, filter.value);
```

---

## Fix #3: Improve Type Safety of handleApply Callback

**File:** `/Users/jaccoflenter/dev/fiberplane/gateway/filter/packages/web/src/components/add-filter-dropdown.tsx`

**Line:** 84-112

**Issue:** `filterType` parameter is typed as `string`, requiring unsafe cast to `FilterField`.

### Current Code
```typescript
const handleApply = (filterType: string, values: string[]) => {
  const field = filterType as FilterField;  // ⚠️ UNSAFE: No validation

  if (values.length === 0) {
    if (onRemove) {
      onRemove(field);
    }
    return;
  }

  // ... rest of function
};
```

### Recommended Fix - Option 1: Constrain FilterTypeMenu

**File:** `packages/web/src/components/filter-type-menu.tsx` (line 32-38)

Change the callback signature to be more specific:

```typescript
interface FilterTypeMenuProps {
  /**
   * Callback when filters are applied (menu closes)
   * @param filterType - The type of filter (method, client, server, session)
   * @param values - Array of selected values (empty array = remove filter)
   */
  onApply: (
    filterType: "method" | "client" | "server" | "session",  // ✅ Specific union
    values: string[]
  ) => void;

  // ... rest of interface
}
```

Then in `add-filter-dropdown.tsx`:
```typescript
const handleApply = (
  filterType: "method" | "client" | "server" | "session",  // ✅ Type-safe
  values: string[]
) => {
  const field: FilterField = filterType;  // ✅ No cast needed, safe assignment

  if (values.length === 0) {
    if (onRemove) {
      onRemove(field);
    }
    return;
  }

  // ... rest of function
};
```

**Why This is Better:**
- No type assertion needed
- Compile-time safety - can't pass invalid filter types
- Self-documenting - shows which filters are supported
- Better IntelliSense/autocomplete in editors

### Recommended Fix - Option 2: Runtime Validation

If you want to keep the generic `string` parameter (for extensibility), add validation:

```typescript
const SUPPORTED_STRING_FILTERS = [
  "method",
  "client",
  "server",
  "session"
] as const;

type SupportedStringFilter = typeof SUPPORTED_STRING_FILTERS[number];

const handleApply = (filterType: string, values: string[]) => {
  // Runtime validation
  if (!SUPPORTED_STRING_FILTERS.includes(filterType as any)) {
    console.error(`Unsupported filter type: ${filterType}`);
    return;
  }

  const field = filterType as SupportedStringFilter;  // ✅ Safer cast after validation

  if (values.length === 0) {
    if (onRemove) {
      onRemove(field);
    }
    return;
  }

  // ... rest of function
};
```

**Recommendation:** Use **Option 1** - it's simpler and provides better type safety at compile time.

---

## Fix #4: Add Development Logging for URL Parsing

**File:** `/Users/jaccoflenter/dev/fiberplane/gateway/filter/packages/web/src/lib/filter-utils.ts`

**Line:** 103-112

**Issue:** Invalid filters from URL are silently dropped with no feedback.

### Current Code
```typescript
const result = safeParseFilter({
  id: crypto.randomUUID(),
  ...filterInput,
});

if (result.success) {
  filters.push(result.data);
}
// Silently skip invalid filters from URL
```

### Recommended Fix
```typescript
const result = safeParseFilter({
  id: crypto.randomUUID(),
  ...filterInput,
});

if (result.success) {
  filters.push(result.data);
} else {
  // Log validation errors in development mode
  if (import.meta.env.DEV) {
    // biome-ignore lint/suspicious/noConsole: Dev-only debugging
    console.warn(
      `Invalid filter from URL dropped: field="${field}", operator="${operator}", value=`,
      value,
      "\nValidation errors:",
      result.error.format()
    );
  }
  // Silently skip invalid filters in production
}
```

**Why This is Better:**
- Helps debugging during development
- No console spam in production
- Shows detailed Zod validation errors
- Makes it clear why filters are being ignored

---

## Summary of Changes

| Fix | File | Lines | Priority | Impact |
|-----|------|-------|----------|--------|
| #1 - Type assertion | add-filter-dropdown.tsx | 100 | HIGH | Type safety |
| #2 - Exhaustiveness | filter-utils.ts | 222 | HIGH | Maintainability |
| #3 - Callback types | filter-type-menu.tsx + add-filter-dropdown.tsx | 32-38, 84 | MEDIUM | Type safety |
| #4 - Dev logging | filter-utils.ts | 108 | LOW | Developer experience |

---

## Testing After Fixes

Run these commands to verify fixes:

```bash
# Type check
bun run typecheck

# Lint check
bun run lint

# Format code
bun run format

# Test the application
bun run --filter @fiberplane/mcp-gateway-web dev
```

**Manual Testing:**
1. Add filters via the UI
2. Check URL updates correctly
3. Refresh page to ensure filters persist
4. Try invalid URL params (e.g., `?method=invalid:operator:value`)
5. Check console for dev warnings

---

## Implementation Order

**Recommended order to apply fixes:**

1. **Fix #2 (Exhaustiveness)** - 2 minutes
   - Prevents future bugs
   - No breaking changes
   - Pure improvement

2. **Fix #1 (Type assertion)** - 1 minute
   - Simple find-replace
   - No breaking changes
   - Better semantics

3. **Fix #4 (Dev logging)** - 2 minutes
   - Improves DX
   - No breaking changes
   - Easy to add

4. **Fix #3 (Callback types)** - 10 minutes
   - Requires coordination across files
   - Update interfaces
   - Test thoroughly

**Total Time:** ~15 minutes

---

## Questions?

If you want me to apply these fixes automatically, let me know and I can:
1. Make the changes in all affected files
2. Run typechecking to verify
3. Run formatting
4. Create a git commit

Just say: "Apply all TypeScript fixes" and I'll proceed.
