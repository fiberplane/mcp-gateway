# Filter Component Implementation Plan

## 🎨 Design Reference
**Figma Design**: https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground?node-id=216-2812

This design shows the filter bar with:
- Search input on the left
- Active filter badges (Method, SessionID, etc.) with remove buttons
- "Add filter" dropdown button
- "Clear all" button
- "Sort" and "Export" buttons on the right
- Color-coded badges matching method types

---

## 📋 Overview
Build a unified filter system for the MCP Gateway web UI with comprehensive validation and agent reviews at each phase.

## 🎯 Goals
1. **Replace ClientFilter** with new filter system (first deliverable)
2. **Add global search** for finding specific tool calls (e.g., "echo")
3. **Add structured filters** for Method, SessionID, Sender, Receiver
4. **Client-side filtering** for Duration/Tokens (MVP - can migrate to backend later)
5. **URL persistence** for shareable filtered views
6. **Color-coded badges** matching existing design system (per Figma)
7. **Container queries** for responsive design (desktop-focused)

---

## 🏗️ Implementation Phases with Validation

### Phase 1: Foundation & Client Filter Replacement (Week 1)

#### 1.1 Create Type System ✅
**Files:**
- `packages/types/src/filters.ts` (merged, Zod schemas + inferred types)
- `packages/types/src/index.ts` (export new types)

**Validation:**
- [x] Run `bun run typecheck` - no errors
- [x] Zod schemas parse correctly (manual test)
- [x] Types exported properly from package

**Agent Review:**
- [x] Launch `typescript-pro` to review type system design (Grade: 9/10)
- [x] Verify discriminated unions and type narrowing

**Improvements Implemented:**
- Merged files into single `filters.ts`
- Zod schemas as source of truth with `z.infer`
- UUID validation on filter IDs
- `FilterInput<F>` uses `Omit` to exclude ID
- Added `createFilter()` factory function
- Added specific type guards (isClientFilter, etc.)
- Added utility types (FiltersForField, PartialFilterInput)

**Commit:** `cb7ffeb` - feat(filters): add type-safe filter system

#### 1.2 Create Filter Utilities
**Files:**
- `packages/web/src/lib/filter-utils.ts`

**Functions:**
- `parseFiltersFromUrl(params: URLSearchParams): Filter[]`
- `serializeFiltersToUrl(filters: Filter[], search?: string): URLSearchParams`
- `applyFiltersToLogs(logs: ApiLogEntry[], filters: Filter[], search?: string): ApiLogEntry[]`
- `matchesFilter(log: ApiLogEntry, filter: Filter): boolean`

**Validation:**
- [ ] Unit tests for URL serialization (round-trip)
- [ ] Unit tests for filter matching logic
- [ ] Edge cases: empty filters, malformed URLs
- [ ] Run `bun test`

**Agent Review:**
- [ ] Launch `test-automator` to create comprehensive test suite

#### 1.3 Create FilterBadge Component
**File:** `packages/web/src/components/filter-badge.tsx`

**Validation:**
- [ ] Visual inspection in browser
- [ ] Color variants match Figma design
- [ ] Remove button works
- [ ] Keyboard accessible (Tab to button, Enter to remove)
- [ ] Screen reader announces filter correctly

**Agent Review:**
- [ ] Launch `ui-ux-designer` for accessibility review
- [ ] Launch `frontend-developer` for component architecture review

#### 1.4 Create FilterBar Component (Basic)
**File:** `packages/web/src/components/filter-bar.tsx`

**Features (Phase 1):**
- Render active filter badges
- "Clear all" button
- Client filter dropdown (temporary - replaces ClientFilter)

**Validation:**
- [ ] Visual inspection matches Figma layout
- [ ] Filters persist to URL
- [ ] Browser back/forward works
- [ ] "Clear all" clears URL params
- [ ] Container queries work at different widths

**Agent Review:**
- [ ] Launch `frontend-developer` for integration review
- [ ] Launch `code-reviewer` for overall code quality

#### 1.5 Integrate into App.tsx
**Changes:**
- Remove `clientName` local state
- Remove `ClientFilter` component import
- Add `FilterBar` component
- Parse filters from URL
- Apply filters to logs

**Validation:**
- [ ] App loads without errors
- [ ] Client filtering works
- [ ] URL updates when filters change
- [ ] Existing features still work (ServerTabs, Export, etc.)
- [ ] No console errors/warnings
- [ ] Run `bun run typecheck` and `bun run lint`

**Agent Review:**
- [ ] Launch `code-reviewer` for final Sprint 1 review

---

### Phase 2: Search & Method Filtering (Week 1-2)

#### 2.1 Create SearchInput Component
**File:** `packages/web/src/components/search-input.tsx`

