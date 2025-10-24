# Filter System Testing Strategy

## 📋 Table of Contents
1. [Test Strategy Overview](#test-strategy-overview)
2. [Testing Architecture](#testing-architecture)
3. [Phase-by-Phase Testing Plan](#phase-by-phase-testing-plan)
4. [Test Coverage Goals](#test-coverage-goals)
5. [Testability Guidelines](#testability-guidelines)
6. [Testing Anti-Patterns to Avoid](#testing-anti-patterns-to-avoid)
7. [Testing Tools & Setup](#testing-tools--setup)
8. [Specific Test Cases](#specific-test-cases)
9. [TDD Workflow](#tdd-workflow)

---

## 🎯 Test Strategy Overview

### Testing Philosophy
Follow **Test-Driven Development (TDD)** with a pragmatic approach:
- **Write tests first** for utility functions and business logic
- **Write tests during** component development for React components
- **Write tests after** for integration scenarios requiring real implementation

### Testing Pyramid
```
        /\
       /  \  E2E Tests (10%)
      /____\
     /      \  Integration Tests (20%)
    /________\
   /          \  Component Tests (30%)
  /____________\
 /              \  Unit Tests (40%)
/__________________\
```

### Test Types Distribution
- **Unit Tests (40%)**: Pure functions, utilities, type guards
- **Component Tests (30%)**: React component behavior, user interactions
- **Integration Tests (20%)**: Multi-component workflows, API integration
- **E2E Tests (10%)**: Critical user journeys, full stack scenarios

### Critical vs. Nice-to-Have
**Critical (Must Have):**
- ✅ Filter utility functions (parsing, serialization, matching)
- ✅ URL state management (round-trip serialization)
- ✅ Filter application logic (client-side filtering)
- ✅ Keyboard navigation and accessibility
- ✅ Filter badge removal and clearing
- ✅ Search debouncing and input handling

**Nice-to-Have (Optional):**
- 🔵 Visual regression testing
- 🔵 Performance benchmarking (filter application speed)
- 🔵 Cross-browser compatibility tests
- 🔵 Mobile responsiveness tests
- 🔵 Animation/transition testing

---

## 🏗️ Testing Architecture

### Test File Organization
```
packages/web/
├── src/
│   ├── lib/
│   │   ├── filter-utils.ts
│   │   └── filter-utils.test.ts          # ← Unit tests
│   ├── components/
│   │   ├── filter-badge.tsx
│   │   ├── filter-badge.test.tsx         # ← Component tests
│   │   ├── search-input.tsx
│   │   ├── search-input.test.tsx         # ← Component tests
│   │   ├── add-filter-dropdown.tsx
│   │   ├── add-filter-dropdown.test.tsx  # ← Component tests
│   │   ├── filter-bar.tsx
│   │   └── filter-bar.test.tsx           # ← Component + Integration tests
│   └── __tests__/
│       ├── integration/
│       │   ├── filter-workflows.test.tsx  # ← Integration tests
│       │   └── url-persistence.test.tsx   # ← Integration tests
│       └── e2e/
│           └── filter-user-journeys.test.tsx  # ← E2E tests
└── package.json
```

### Testing Tools Stack

**Current Tools:**
- ✅ **Bun Test**: Native test runner (already in use)
- ✅ **TypeScript**: Type safety in tests

**Recommended Additions:**
- 🟢 **@testing-library/react**: React component testing (already used in project)
- 🟢 **@testing-library/user-event**: Realistic user interactions
- 🟢 **@testing-library/jest-dom**: Extended matchers for DOM assertions
- 🟢 **@axe-core/react**: Automated accessibility testing
- 🟡 **MSW (Mock Service Worker)**: API mocking (if API integration needed)
- 🔵 **Playwright** or **Puppeteer**: E2E testing (optional, for critical paths)

**Why Not Jest?**
- Bun's test runner is faster and native to the project
- Compatible with most Jest APIs
- No additional configuration needed

---

## 📅 Phase-by-Phase Testing Plan

### Phase 1: Foundation & Client Filter Replacement

#### 1.1 Type System Testing
**File:** `packages/types/src/filter-schemas.test.ts`

**Test Scope:**
- ✅ Zod schema validation (success cases)
- ✅ Zod schema validation (failure cases)
- ✅ Type narrowing with discriminated unions
- ✅ Schema round-trip (parse → serialize → parse)

**Test Cases:**
```typescript
describe('FilterSchema', () => {
  test('parses valid method filter', () => {
    const input = { type: 'method', operator: 'is', value: 'tools/call' };
    expect(() => FilterSchema.parse(input)).not.toThrow();
  });

  test('rejects invalid filter type', () => {
    const input = { type: 'invalid', operator: 'is', value: 'test' };
    expect(() => FilterSchema.parse(input)).toThrow();
  });

  test('rejects invalid operator for method filter', () => {
    const input = { type: 'method', operator: 'contains', value: 'test' };
    expect(() => FilterSchema.parse(input)).toThrow();
  });
});
```

**Coverage Goal:** 100% (types are pure, no side effects)

**TDD Approach:**
1. Write failing test for valid filter schema
2. Implement minimal Zod schema
3. Write failing test for invalid input
4. Add validation rules
5. Refactor schema structure

---

#### 1.2 Filter Utilities Testing
**File:** `packages/web/src/lib/filter-utils.test.ts`

**Test Scope:**
- ✅ URL serialization (filters → URLSearchParams)
- ✅ URL parsing (URLSearchParams → filters)
- ✅ Round-trip serialization (filters → URL → filters)
- ✅ Filter matching logic (log matches filter)
- ✅ Client-side filtering (apply filters to log array)
- ✅ Edge cases (empty filters, malformed URLs, invalid data)

**Critical Test Cases:**
```typescript
describe('parseFiltersFromUrl', () => {
  test('parses single method filter from URL', () => {
    const params = new URLSearchParams('filter.method=tools/call');
    const filters = parseFiltersFromUrl(params);
    expect(filters).toEqual([
      { type: 'method', operator: 'is', value: 'tools/call' }
    ]);
  });

  test('parses multiple filters from URL', () => {
    const params = new URLSearchParams(
      'filter.method=tools/call&filter.session=sess-123'
    );
    const filters = parseFiltersFromUrl(params);
    expect(filters).toHaveLength(2);
  });

  test('handles malformed URL params gracefully', () => {
    const params = new URLSearchParams('filter.invalid=test');
    const filters = parseFiltersFromUrl(params);
    expect(filters).toEqual([]); // Skips invalid filters
  });

  test('handles URL encoded values correctly', () => {
    const params = new URLSearchParams('filter.search=hello%20world');
    const filters = parseFiltersFromUrl(params);
    expect(filters[0]?.value).toBe('hello world');
  });
});

describe('serializeFiltersToUrl', () => {
  test('serializes filters to URL params', () => {
    const filters: Filter[] = [
      { type: 'method', operator: 'is', value: 'tools/call' }
    ];
    const params = serializeFiltersToUrl(filters);
    expect(params.get('filter.method')).toBe('tools/call');
  });

  test('handles special characters in values', () => {
    const filters: Filter[] = [
      { type: 'search', operator: 'contains', value: 'hello world' }
    ];
    const params = serializeFiltersToUrl(filters);
    expect(params.get('filter.search')).toBe('hello world');
  });

  test('includes search parameter when provided', () => {
    const filters: Filter[] = [];
    const params = serializeFiltersToUrl(filters, 'test query');
    expect(params.get('search')).toBe('test query');
  });
});

describe('round-trip serialization', () => {
  test('filters survive URL round-trip', () => {
    const original: Filter[] = [
      { type: 'method', operator: 'is', value: 'tools/call' },
      { type: 'session', operator: 'is', value: 'sess-123' },
      { type: 'search', operator: 'contains', value: 'echo test' }
    ];

    const params = serializeFiltersToUrl(original);
    const parsed = parseFiltersFromUrl(params);

    expect(parsed).toEqual(original);
  });
});

describe('matchesFilter', () => {
  const mockLog: ApiLogEntry = {
    id: '1',
    timestamp: '2025-10-24T10:00:00Z',
    method: 'tools/call',
    params: { name: 'echo' },
    sessionId: 'sess-123',
    sender: 'client',
    receiver: 'server',
    duration: 150,
    totalTokens: 50,
    // ... other fields
  };

  test('matches method filter correctly', () => {
    const filter: Filter = { type: 'method', operator: 'is', value: 'tools/call' };
    expect(matchesFilter(mockLog, filter)).toBe(true);
  });

  test('does not match incorrect method', () => {
    const filter: Filter = { type: 'method', operator: 'is', value: 'tools/list' };
    expect(matchesFilter(mockLog, filter)).toBe(false);
  });

  test('matches search filter in tool name', () => {
    const filter: Filter = { type: 'search', operator: 'contains', value: 'echo' };
    expect(matchesFilter(mockLog, filter)).toBe(true);
  });

  test('search filter is case-insensitive', () => {
    const filter: Filter = { type: 'search', operator: 'contains', value: 'ECHO' };
    expect(matchesFilter(mockLog, filter)).toBe(true);
  });

  test('matches duration with gt operator', () => {
    const filter: Filter = { type: 'duration', operator: 'gt', value: 100 };
    expect(matchesFilter(mockLog, filter)).toBe(true);
  });

  test('matches duration with lt operator', () => {
    const filter: Filter = { type: 'duration', operator: 'lt', value: 200 };
    expect(matchesFilter(mockLog, filter)).toBe(true);
  });

  test('handles missing fields gracefully', () => {
    const incompleteLog = { ...mockLog, duration: undefined };
    const filter: Filter = { type: 'duration', operator: 'gt', value: 100 };
    expect(matchesFilter(incompleteLog, filter)).toBe(false);
  });
});

describe('applyFiltersToLogs', () => {
  const mockLogs: ApiLogEntry[] = [
    {
      id: '1',
      method: 'tools/call',
      params: { name: 'echo' },
      duration: 150,
      // ...
    },
    {
      id: '2',
      method: 'tools/list',
      params: {},
      duration: 50,
      // ...
    },
    {
      id: '3',
      method: 'tools/call',
      params: { name: 'search' },
      duration: 200,
      // ...
    }
  ];

  test('filters logs by method', () => {
    const filters: Filter[] = [
      { type: 'method', operator: 'is', value: 'tools/call' }
    ];
    const result = applyFiltersToLogs(mockLogs, filters);
    expect(result).toHaveLength(2);
    expect(result.every(log => log.method === 'tools/call')).toBe(true);
  });

  test('applies multiple filters (AND logic)', () => {
    const filters: Filter[] = [
      { type: 'method', operator: 'is', value: 'tools/call' },
      { type: 'duration', operator: 'gt', value: 100 }
    ];
    const result = applyFiltersToLogs(mockLogs, filters);
    expect(result).toHaveLength(2); // Both tools/call logs with duration > 100
  });

  test('applies search filter', () => {
    const result = applyFiltersToLogs(mockLogs, [], 'echo');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('1');
  });

  test('returns all logs when no filters applied', () => {
    const result = applyFiltersToLogs(mockLogs, []);
    expect(result).toEqual(mockLogs);
  });

  test('returns empty array when no matches', () => {
    const filters: Filter[] = [
      { type: 'method', operator: 'is', value: 'nonexistent/method' }
    ];
    const result = applyFiltersToLogs(mockLogs, filters);
    expect(result).toEqual([]);
  });

  test('handles empty input array', () => {
    const filters: Filter[] = [
      { type: 'method', operator: 'is', value: 'tools/call' }
    ];
    const result = applyFiltersToLogs([], filters);
    expect(result).toEqual([]);
  });
});
```

**Coverage Goal:** 95%+ (critical business logic)

**TDD Approach:**
1. Write failing tests for URL parsing
2. Implement minimal parsing logic
3. Write failing tests for edge cases
4. Add error handling and validation
5. Write failing tests for filter matching
6. Implement matching logic
7. Refactor for performance and clarity

**Edge Cases to Test:**
- Empty filter arrays
- Malformed URL parameters
- Missing log fields
- Special characters in search terms
- URL encoding/decoding
- Multiple filters of same type
- Invalid operator/value combinations
- Case sensitivity (search should be case-insensitive)
- Null/undefined values
- Very long filter lists (performance)

---

#### 1.3 FilterBadge Component Testing
**File:** `packages/web/src/components/filter-badge.test.tsx`

**Test Scope:**
- ✅ Renders filter badge with correct label
- ✅ Renders remove button
- ✅ Calls onRemove when button clicked
- ✅ Keyboard accessibility (Enter/Space on button)
- ✅ Color variants match filter type
- ✅ Screen reader announces filter correctly

**Critical Test Cases:**
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBadge } from './filter-badge';

describe('FilterBadge', () => {
  test('renders filter label', () => {
    const filter: Filter = { type: 'method', operator: 'is', value: 'tools/call' };
    render(<FilterBadge filter={filter} onRemove={() => {}} />);

    expect(screen.getByText(/method/i)).toBeInTheDocument();
    expect(screen.getByText(/tools\/call/i)).toBeInTheDocument();
  });

  test('calls onRemove when remove button clicked', async () => {
    const onRemove = vi.fn();
    const filter: Filter = { type: 'method', operator: 'is', value: 'tools/call' };

    render(<FilterBadge filter={filter} onRemove={onRemove} />);

    const removeButton = screen.getByRole('button', { name: /remove filter/i });
    await userEvent.click(removeButton);

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test('remove button is keyboard accessible', async () => {
    const onRemove = vi.fn();
    const filter: Filter = { type: 'method', operator: 'is', value: 'tools/call' };

    render(<FilterBadge filter={filter} onRemove={onRemove} />);

    const removeButton = screen.getByRole('button', { name: /remove filter/i });
    removeButton.focus();
    await userEvent.keyboard('{Enter}');

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test('applies correct color class for method filter', () => {
    const filter: Filter = { type: 'method', operator: 'is', value: 'tools/call' };
    const { container } = render(<FilterBadge filter={filter} onRemove={() => {}} />);

    const badge = container.querySelector('.badge');
    expect(badge).toHaveClass('badge-tools'); // Match Figma design
  });

  test('has correct ARIA labels', () => {
    const filter: Filter = { type: 'session', operator: 'is', value: 'sess-123' };
    render(<FilterBadge filter={filter} onRemove={() => {}} />);

    const removeButton = screen.getByRole('button', { name: /remove filter/i });
    expect(removeButton).toHaveAttribute('aria-label', expect.stringContaining('session'));
  });

  test('formats filter display correctly', () => {
    const filter: Filter = { type: 'duration', operator: 'gt', value: 100 };
    render(<FilterBadge filter={filter} onRemove={() => {}} />);

    expect(screen.getByText(/duration > 100ms/i)).toBeInTheDocument();
  });
});
```

**Coverage Goal:** 80%+ (UI component with visual elements)

**Accessibility Testing:**
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('has no accessibility violations', async () => {
  const filter: Filter = { type: 'method', operator: 'is', value: 'tools/call' };
  const { container } = render(<FilterBadge filter={filter} onRemove={() => {}} />);

  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

#### 1.4 FilterBar Component Testing (Basic)
**File:** `packages/web/src/components/filter-bar.test.tsx`

**Test Scope:**
- ✅ Renders active filter badges
- ✅ "Clear all" button functionality
- ✅ Client filter dropdown integration
- ✅ URL state synchronization
- ✅ Keyboard navigation (Tab order)

**Critical Test Cases:**
```typescript
describe('FilterBar', () => {
  test('renders active filter badges', () => {
    const filters: Filter[] = [
      { type: 'method', operator: 'is', value: 'tools/call' },
      { type: 'session', operator: 'is', value: 'sess-123' }
    ];

    render(<FilterBar filters={filters} onFiltersChange={() => {}} />);

    expect(screen.getAllByRole('button', { name: /remove filter/i })).toHaveLength(2);
  });

  test('clear all button removes all filters', async () => {
    const onFiltersChange = vi.fn();
    const filters: Filter[] = [
      { type: 'method', operator: 'is', value: 'tools/call' }
    ];

    render(<FilterBar filters={filters} onFiltersChange={onFiltersChange} />);

    const clearButton = screen.getByRole('button', { name: /clear all/i });
    await userEvent.click(clearButton);

    expect(onFiltersChange).toHaveBeenCalledWith([]);
  });

  test('clear all button is hidden when no filters', () => {
    render(<FilterBar filters={[]} onFiltersChange={() => {}} />);

    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
  });

  test('removing individual filter calls onFiltersChange', async () => {
    const onFiltersChange = vi.fn();
    const filters: Filter[] = [
      { type: 'method', operator: 'is', value: 'tools/call' },
      { type: 'session', operator: 'is', value: 'sess-123' }
    ];

    render(<FilterBar filters={filters} onFiltersChange={onFiltersChange} />);

    const removeButtons = screen.getAllByRole('button', { name: /remove filter/i });
    await userEvent.click(removeButtons[0]);

    expect(onFiltersChange).toHaveBeenCalledWith([filters[1]]);
  });

  test('has logical tab order', async () => {
    const filters: Filter[] = [
      { type: 'method', operator: 'is', value: 'tools/call' }
    ];

    render(<FilterBar filters={filters} onFiltersChange={() => {}} />);

    await userEvent.tab(); // Should focus first remove button
    expect(screen.getAllByRole('button')[0]).toHaveFocus();

    await userEvent.tab(); // Should focus clear all button
    expect(screen.getByRole('button', { name: /clear all/i })).toHaveFocus();
  });
});
```

**Coverage Goal:** 75%+ (UI component with multiple interactions)

---

#### 1.5 App Integration Testing
**File:** `packages/web/src/__tests__/integration/url-persistence.test.tsx`

**Test Scope:**
- ✅ Filters persist to URL
- ✅ Browser back/forward navigation works
- ✅ URL params parsed on initial load
- ✅ Deep linking works (direct URL with filters)

**Critical Test Cases:**
```typescript
describe('URL Persistence Integration', () => {
  test('filters are written to URL', async () => {
    // Mock window.history.pushState
    const pushStateSpy = vi.spyOn(window.history, 'pushState');

    render(<App />);

    // Add a filter via UI
    const addFilterButton = screen.getByRole('button', { name: /add filter/i });
    await userEvent.click(addFilterButton);
    // ... select method filter

    expect(pushStateSpy).toHaveBeenCalled();
    expect(window.location.search).toContain('filter.method=');
  });

  test('filters are read from URL on mount', () => {
    // Set initial URL
    window.history.pushState({}, '', '?filter.method=tools/call');

    render(<App />);

    // Verify filter badge is rendered
    expect(screen.getByText(/tools\/call/i)).toBeInTheDocument();
  });

  test('clearing filters updates URL', async () => {
    window.history.pushState({}, '', '?filter.method=tools/call');

    render(<App />);

    const clearButton = screen.getByRole('button', { name: /clear all/i });
    await userEvent.click(clearButton);

    expect(window.location.search).toBe('');
  });
});
```

**Coverage Goal:** 70%+ (integration tests focus on workflows)

---

### Phase 2: Search & Method Filtering

#### 2.1 SearchInput Component Testing
**File:** `packages/web/src/components/search-input.test.tsx`

**Test Scope:**
- ✅ Input debouncing works (300ms)
- ✅ Clear button functionality
- ✅ Keyboard shortcuts (Escape to clear)
- ✅ Updates URL params
- ✅ Screen reader announces search results

**Critical Test Cases:**
```typescript
describe('SearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('debounces search input', async () => {
    const onSearchChange = vi.fn();
    render(<SearchInput value="" onChange={onSearchChange} />);

    const input = screen.getByRole('searchbox');
    await userEvent.type(input, 'echo');

    // Should not call immediately
    expect(onSearchChange).not.toHaveBeenCalled();

    // Fast forward 300ms
    vi.advanceTimersByTime(300);

    expect(onSearchChange).toHaveBeenCalledWith('echo');
  });

  test('clear button clears input and calls onChange', async () => {
    const onSearchChange = vi.fn();
    render(<SearchInput value="test query" onChange={onSearchChange} />);

    const clearButton = screen.getByRole('button', { name: /clear search/i });
    await userEvent.click(clearButton);

    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  test('Escape key clears search', async () => {
    const onSearchChange = vi.fn();
    render(<SearchInput value="test query" onChange={onSearchChange} />);

    const input = screen.getByRole('searchbox');
    input.focus();
    await userEvent.keyboard('{Escape}');

    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  test('has correct ARIA attributes', () => {
    render(<SearchInput value="" onChange={() => {}} />);

    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('aria-label', expect.stringContaining('search'));
  });

  test('clear button only visible when input has value', () => {
    const { rerender } = render(<SearchInput value="" onChange={() => {}} />);

    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();

    rerender(<SearchInput value="test" onChange={() => {}} />);

    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });
});
```

**Coverage Goal:** 85%+ (critical input component)

---

#### 2.2 AddFilterDropdown Component Testing
**File:** `packages/web/src/components/add-filter-dropdown.test.tsx`

**Test Scope:**
- ✅ Popover opens/closes correctly
- ✅ Keyboard navigation (Tab, Escape)
- ✅ Focus management (returns focus on close)
- ✅ Adds filter and closes popover
- ✅ Validates input before adding
- ✅ ARIA labels and roles

**Critical Test Cases:**
```typescript
describe('AddFilterDropdown', () => {
  test('opens popover on button click', async () => {
    render(<AddFilterDropdown onAddFilter={() => {}} />);

    const button = screen.getByRole('button', { name: /add filter/i });
    await userEvent.click(button);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('closes popover on Escape key', async () => {
    render(<AddFilterDropdown onAddFilter={() => {}} />);

    const button = screen.getByRole('button', { name: /add filter/i });
    await userEvent.click(button);

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('adds filter and closes popover', async () => {
    const onAddFilter = vi.fn();
    render(<AddFilterDropdown onAddFilter={onAddFilter} />);

    // Open popover
    await userEvent.click(screen.getByRole('button', { name: /add filter/i }));

    // Select method filter
    await userEvent.click(screen.getByText(/method/i));

    // Select "tools/call"
    await userEvent.click(screen.getByText(/tools\/call/i));

    // Click add button
    await userEvent.click(screen.getByRole('button', { name: /add$/i }));

    expect(onAddFilter).toHaveBeenCalledWith({
      type: 'method',
      operator: 'is',
      value: 'tools/call'
    });

    // Popover should close
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('does not add filter with empty value', async () => {
    const onAddFilter = vi.fn();
    render(<AddFilterDropdown onAddFilter={onAddFilter} />);

    await userEvent.click(screen.getByRole('button', { name: /add filter/i }));
    await userEvent.click(screen.getByText(/session/i));

    const addButton = screen.getByRole('button', { name: /add$/i });
    expect(addButton).toBeDisabled();

    expect(onAddFilter).not.toHaveBeenCalled();
  });

  test('focus returns to trigger button after close', async () => {
    render(<AddFilterDropdown onAddFilter={() => {}} />);

    const triggerButton = screen.getByRole('button', { name: /add filter/i });
    await userEvent.click(triggerButton);

    await userEvent.keyboard('{Escape}');

    expect(triggerButton).toHaveFocus();
  });

  test('has correct ARIA attributes', async () => {
    render(<AddFilterDropdown onAddFilter={() => {}} />);

    const button = screen.getByRole('button', { name: /add filter/i });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');

    await userEvent.click(button);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label');
  });

  test('keyboard navigation works in dropdown', async () => {
    render(<AddFilterDropdown onAddFilter={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /add filter/i }));

    // Tab through options
    await userEvent.tab();
    expect(screen.getByText(/method/i)).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByText(/session/i)).toHaveFocus();
  });
});
```

**Coverage Goal:** 80%+ (complex interactive component)

---

### Phase 3: Complete Filter Set

#### 3.1 Session Autocomplete Testing
**File:** `packages/web/src/components/session-autocomplete.test.tsx`

**Test Scope:**
- ✅ Fetches and displays session suggestions
- ✅ Filters suggestions as user types
- ✅ Selects suggestion on click
- ✅ Keyboard navigation (Arrow keys, Enter)
- ✅ Loading state display

**Critical Test Cases:**
```typescript
describe('SessionAutocomplete', () => {
  test('fetches and displays session suggestions', async () => {
    // Mock API response
    const mockSessions = ['sess-123', 'sess-456', 'sess-789'];
    vi.mocked(useQuery).mockReturnValue({
      data: mockSessions,
      isLoading: false,
      error: null,
    });

    render(<SessionAutocomplete onSelect={() => {}} />);

    const input = screen.getByRole('combobox');
    await userEvent.click(input);

    for (const session of mockSessions) {
      expect(screen.getByText(session)).toBeInTheDocument();
    }
  });

  test('filters suggestions as user types', async () => {
    const mockSessions = ['sess-123', 'sess-456', 'other-789'];
    vi.mocked(useQuery).mockReturnValue({
      data: mockSessions,
      isLoading: false,
      error: null,
    });

    render(<SessionAutocomplete onSelect={() => {}} />);

    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'sess');

    expect(screen.getByText('sess-123')).toBeInTheDocument();
    expect(screen.getByText('sess-456')).toBeInTheDocument();
    expect(screen.queryByText('other-789')).not.toBeInTheDocument();
  });

  test('selects suggestion on Enter key', async () => {
    const onSelect = vi.fn();
    const mockSessions = ['sess-123', 'sess-456'];
    vi.mocked(useQuery).mockReturnValue({
      data: mockSessions,
      isLoading: false,
      error: null,
    });

    render(<SessionAutocomplete onSelect={onSelect} />);

    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'sess');
    await userEvent.keyboard('{ArrowDown}'); // Select first
    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('sess-123');
  });
});
```

**Coverage Goal:** 75%+ (data-driven component)

---

#### 3.2 Numeric Filter Operators Testing
**File:** `packages/web/src/lib/filter-utils.test.ts` (extended)

**Test Scope:**
- ✅ Greater than (gt) operator
- ✅ Less than (lt) operator
- ✅ Greater than or equal (gte) operator
- ✅ Less than or equal (lte) operator
- ✅ Invalid numeric values handled

**Critical Test Cases:**
```typescript
describe('numeric filter operators', () => {
  const mockLog: ApiLogEntry = {
    id: '1',
    duration: 150,
    totalTokens: 50,
    // ...
  };

  test.each([
    [100, 'gt', true],
    [150, 'gt', false],
    [200, 'gt', false],
    [200, 'lt', true],
    [150, 'lt', false],
    [100, 'lt', false],
    [150, 'gte', true],
    [100, 'gte', true],
    [200, 'gte', false],
    [150, 'lte', true],
    [200, 'lte', true],
    [100, 'lte', false],
  ])('duration %d %s returns %s', (value, operator, expected) => {
    const filter: Filter = {
      type: 'duration',
      operator: operator as Operator,
      value
    };
    expect(matchesFilter(mockLog, filter)).toBe(expected);
  });

  test('handles non-numeric duration values', () => {
    const logWithInvalidDuration = { ...mockLog, duration: 'invalid' as any };
    const filter: Filter = { type: 'duration', operator: 'gt', value: 100 };

    expect(matchesFilter(logWithInvalidDuration, filter)).toBe(false);
  });
});
```

**Coverage Goal:** 90%+ (pure logic functions)

---

### Phase 4: Polish

#### 4.1 Performance Testing
**File:** `packages/web/src/lib/filter-utils.perf.test.ts`

**Test Scope:**
- ✅ Filter application speed (<100ms for 1000 logs)
- ✅ Memory usage during filtering
- ✅ Search performance with large datasets

**Critical Test Cases:**
```typescript
describe('Filter Performance', () => {
  test('filters 1000 logs in <100ms', () => {
    const logs = generateMockLogs(1000);
    const filters: Filter[] = [
      { type: 'method', operator: 'is', value: 'tools/call' }
    ];

    const startTime = performance.now();
    const result = applyFiltersToLogs(logs, filters);
    const endTime = performance.now();

    const duration = endTime - startTime;
    expect(duration).toBeLessThan(100);
  });

  test('handles 10,000 logs without crashing', () => {
    const logs = generateMockLogs(10000);
    const filters: Filter[] = [
      { type: 'search', operator: 'contains', value: 'echo' }
    ];

    expect(() => {
      applyFiltersToLogs(logs, filters);
    }).not.toThrow();
  });
});
```

**Coverage Goal:** Not measured (performance benchmarks)

---

#### 4.2 Accessibility Audit
**File:** `packages/web/src/__tests__/integration/accessibility.test.tsx`

**Test Scope:**
- ✅ Keyboard navigation complete
- ✅ Focus management correct
- ✅ ARIA attributes present
- ✅ Screen reader friendly
- ✅ No accessibility violations (axe-core)

**Critical Test Cases:**
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

describe('Accessibility Audit', () => {
  test('FilterBar has no axe violations', async () => {
    const { container } = render(
      <FilterBar
        filters={[
          { type: 'method', operator: 'is', value: 'tools/call' }
        ]}
        onFiltersChange={() => {}}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('AddFilterDropdown has no axe violations', async () => {
    const { container } = render(<AddFilterDropdown onAddFilter={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /add filter/i }));

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('keyboard navigation covers all interactive elements', async () => {
    render(<App />);

    // Tab through all elements
    await userEvent.tab();
    expect(document.activeElement).toHaveAttribute('role', 'button');

    // Continue tabbing...
    // Verify tab order is logical
  });

  test('screen reader announces filter changes', async () => {
    render(<FilterBar filters={[]} onFiltersChange={() => {}} />);

    // Look for aria-live region
    const liveRegion = screen.getByRole('status', { hidden: true });
    expect(liveRegion).toBeInTheDocument();
  });
});
```

**Coverage Goal:** 100% (critical for accessibility compliance)

---

#### 4.3 E2E User Journey Testing
**File:** `packages/web/src/__tests__/e2e/filter-user-journeys.test.tsx`

**Test Scope:**
- ✅ Complete filter workflow (add → remove → clear)
- ✅ Search + filter combination
- ✅ Deep linking with filters
- ✅ Browser navigation (back/forward)

**Critical Test Cases:**
```typescript
describe('E2E Filter User Journeys', () => {
  test('user can add, remove, and clear filters', async () => {
    render(<App />);

    // Step 1: Add method filter
    await userEvent.click(screen.getByRole('button', { name: /add filter/i }));
    await userEvent.click(screen.getByText(/method/i));
    await userEvent.click(screen.getByText(/tools\/call/i));
    await userEvent.click(screen.getByRole('button', { name: /add$/i }));

    // Verify filter added
    expect(screen.getByText(/tools\/call/i)).toBeInTheDocument();

    // Step 2: Add session filter
    await userEvent.click(screen.getByRole('button', { name: /add filter/i }));
    await userEvent.click(screen.getByText(/session/i));
    await userEvent.type(screen.getByRole('combobox'), 'sess-123');
    await userEvent.click(screen.getByRole('button', { name: /add$/i }));

    // Verify both filters present
    expect(screen.getAllByRole('button', { name: /remove filter/i })).toHaveLength(2);

    // Step 3: Remove one filter
    const removeButtons = screen.getAllByRole('button', { name: /remove filter/i });
    await userEvent.click(removeButtons[0]);

    // Verify one filter removed
    expect(screen.getAllByRole('button', { name: /remove filter/i })).toHaveLength(1);

    // Step 4: Clear all
    await userEvent.click(screen.getByRole('button', { name: /clear all/i }));

    // Verify all filters cleared
    expect(screen.queryByRole('button', { name: /remove filter/i })).not.toBeInTheDocument();
  });

  test('user can search and filter simultaneously', async () => {
    render(<App />);

    // Add search query
    const searchInput = screen.getByRole('searchbox');
    await userEvent.type(searchInput, 'echo');

    vi.advanceTimersByTime(300); // Wait for debounce

    // Add method filter
    await userEvent.click(screen.getByRole('button', { name: /add filter/i }));
    await userEvent.click(screen.getByText(/method/i));
    await userEvent.click(screen.getByText(/tools\/call/i));
    await userEvent.click(screen.getByRole('button', { name: /add$/i }));

    // Verify both search and filter applied
    expect(window.location.search).toContain('search=echo');
    expect(window.location.search).toContain('filter.method=tools/call');
  });

  test('deep linking loads filters correctly', () => {
    window.history.pushState(
      {},
      '',
      '?search=echo&filter.method=tools/call&filter.session=sess-123'
    );

    render(<App />);

    // Verify search value
    expect(screen.getByRole('searchbox')).toHaveValue('echo');

    // Verify filter badges
    expect(screen.getByText(/tools\/call/i)).toBeInTheDocument();
    expect(screen.getByText(/sess-123/i)).toBeInTheDocument();
  });

  test('browser back button restores previous filters', async () => {
    render(<App />);

    // Add filter
    await userEvent.click(screen.getByRole('button', { name: /add filter/i }));
    await userEvent.click(screen.getByText(/method/i));
    await userEvent.click(screen.getByText(/tools\/call/i));
    await userEvent.click(screen.getByRole('button', { name: /add$/i }));

    // Clear filter
    await userEvent.click(screen.getByRole('button', { name: /clear all/i }));

    // Go back
    window.history.back();

    // Verify filter restored (need to re-render or listen to popstate)
    await waitFor(() => {
      expect(screen.getByText(/tools\/call/i)).toBeInTheDocument();
    });
  });
});
```

**Coverage Goal:** 60%+ (E2E tests are expensive, focus on critical paths)

---

## 📊 Test Coverage Goals

### Overall Coverage Targets
- **Minimum Acceptable:** 70% line coverage
- **Target:** 80% line coverage
- **Stretch Goal:** 90% line coverage

### Phase-Specific Coverage

| Phase | Package | Component/File | Coverage Goal |
|-------|---------|----------------|---------------|
| **Phase 1** | `types` | `filter-schemas.ts` | 100% |
| | `web` | `filter-utils.ts` | 95% |
| | `web` | `filter-badge.tsx` | 80% |
| | `web` | `filter-bar.tsx` | 75% |
| | `web` | URL persistence integration | 70% |
| **Phase 2** | `web` | `search-input.tsx` | 85% |
| | `web` | `add-filter-dropdown.tsx` | 80% |
| **Phase 3** | `web` | `session-autocomplete.tsx` | 75% |
| | `web` | Numeric operators | 90% |
| **Phase 4** | `web` | Accessibility audit | 100% |
| | `web` | E2E user journeys | 60% |

### Coverage Exclusions
Exclude from coverage calculations:
- Type-only files (`*.d.ts`)
- Test files (`*.test.ts`, `*.test.tsx`)
- Storybook stories (if added)
- Development-only utilities

---

## 🔧 Testability Guidelines

### 1. Pure Functions First
**Why:** Pure functions are easiest to test and reason about.

**Example:**
```typescript
// ✅ Good: Pure function
export function matchesFilter(log: ApiLogEntry, filter: Filter): boolean {
  // No side effects, deterministic
  return log.method === filter.value;
}

// ❌ Bad: Impure function
let lastFilterResult: boolean;
export function matchesFilter(log: ApiLogEntry, filter: Filter): boolean {
  lastFilterResult = log.method === filter.value; // Side effect
  return lastFilterResult;
}
```

### 2. Dependency Injection for React Components
**Why:** Makes components testable without complex mocking.

**Example:**
```typescript
// ✅ Good: Props for dependencies
interface FilterBarProps {
  filters: Filter[];
  onFiltersChange: (filters: Filter[]) => void;
  // Easy to mock in tests
}

// ❌ Bad: Internal dependencies
function FilterBar() {
  const filters = useFiltersFromUrl(); // Hard to mock
  const updateUrl = useUpdateUrl(); // Hard to mock
}
```

### 3. Separate Business Logic from UI
**Why:** Business logic should be testable without rendering components.

**Example:**
```typescript
// ✅ Good: Logic in utility
// filter-utils.ts
export function applyFiltersToLogs(logs, filters): ApiLogEntry[] {
  // Pure business logic
}

// filter-bar.tsx
function FilterBar({ filters, logs }) {
  const filteredLogs = applyFiltersToLogs(logs, filters); // Use utility
}

// ❌ Bad: Logic embedded in component
function FilterBar({ filters, logs }) {
  const filteredLogs = useMemo(() => {
    // Complex filtering logic here (hard to test)
  }, [filters, logs]);
}
```

### 4. Avoid Global State for Core Features
**Why:** Global state makes tests interdependent and flaky.

**Example:**
```typescript
// ✅ Good: State passed as props
function FilterBar({ filters }: { filters: Filter[] }) {
  // Component doesn't depend on global state
}

// ❌ Bad: Global state dependency
const globalFilters: Filter[] = [];
function FilterBar() {
  const filters = globalFilters; // Tests can't isolate this
}
```

### 5. Make Side Effects Explicit
**Why:** Side effects should be visible in function signatures.

**Example:**
```typescript
// ✅ Good: Side effect in name
function updateUrlWithFilters(filters: Filter[]): void {
  window.history.pushState(/* ... */);
}

// ❌ Bad: Hidden side effect
function serializeFilters(filters: Filter[]): URLSearchParams {
  window.history.pushState(/* ... */); // Unexpected!
  return params;
}
```

### 6. Use Custom Hooks for Complex State Logic
**Why:** Hooks can be tested independently with `@testing-library/react-hooks`.

**Example:**
```typescript
// ✅ Good: Custom hook
export function useFilterState() {
  const [filters, setFilters] = useState<Filter[]>([]);

  const addFilter = useCallback((filter: Filter) => {
    setFilters(prev => [...prev, filter]);
  }, []);

  const removeFilter = useCallback((index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  return { filters, addFilter, removeFilter };
}

// Can be tested without rendering component:
const { result } = renderHook(() => useFilterState());
```

### 7. Testable URL State Management
**Why:** URL state needs special handling in tests.

**Pattern:**
```typescript
// Create URL state utility with testable interface
export function useUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();

  return {
    filters: parseFiltersFromUrl(searchParams),
    updateFilters: (filters: Filter[]) => {
      setSearchParams(serializeFiltersToUrl(filters));
    }
  };
}

// In tests, mock useSearchParams:
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [
    new URLSearchParams('filter.method=tools/call'),
    vi.fn()
  ]
}));
```

### 8. Radix UI Component Testing
**Why:** Radix components need special consideration for accessibility.

**Pattern:**
```typescript
// Test Radix Dialog/Popover by role, not implementation
test('opens popover', async () => {
  render(<AddFilterDropdown onAddFilter={() => {}} />);

  // Use ARIA roles
  await userEvent.click(screen.getByRole('button', { name: /add filter/i }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

// Don't test Radix internals
test('❌ BAD: tests implementation details', () => {
  render(<AddFilterDropdown />);

  // Don't test Radix Portal class names
  expect(document.querySelector('.RadixPopover-content')).toBeInTheDocument();
});
```

### 9. Accessibility Testing Patterns
**Why:** Accessibility is critical and should be tested systematically.

**Pattern:**
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('component is accessible', async () => {
  const { container } = render(<FilterBadge {...props} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

// Also test keyboard navigation
test('keyboard navigation works', async () => {
  render(<FilterBar {...props} />);

  await userEvent.tab();
  expect(screen.getByRole('button', { name: /remove/i })).toHaveFocus();
});
```

### 10. Test Data Builders
**Why:** Reduce boilerplate and improve test readability.

**Pattern:**
```typescript
// test-utils/builders.ts
export function buildMockLog(overrides?: Partial<ApiLogEntry>): ApiLogEntry {
  return {
    id: '1',
    timestamp: '2025-10-24T10:00:00Z',
    method: 'tools/call',
    params: { name: 'echo' },
    sessionId: 'sess-123',
    sender: 'client',
    receiver: 'server',
    duration: 150,
    totalTokens: 50,
    ...overrides
  };
}

export function buildMockFilter(overrides?: Partial<Filter>): Filter {
  return {
    type: 'method',
    operator: 'is',
    value: 'tools/call',
    ...overrides
  };
}

// In tests:
const log = buildMockLog({ duration: 200 });
const filter = buildMockFilter({ type: 'session', value: 'sess-456' });
```

---

## ⚠️ Testing Anti-Patterns to Avoid

### 1. Testing Implementation Details
**❌ Bad:**
```typescript
test('state updates correctly', () => {
  const { result } = renderHook(() => useFilterState());

  // Testing internal state structure
  expect(result.current.internalState.filters).toEqual([]);
});
```

**✅ Good:**
```typescript
test('renders correct number of filter badges', () => {
  render(<FilterBar filters={[filter1, filter2]} />);

  // Testing user-visible behavior
  expect(screen.getAllByRole('button', { name: /remove filter/i })).toHaveLength(2);
});
```

### 2. Over-Mocking
**❌ Bad:**
```typescript
test('filters logs', () => {
  const mockMatchesFilter = vi.fn().mockReturnValue(true);
  vi.mock('./filter-utils', () => ({ matchesFilter: mockMatchesFilter }));

  // Test doesn't verify actual filtering logic
  applyFiltersToLogs(logs, filters);
  expect(mockMatchesFilter).toHaveBeenCalled();
});
```

**✅ Good:**
```typescript
test('filters logs by method', () => {
  const logs = [
    buildMockLog({ method: 'tools/call' }),
    buildMockLog({ method: 'tools/list' })
  ];
  const filters = [buildMockFilter({ type: 'method', value: 'tools/call' })];

  const result = applyFiltersToLogs(logs, filters);

  // Tests actual behavior
  expect(result).toHaveLength(1);
  expect(result[0].method).toBe('tools/call');
});
```

### 3. Testing Multiple Things at Once
**❌ Bad:**
```typescript
test('filter system works', async () => {
  render(<App />);

  // Too many concerns in one test
  await userEvent.click(screen.getByRole('button', { name: /add filter/i }));
  await userEvent.click(screen.getByText(/method/i));
  await userEvent.click(screen.getByText(/tools\/call/i));

  expect(window.location.search).toContain('filter.method=');
  expect(screen.getByText(/tools\/call/i)).toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(5);
});
```

**✅ Good:**
```typescript
test('adds filter badge when filter added', async () => {
  render(<FilterBar filters={[]} onFiltersChange={mockFn} />);

  await userEvent.click(screen.getByRole('button', { name: /add filter/i }));
  // ... add filter

  expect(screen.getByText(/tools\/call/i)).toBeInTheDocument();
});

test('updates URL when filter added', async () => {
  // Separate test for URL concern
});

test('filters logs based on added filter', () => {
  // Separate test for filtering logic
});
```

### 4. Flaky Tests Due to Timing
**❌ Bad:**
```typescript
test('search debounces', async () => {
  const onChange = vi.fn();
  render(<SearchInput value="" onChange={onChange} />);

  await userEvent.type(screen.getByRole('searchbox'), 'echo');

  // Arbitrary timeout - flaky!
  await new Promise(resolve => setTimeout(resolve, 350));

  expect(onChange).toHaveBeenCalled();
});
```

**✅ Good:**
```typescript
test('search debounces', async () => {
  vi.useFakeTimers();
  const onChange = vi.fn();
  render(<SearchInput value="" onChange={onChange} />);

  await userEvent.type(screen.getByRole('searchbox'), 'echo');

  expect(onChange).not.toHaveBeenCalled();

  vi.advanceTimersByTime(300);

  expect(onChange).toHaveBeenCalledWith('echo');

  vi.restoreAllMocks();
});
```

### 5. Testing External Libraries
**❌ Bad:**
```typescript
test('Radix Popover works', async () => {
  render(<AddFilterDropdown />);

  // Testing Radix's implementation
  expect(document.querySelector('[data-radix-popper-content-wrapper]')).toBeInTheDocument();
});
```

**✅ Good:**
```typescript
test('popover opens on button click', async () => {
  render(<AddFilterDropdown onAddFilter={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: /add filter/i }));

  // Test your component's behavior using standard APIs
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
```

### 6. Not Cleaning Up After Tests
**❌ Bad:**
```typescript
test('updates URL', () => {
  window.history.pushState({}, '', '?filter.method=tools/call');

  // ... test code

  // URL state leaks to next test!
});
```

**✅ Good:**
```typescript
afterEach(() => {
  // Clean up URL state
  window.history.replaceState({}, '', window.location.pathname);
});

test('updates URL', () => {
  window.history.pushState({}, '', '?filter.method=tools/call');
  // ... test code
});
```

### 7. Testing Too Much in Integration Tests
**❌ Bad:**
```typescript
test('complete app workflow', async () => {
  render(<App />);

  // 50 lines of interactions testing every feature
  // This should be multiple focused tests
});
```

**✅ Good:**
```typescript
// Multiple focused integration tests
test('user can add filter and see filtered results', async () => {
  // Focus on one workflow
});

test('user can search and filter simultaneously', async () => {
  // Focus on another specific workflow
});
```

### 8. Snapshot Testing UI Components
**❌ Bad:**
```typescript
test('FilterBadge renders correctly', () => {
  const { container } = render(<FilterBadge filter={mockFilter} />);

  // Brittle, doesn't test behavior
  expect(container).toMatchSnapshot();
});
```

**✅ Good:**
```typescript
test('FilterBadge displays filter label', () => {
  render(<FilterBadge filter={mockFilter} onRemove={() => {}} />);

  // Tests actual behavior and content
  expect(screen.getByText(/method/i)).toBeInTheDocument();
  expect(screen.getByText(/tools\/call/i)).toBeInTheDocument();
});
```

---

## 🛠️ Testing Tools & Setup

### Required Dependencies

Add to `packages/web/package.json`:

```json
{
  "devDependencies": {
    "@testing-library/react": "^16.2.0",
    "@testing-library/user-event": "^14.5.2",
    "@testing-library/jest-dom": "^6.6.3",
    "@axe-core/react": "^4.10.2",
    "jest-axe": "^9.0.0"
  }
}
```

### Test Setup File

**File:** `packages/web/src/test-setup.ts`

```typescript
import { expect, afterEach } from 'bun:test';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

// Extend expect with jest-dom and axe matchers
expect.extend(toHaveNoViolations);

// Cleanup after each test
afterEach(() => {
  cleanup();

  // Clean up URL state
  window.history.replaceState({}, '', window.location.pathname);

  // Clear all timers
  vi.clearAllTimers();
});

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// Mock IntersectionObserver for lazy loading tests
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;
```

### Test Utilities

**File:** `packages/web/src/test-utils/index.tsx`

```typescript
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a custom render that includes providers
function render(ui: React.ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...options });
}

// Re-export everything
export * from '@testing-library/react';
export { render };
```

**File:** `packages/web/src/test-utils/builders.ts`

```typescript
import type { ApiLogEntry, Filter } from '@fiberplane/mcp-gateway-types';

export function buildMockLog(overrides?: Partial<ApiLogEntry>): ApiLogEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    method: 'tools/call',
    params: { name: 'echo', arguments: { text: 'hello' } },
    sessionId: 'sess-123',
    sender: 'client',
    receiver: 'server',
    duration: 150,
    totalTokens: 50,
    promptTokens: 30,
    completionTokens: 20,
    serverName: 'test-server',
    ...overrides,
  };
}

export function buildMockFilter(overrides?: Partial<Filter>): Filter {
  return {
    type: 'method',
    operator: 'is',
    value: 'tools/call',
    ...overrides,
  };
}

export function buildMockLogs(count: number, overrides?: Partial<ApiLogEntry>): ApiLogEntry[] {
  return Array.from({ length: count }, (_, i) =>
    buildMockLog({ id: `log-${i}`, ...overrides })
  );
}
```

### Configure Bun Test

**File:** `packages/web/bunfig.toml`

```toml
[test]
# Setup file to run before tests
preload = ["./src/test-setup.ts"]

# Coverage settings
coverage = true
coverageThreshold = 70
coverageSkipTestFiles = true

# Test environment
# Note: Bun doesn't have jsdom environment yet
# You may need to mock DOM APIs manually
```

### Running Tests

**Update `packages/web/package.json`:**

```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage",
    "test:ui": "bun test --coverage --watch"
  }
}
```

---

## 📝 Specific Test Cases

### URL Serialization Edge Cases

```typescript
describe('URL serialization edge cases', () => {
  test('handles URL with existing query params', () => {
    const params = new URLSearchParams('existing=value&filter.method=tools/call');
    const filters = parseFiltersFromUrl(params);

    expect(filters).toHaveLength(1);
    expect(params.get('existing')).toBe('value'); // Preserves existing params
  });

  test('handles special characters in filter values', () => {
    const filters: Filter[] = [
      { type: 'search', operator: 'contains', value: 'test?with=special&chars' }
    ];
    const params = serializeFiltersToUrl(filters);

    // Should properly encode
    expect(params.toString()).toContain('test%3Fwith%3Dspecial%26chars');
  });

  test('handles Unicode characters in search', () => {
    const filters: Filter[] = [
      { type: 'search', operator: 'contains', value: '你好世界' }
    ];
    const params = serializeFiltersToUrl(filters);
    const parsed = parseFiltersFromUrl(params);

    expect(parsed[0]?.value).toBe('你好世界');
  });

  test('handles very long filter values', () => {
    const longValue = 'a'.repeat(10000);
    const filters: Filter[] = [
      { type: 'search', operator: 'contains', value: longValue }
    ];
    const params = serializeFiltersToUrl(filters);
    const parsed = parseFiltersFromUrl(params);

    expect(parsed[0]?.value).toBe(longValue);
  });

  test('handles multiple filters of same type', () => {
    // This is an edge case - should we support it?
    const params = new URLSearchParams();
    params.append('filter.method', 'tools/call');
    params.append('filter.method', 'tools/list');

    const filters = parseFiltersFromUrl(params);

    // Define expected behavior: take first, take last, or array?
    expect(filters).toHaveLength(1); // Taking first
  });

  test('handles empty filter values', () => {
    const params = new URLSearchParams('filter.search=');
    const filters = parseFiltersFromUrl(params);

    // Should skip empty values
    expect(filters).toEqual([]);
  });

  test('handles malformed filter keys', () => {
    const params = new URLSearchParams('filter=value&filter.=empty');
    const filters = parseFiltersFromUrl(params);

    // Should skip malformed keys
    expect(filters).toEqual([]);
  });
});
```

### Invalid Filter Handling

```typescript
describe('invalid filter handling', () => {
  test('rejects filter with missing type', () => {
    const invalidFilter = { operator: 'is', value: 'test' } as any;

    expect(() => FilterSchema.parse(invalidFilter)).toThrow();
  });

  test('rejects filter with invalid operator for type', () => {
    // Method filter doesn't support 'contains'
    const invalidFilter = { type: 'method', operator: 'contains', value: 'test' };

    expect(() => FilterSchema.parse(invalidFilter)).toThrow();
  });

  test('rejects numeric filter with string value', () => {
    const invalidFilter = { type: 'duration', operator: 'gt', value: 'not-a-number' };

    expect(() => FilterSchema.parse(invalidFilter)).toThrow();
  });

  test('gracefully handles undefined log fields', () => {
    const log = buildMockLog({ duration: undefined });
    const filter: Filter = { type: 'duration', operator: 'gt', value: 100 };

    expect(matchesFilter(log, filter)).toBe(false);
  });

  test('gracefully handles null log fields', () => {
    const log = buildMockLog({ sessionId: null as any });
    const filter: Filter = { type: 'session', operator: 'is', value: 'sess-123' };

    expect(matchesFilter(log, filter)).toBe(false);
  });
});
```

### Client-Side Filtering Edge Cases

```typescript
describe('client-side filtering edge cases', () => {
  test('handles empty log array', () => {
    const filters: Filter[] = [buildMockFilter()];
    const result = applyFiltersToLogs([], filters);

    expect(result).toEqual([]);
  });

  test('handles empty filter array', () => {
    const logs = [buildMockLog(), buildMockLog()];
    const result = applyFiltersToLogs(logs, []);

    expect(result).toEqual(logs);
  });

  test('filters maintain original order', () => {
    const logs = [
      buildMockLog({ id: '1', method: 'tools/call' }),
      buildMockLog({ id: '2', method: 'tools/list' }),
      buildMockLog({ id: '3', method: 'tools/call' }),
    ];
    const filters: Filter[] = [
      { type: 'method', operator: 'is', value: 'tools/call' }
    ];

    const result = applyFiltersToLogs(logs, filters);

    expect(result.map(l => l.id)).toEqual(['1', '3']);
  });

  test('AND logic for multiple filters', () => {
    const logs = [
      buildMockLog({ method: 'tools/call', duration: 100 }),
      buildMockLog({ method: 'tools/call', duration: 200 }),
      buildMockLog({ method: 'tools/list', duration: 200 }),
    ];
    const filters: Filter[] = [
      { type: 'method', operator: 'is', value: 'tools/call' },
      { type: 'duration', operator: 'gt', value: 150 }
    ];

    const result = applyFiltersToLogs(logs, filters);

    expect(result).toHaveLength(1);
    expect(result[0].duration).toBe(200);
  });

  test('case-insensitive search', () => {
    const logs = [
      buildMockLog({ params: { name: 'Echo' } }),
      buildMockLog({ params: { name: 'ECHO' } }),
      buildMockLog({ params: { name: 'search' } }),
    ];

    const result = applyFiltersToLogs(logs, [], 'echo');

    expect(result).toHaveLength(2);
  });

  test('search matches multiple fields', () => {
    const logs = [
      buildMockLog({ method: 'tools/call', params: { name: 'test' } }),
      buildMockLog({ method: 'tools/test', params: { name: 'other' } }),
      buildMockLog({ method: 'tools/call', params: { name: 'test-tool' } }),
    ];

    const result = applyFiltersToLogs(logs, [], 'test');

    // Should match method and params.name
    expect(result).toHaveLength(3);
  });

  test('handles large dataset efficiently', () => {
    const logs = buildMockLogs(10000);
    const filters: Filter[] = [
      { type: 'method', operator: 'is', value: 'tools/call' }
    ];

    const startTime = performance.now();
    const result = applyFiltersToLogs(logs, filters);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(100); // <100ms
  });
});
```

---

## 🔄 TDD Workflow

### Red-Green-Refactor Cycle

```bash
# 1. RED: Write a failing test
bun test filter-utils.test.ts

# 2. GREEN: Write minimal code to pass
# (implement feature)

# 3. REFACTOR: Clean up code
# (improve implementation)

# 4. Verify: Run all tests
bun test

# 5. Type check
bun run typecheck

# 6. Lint and format
bun run lint && bun run format
```

### TDD Example: parseFiltersFromUrl

**Step 1: RED (Write failing test)**

```typescript
// filter-utils.test.ts
import { describe, test, expect } from 'bun:test';
import { parseFiltersFromUrl } from './filter-utils';

describe('parseFiltersFromUrl', () => {
  test('parses single method filter from URL', () => {
    const params = new URLSearchParams('filter.method=tools/call');
    const filters = parseFiltersFromUrl(params);

    expect(filters).toEqual([
      { type: 'method', operator: 'is', value: 'tools/call' }
    ]);
  });
});

// Run test: bun test filter-utils.test.ts
// Expected: FAIL (function doesn't exist)
```

**Step 2: GREEN (Minimal implementation)**

```typescript
// filter-utils.ts
import type { Filter } from '@fiberplane/mcp-gateway-types';

export function parseFiltersFromUrl(params: URLSearchParams): Filter[] {
  const methodValue = params.get('filter.method');

  if (methodValue) {
    return [{ type: 'method', operator: 'is', value: methodValue }];
  }

  return [];
}

// Run test: bun test filter-utils.test.ts
// Expected: PASS
```

**Step 3: REFACTOR (Improve implementation)**

Add more filter types:

```typescript
export function parseFiltersFromUrl(params: URLSearchParams): Filter[] {
  const filters: Filter[] = [];

  // Parse method filter
  const methodValue = params.get('filter.method');
  if (methodValue) {
    filters.push({ type: 'method', operator: 'is', value: methodValue });
  }

  // Parse session filter
  const sessionValue = params.get('filter.session');
  if (sessionValue) {
    filters.push({ type: 'session', operator: 'is', value: sessionValue });
  }

  // More filter types...

  return filters;
}

// Run test: bun test
// Expected: PASS (existing test still passes)
```

**Step 4: Add more tests (Continue cycle)**

```typescript
test('parses multiple filters from URL', () => {
  const params = new URLSearchParams(
    'filter.method=tools/call&filter.session=sess-123'
  );
  const filters = parseFiltersFromUrl(params);

  expect(filters).toHaveLength(2);
  expect(filters).toEqual([
    { type: 'method', operator: 'is', value: 'tools/call' },
    { type: 'session', operator: 'is', value: 'sess-123' }
  ]);
});

// Run test: bun test
// Expected: PASS (implementation already supports this)
```

---

## ✅ Test Validation Checklist

Use this checklist before committing tests:

### Before Writing Tests
- [ ] Read the implementation plan and understand requirements
- [ ] Identify testable units (functions, components, workflows)
- [ ] Determine test type (unit, component, integration, E2E)
- [ ] Create test data builders if needed

### While Writing Tests
- [ ] Follow TDD cycle (Red → Green → Refactor)
- [ ] Test behavior, not implementation
- [ ] Use descriptive test names
- [ ] Test happy path first, then edge cases
- [ ] Avoid over-mocking
- [ ] Clean up after tests (afterEach hooks)

### After Writing Tests
- [ ] All tests pass: `bun test`
- [ ] Types check: `bun run typecheck`
- [ ] Linting passes: `bun run lint`
- [ ] Coverage meets goals: `bun test --coverage`
- [ ] Accessibility tests pass (if applicable)
- [ ] No flaky tests (run multiple times)
- [ ] Test runs in CI environment

### Before Code Review
- [ ] Remove commented-out tests
- [ ] Remove `.only` and `.skip` from tests
- [ ] Add test documentation (if complex)
- [ ] Verify all phase validation checks pass
- [ ] Update FILTER_IMPLEMENTATION.md with completed tests

---

## 📈 Testing Metrics to Track

### Coverage Metrics
- Line coverage: 80%+
- Branch coverage: 75%+
- Function coverage: 85%+

### Performance Metrics
- Filter application: <100ms for 1000 logs
- Search debounce: 300ms ± 50ms
- Test suite execution: <30s total

### Quality Metrics
- Zero accessibility violations (axe-core)
- Zero flaky tests (3 consecutive runs)
- Zero console warnings in tests

### TDD Metrics
- Test-first ratio: 80%+ (tests written before implementation)
- Red-Green cycle time: <5 minutes per cycle
- Refactoring frequency: After every 3-5 features

---

## 🎓 Testing Resources

### Documentation
- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about)
- [Radix UI Testing Guide](https://www.radix-ui.com/primitives/docs/guides/testing)
- [Axe Accessibility Testing](https://github.com/dequelabs/axe-core)

### Examples in Codebase
- `packages/core/src/health.test.ts` - Unit testing patterns
- `packages/api/src/routes/servers.test.ts` - API testing patterns
- `packages/cli/tests/proxy/proxy.test.ts` - Integration testing patterns

---

**Last Updated:** 2025-10-24
**Version:** 1.0
**Status:** Ready for Implementation
