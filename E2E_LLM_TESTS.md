# E2E Test Checklist (LLM-Executable via Chrome MCP)

**Figma Reference**: https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground?node-id=216-2812

## 🧪 How to Use This Document

**For LLMs with Chrome MCP:**
1. Start dev server: `bun run --filter @fiberplane/mcp-gateway-web dev`
2. Navigate to http://localhost:5173 (or appropriate dev URL)
3. Execute test by following "Actions" → verify "Expected" outcomes
4. Mark ✅ PASS or ❌ FAIL with notes

**For Humans:**
Follow same tests manually in browser.

---

## Phase 1: Foundation Tests

### 1.1 Client Filter - Add & Remove
- **Actions**: Add filter button → Client → is → "claude-code" → Add → Click X on badge
- **Expected**: Badge appears/disappears, URL updates/clears, table filters correctly
- **Status**: [ ]

### 1.2 URL Persistence
- **Actions**: Add client filter → Refresh page
- **Expected**: Filter persists, badge shows, table still filtered
- **Status**: [ ]

### 1.3 Browser Navigation
- **Actions**: Add filter → Navigate away → Browser back button
- **Expected**: Filter state restored from URL
- **Status**: [ ]

### 1.4 Multiple Filters
- **Actions**: Add client filter → Add method filter
- **Expected**: Both badges show, URL has both params, table filtered by both
- **Status**: [ ]

### 1.5 Clear All
- **Actions**: Add 2+ filters → Click "Clear all"
- **Expected**: All badges removed, URL cleared, table shows all logs
- **Status**: [ ]

### 1.6 Direct URL Entry
- **Actions**: Navigate to `/?client=claude-code` directly
- **Expected**: Filter badge appears automatically, table filtered
- **Status**: [ ]

### 1.7 Visual Design Match
- **Actions**: Take screenshot of FilterBar with badges
- **Expected**: Layout matches Figma, badge colors correct, spacing proper
- **Status**: [ ]

### 1.8 Keyboard Navigation
- **Actions**: Tab through: Add filter → badges → X buttons → Clear all
- **Expected**: Logical tab order, focus visible, Enter/Space work
- **Status**: [ ]

---

## Phase 2: Search & Method Tests

### 2.1 Search Debouncing
- **Actions**: Type "echo" in search → Wait 300ms
- **Expected**: URL updates after debounce, table filters to matching logs
- **Status**: [ ]

### 2.2 Search + Filters Combined
- **Actions**: Search "echo" + add client filter
- **Expected**: Both applied, URL has `?q=echo&client=...`, table shows intersection
- **Status**: [ ]

### 2.3 Clear Search
- **Actions**: Type search → Click X button
- **Expected**: Search cleared, URL param removed, table unfiltered
- **Status**: [ ]

### 2.4 Method Filter
- **Actions**: Add filter → Method → is → "tools/call"
- **Expected**: Badge color purple (info), table filters to tools/call only
- **Status**: [ ]

### 2.5 Add Filter Dropdown - Keyboard
- **Actions**: Tab to "Add filter" → Enter → Arrow keys → Enter to select
- **Expected**: Dropdown opens, keyboard nav works, selection applies
- **Status**: [ ]

### 2.6 Escape to Close
- **Actions**: Open Add filter dropdown → Press Escape
- **Expected**: Dropdown closes, focus returns to button
- **Status**: [ ]

---

## Phase 3: Complete Filter Set Tests

### 3.1 Session Filter
- **Actions**: Add filter → SessionID → is → [select from autocomplete]
- **Expected**: Autocomplete shows sessions, selection filters table
- **Status**: [ ]

### 3.2 Sender Filter (Client-side)
- **Actions**: Add filter → Sender → is → "everything-server"
- **Expected**: Client-side filtering works, table shows matching logs
- **Status**: [ ]

### 3.3 Duration Filter - Greater Than
- **Actions**: Add filter → Duration → greater than → "100"
- **Expected**: Only logs >100ms shown
- **Status**: [ ]

### 3.4 Duration Filter - Less Than
- **Actions**: Add filter → Duration → less than → "50"
- **Expected**: Only logs <50ms shown
- **Status**: [ ]

### 3.5 Complex Multi-Filter
- **Actions**: Add client + method + duration filters
- **Expected**: All filters apply (intersection), performance acceptable
- **Status**: [ ]

---

## Phase 4: Polish Tests

### 4.1 Container Queries
- **Actions**: Resize window from wide to narrow
- **Expected**: Layout adapts, no overflow, no horizontal scroll
- **Status**: [ ]

### 4.2 Keyboard Shortcut - Search Focus
- **Actions**: Press `/` key
- **Expected**: Search input focused
- **Status**: [ ]

### 4.3 Keyboard Shortcut - Escape
- **Actions**: Focus search → Press Escape
- **Expected**: Search cleared and blur focus
- **Status**: [ ]

### 4.4 Loading State
- **Actions**: Add filter with large dataset
- **Expected**: Loading indicator shows briefly, no UI freeze
- **Status**: [ ]

### 4.5 Empty State
- **Actions**: Add filter that matches no logs
- **Expected**: "No logs found" message shown
- **Status**: [ ]

### 4.6 Invalid Filter Handling
- **Actions**: Add duration filter with non-numeric value
- **Expected**: Validation error shown, filter not added
- **Status**: [ ]

---

## Accessibility Tests

### A.1 ARIA Labels
- **Actions**: Take snapshot → Check for aria-label on buttons/inputs
- **Expected**: All interactive elements have labels
- **Status**: [ ]

### A.2 Focus Indicators
- **Actions**: Tab through all interactive elements
- **Expected**: Visible focus ring on all elements
- **Status**: [ ]

### A.3 No Keyboard Traps
- **Actions**: Tab through entire UI → Shift+Tab backwards
- **Expected**: Can reach all elements, can exit all modals
- **Status**: [ ]

---

## Visual Validation

### V.1 Badge Colors Match Design
- **Reference**: Figma colors
- **Check**:
  - tools/* → Purple ✅❌
  - resources/* → Yellow ✅❌
  - initialize → Green ✅❌
  - notifications/* → Yellow ✅❌
- **Status**: [ ]

### V.2 Layout Spacing
- **Reference**: Figma layout
- **Check**: Gap between badges, padding, button sizes
- **Status**: [ ]

### V.3 Typography
- **Check**: Font sizes, weights match design
- **Status**: [ ]

---

## Performance Tests

### P.1 Filter 100 Logs
- **Actions**: Load 100 logs → Add filter
- **Expected**: <100ms filter application
- **Status**: [ ]

### P.2 Filter 1000 Logs
- **Actions**: Load 1000 logs → Add filter
- **Expected**: <200ms filter application, no UI freeze
- **Status**: [ ]

---

## Test Results Summary

**Phase 1**: 0/8 ✅
**Phase 2**: 0/6 ✅
**Phase 3**: 0/5 ✅
**Phase 4**: 0/6 ✅
**Accessibility**: 0/3 ✅
**Visual**: 0/3 ✅
**Performance**: 0/2 ✅

**Total**: 0/33 ✅

**Issues Found**: None yet

**Last Updated**: 2025-10-24