**Features:**
- Debounced input using `useDeferredValue`
- Search icon
- Clear button (X)
- Updates URL params

**Validation:**
- [ ] Search debounces correctly (300ms)
- [ ] Clear button clears search and URL
- [ ] Search persists to URL
- [ ] Keyboard accessible (Escape to clear)
- [ ] Screen reader announces search results

**Agent Review:**
- [ ] Launch `frontend-developer` for React 19 best practices
- [ ] Launch `ui-ux-designer` for UX review

#### 2.2 Create AddFilterDropdown Component
**File:** `packages/web/src/components/add-filter-dropdown.tsx`

**Features:**
- Radix Popover component
- Filter type selector (Method, SessionID, etc.)
- Operator selector (is, contains)
- Value input
- "Add" button

**Validation:**
- [ ] Popover opens/closes correctly
- [ ] Keyboard navigation works (Tab, Escape)
- [ ] Focus management correct
- [ ] Adds filter to URL
- [ ] Closes popover after adding
- [ ] ARIA labels present

**Agent Review:**
- [ ] Launch `ui-ux-designer` for accessibility audit
- [ ] Launch `frontend-developer` for Radix UI integration

#### 2.3 Update FilterBar with Search & Add Filter
**Validation:**
- [ ] Layout matches Figma design
- [ ] Search + filters work together
- [ ] No performance issues with filtering
- [ ] URL state synchronizes correctly

**Agent Review:**
- [ ] Launch `code-reviewer` for Sprint 2 review

---

### Phase 3: Complete Filter Set (Week 2)

#### 3.1 Replace SessionFilter
**Changes:**
- Remove `SessionFilter` component
- Add SessionID filter to AddFilterDropdown
- Support session autocomplete (use existing session query)

**Validation:**
- [ ] Session filtering works same as before
- [ ] No regressions in session display
- [ ] Session autocomplete shows suggestions

#### 3.2 Add Sender/Receiver/Duration/Tokens Filters
**Changes:**
- Add filter types to dropdown
- Implement client-side filtering logic
- Add operator support (gt, lt for numbers)

**Validation:**
- [ ] All filter types work correctly
- [ ] Number filters validate input
- [ ] Operators work as expected
- [ ] Performance acceptable with 1000s of logs
- [ ] Run `bun test` for filter logic

**Agent Review:**
- [ ] Launch `test-automator` for integration tests
- [ ] Launch `frontend-developer` for performance review

---

### Phase 4: Polish (Week 2-3)

#### 4.1 Container Queries
**Validation:**
- [ ] Layout adapts at breakpoints
- [ ] No horizontal scroll
- [ ] Text doesn't overflow

#### 4.2 Keyboard Navigation
**Validation:**
- [ ] Tab order logical
- [ ] All interactive elements keyboard accessible
- [ ] Keyboard shortcuts work (/, Escape, etc.)
- [ ] Focus visible
- [ ] No keyboard traps

**Agent Review:**
- [ ] Launch `ui-ux-designer` for accessibility audit

#### 4.3 Loading & Empty States
**Validation:**
- [ ] Loading spinner shows when filtering
- [ ] Empty state when no results
- [ ] Error states for invalid filters

#### 4.4 Final Review & Documentation
**Validation:**
- [ ] Run `bun run typecheck`
- [ ] Run `bun run lint`
- [ ] Run `bun run format`
- [ ] Run `bun test`
- [ ] Manual E2E testing
- [ ] Accessibility testing (keyboard + screen reader)
- [ ] Cross-browser testing
- [ ] Performance profiling

**Agent Review:**
- [ ] Launch `code-reviewer` for final code quality review
- [ ] Launch `test-automator` for test coverage review
- [ ] Launch `ui-ux-designer` for final UX audit

---

## 🤖 Agent Workflow

### When to Launch Agents

**After each component creation:**
```
1. Write component code
2. Launch frontend-developer agent for architecture review
3. Address feedback
4. Launch ui-ux-designer for accessibility review
5. Fix accessibility issues
```

**After phase completion:**
```
1. Complete all tasks in phase
2. Run validation checklist
3. Launch code-reviewer for comprehensive review
4. Launch test-automator if tests needed
5. Address all feedback before moving to next phase
```

**Recommended Agents:**
- `multi-platform-apps:frontend-developer` - React component architecture
- `multi-platform-apps:ui-ux-designer` - Accessibility & UX
- `javascript-typescript:typescript-pro` - Type system design
- `code-documentation:code-reviewer` - Code quality & best practices
- `unit-testing:test-automator` - Test creation & coverage

### Agent Review Checklist

**Frontend Developer:**
- [ ] Component composition optimal?
- [ ] State management correct?
- [ ] Performance considerations addressed?
- [ ] React 19 best practices followed?

