# FilterTypeMenu Redesign - Apply on Close Pattern

## UX Decision: Apply Filters on Menu Close

After analyzing the Figma design and UX implications, we're implementing an **"apply on close"** pattern:

- ✅ NO Apply/Cancel buttons (matches Figma)
- ✅ Filters apply when menu closes (implicit commit)
- ✅ Menu stays open during selection (exploration-friendly)
- ✅ ESC key cancels changes (accessibility)
- ✅ Visual indicator for uncommitted changes

## Why Apply on Close?

### Performance
- **Single batch update** instead of multiple updates per checkbox
- **One URL update** instead of many
- **One API refetch** instead of rapid successive refetches

### UX Benefits
- **Exploration-friendly**: Users can check/uncheck options freely
- **Mistake recovery**: Uncommitted changes can be abandoned with ESC
- **Natural mental model**: Closing menu = "I'm done selecting"
- **Less jarring**: Table doesn't flicker with each selection

### Industry Patterns
This matches how filters work in:
- Gmail (label filter menu)
- Linear (status/assignee filters)
- GitHub (filter dropdowns)
- Notion (database filters)

## Implementation Details

### State Flow

```
1. User opens menu
   → Temp state syncs with active filters

2. User checks/unchecks options
   → Temp state updates immediately
   → Active filters unchanged
   → Visual indicator shows uncommitted changes

3. User closes menu (click outside, ESC, or focuses elsewhere)
   → Apply all temp selections to active filters
   → Single state update
   → URL updates once
   → API refetches once

4. User presses ESC
   → Discard temp changes
   → Reset temp state to active filters
   → Close menu
```

### Multi-Select OR Logic

When multiple values are selected for the same field:

```typescript
// Example: User selects "tools/call" and "prompts/get"
const filter = {
  field: "method",
  operator: "is",
  value: ["tools/call", "prompts/get"] // OR logic - matches either
};

// Example: User unchecks all methods
const filter = {
  field: "method",
  operator: "is",
  value: [] // Empty array = remove filter
};
```

### Accessibility

- **Keyboard navigation**: Full keyboard support via Radix Dropdown
- **Screen reader**: Announces filter changes when menu closes
- **ESC key**: Discards uncommitted changes
- **Focus management**: Returns focus to trigger button on close

## Code Changes Required

### 1. FilterTypeMenu Component

**Remove:**
- Apply/Cancel buttons (lines 196-216)
- `handleApply` function (lines 105-122)
- `handleCancel` function (lines 124-132)

**Add:**
- `handleOpenChange` with apply-on-close logic
- `syncTempState` function to reset temp selections
- `applyFilters` function to batch apply all selections
- Visual indicator for uncommitted changes
- ESC key handler

**Update:**
- `onOpenChange` prop to call `handleOpenChange`

### 2. FilterBar Component

**Add:**
- Handler for filter type menu that supports empty arrays
- Logic to remove filter when values array is empty

**Example:**
```typescript
const handleTypeMenuApply = (filterType: string, values: string[]) => {
  if (values.length === 0) {
    // Remove filter
    setFilterState((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.field !== filterType),
    }));
  } else {
    // Add/replace filter
    const newFilter = createFilter({
      field: filterType as FilterField,
      operator: "is",
      value: values,
    });
    setFilterState((prev) => ({
      ...prev,
      filters: addOrReplaceFilter(prev.filters, newFilter),
    }));
  }
};
```

### 3. Filter Utils

**Ensure:**
- `addOrReplaceFilter` properly handles array values
- Multiple values for same field treated as OR logic
- Empty array removes the filter

## Testing Checklist

### Functional Tests
- [ ] Open menu, select multiple methods, close menu → Filters apply
- [ ] Open menu, uncheck all methods, close menu → Method filter removed
- [ ] Open menu, make changes, press ESC → Changes discarded
- [ ] Open menu, make changes, click outside → Filters apply
- [ ] Multiple filter types selected → All apply correctly
- [ ] Search within submenu → Results filter correctly
- [ ] Clear all in submenu → Selection cleared in temp state

### UX Tests
- [ ] Visual indicator appears when changes uncommitted
- [ ] No table flickering during selection
- [ ] Single URL update when menu closes
- [ ] Single API refetch when menu closes
- [ ] Menu stays open during multi-select
- [ ] Focus returns to trigger button on close

### Accessibility Tests
- [ ] Screen reader announces filter changes
- [ ] Keyboard navigation works (Tab, Arrow keys, Space, Enter)
- [ ] ESC key works consistently
- [ ] Focus management correct
- [ ] ARIA attributes correct

### Edge Cases
- [ ] Open menu, make no changes, close → No updates fired
- [ ] Rapid open/close cycles → No race conditions
- [ ] Navigate away while menu open → No memory leaks
- [ ] Browser back button → Menu closes, filters sync

## Migration Notes

This is a **non-breaking change**:
- Same component props
- Same parent integration
- Only internal behavior changes
- Visual design matches Figma more closely

## Future Enhancements

Potential improvements for later:
- **Undo/redo**: Keep filter history for quick rollback
- **Filter presets**: Save common filter combinations
- **Recent filters**: Quick access to recently used filters
- **Bulk operations**: "Select all", "Clear all", "Invert selection"
- **Filter descriptions**: Explain what each filter does