**UI/UX Designer:**
- [ ] ARIA labels present?
- [ ] Keyboard navigation complete?
- [ ] Focus management correct?
- [ ] Screen reader friendly?
- [ ] Visual hierarchy clear?

**TypeScript Pro:**
- [ ] Type safety maximized?
- [ ] Type inference working?
- [ ] No `any` types?
- [ ] Discriminated unions used correctly?

**Code Reviewer:**
- [ ] Code quality high?
- [ ] No security issues?
- [ ] Edge cases handled?
- [ ] Error handling complete?

**Test Automator:**
- [ ] Test coverage adequate?
- [ ] Edge cases tested?
- [ ] Integration tests present?
- [ ] Accessible via testing library?

---

## 🎯 Success Criteria

- [ ] All filter types work (client, method, session, sender, receiver, duration, tokens)
- [ ] Global search functional
- [ ] URL persistence working
- [ ] All validation checks pass
- [ ] All agent reviews addressed
- [ ] Zero typecheck/lint errors
- [ ] Test coverage >80%
- [ ] Accessibility WCAG 2.1 AA compliant
- [ ] Performance <100ms filter application
- [ ] Figma design matched

## 📚 Documentation

Create/update:
- [x] `FILTER_IMPLEMENTATION.md` - This plan
- [ ] Component docstrings with Figma references
- [ ] README section on filtering
- [ ] Type documentation with examples

---

## 📝 Progress Tracking

Last updated: 2025-10-27

**Current Phase:** Phase 1 Complete ✅
**Status:** Production Ready - Accessibility Compliant

### Phase 1: Foundation & Client Filter Replacement ✅

#### 1.1 Create Type System ✅ (commit cb7ffeb)
- filters.ts with Zod schemas + inferred types
- TypeScript expert review (9/10)
- All validation passed
- Discriminated unions with type guards
- UUID validation on filter IDs

#### 1.2 Create Filter Utilities ✅ (commit 2c77fcf)
- filter-utils.ts with URL serialization and filtering
- All functions pure and testable
- Typecheck and lint passed
- Unit Tests ✅ (commits 1319a24, 5982e8c)
  - 74 comprehensive unit tests, all passing
  - Edge cases and critical issues addressed
  - Test-automator review (8.5/10)

#### 1.3 FilterBadge Component ✅ (commit 2011615, 2845b93)
- Displays active filters as removable badges
- Fully accessible with ARIA labels
- Color-coded badges (purple for method values)
- lucide-react icons (Monitor, Server, Zap, List, Clock, BarChart3)
- Accessibility improvements (commit 2845b93):
  - Removed incorrect role="status" usage
  - focus-visible for keyboard-only focus indicators
  - Proper ring offset (2px) for consistency

#### 1.4 FilterBar Component ✅ (commit 2011615, 2845b93)
- Client filter selector (temporary Phase 1 UI)
- Active filter badges display
- Clear all button
- URL state persistence (bidirectional sync)
- Browser back/forward navigation support
- Accessibility improvements (commit 2845b93):
  - Live region for screen reader announcements
  - Dev-only error logging (no production console.warn)
  - Graceful error handling with fallbacks

#### 1.5 App.tsx Integration ✅ (commit 2bb38e4, 2845b93)
- FilterBar integrated into main app
- Client-side filtering applied (applyFilterState)
- URL synchronization working
- Export uses filtered logs
- Error boundary wrapping (commit 2845b93):
  - Graceful degradation with user-friendly fallback
  - Dev-mode error details for debugging

#### 1.6 Agent Reviews & Accessibility ✅
- Frontend Developer review: 8.5/10 (production-ready)
- UI/UX Designer review: 8.5/10 (WCAG 2.1 AA compliant)
- All high priority issues addressed:
  - ✅ Live region for announcements
  - ✅ Error boundary for graceful errors
  - ✅ sr-only CSS utility for accessible hidden content
- All medium priority issues addressed:
  - ✅ Fixed role="status" usage
  - ✅ Standardized focus-visible styles
  - ✅ Dev-only console logging
- Deferred for future phases:
  - Focus management when removing filters (2 hours)
  - Toast notifications for filter changes (1 hour)

#### Phase 1 Validation Results ✅
- ✅ All 226 tests pass
- ✅ Typecheck clean (all packages)
- ✅ Lint clean
- ✅ WCAG 2.1 AA compliant
- ✅ URL persistence working
- ✅ Client filtering functional
- ✅ Export integration working
- ✅ Browser back/forward navigation working
- ✅ Screen reader accessible
- ✅ Keyboard navigation functional

### Next Phase
**Phase 2: Search & Method Filtering** - Ready to begin
