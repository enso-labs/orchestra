# Implementation Tasks: Site Title Status Indicator

**Feature:** GitHub Issue #658
**Based on:** REVIEW.md Council Decisions
**Date:** 2026-01-13

---

## Pre-Implementation

- [ ] Verify development environment setup
- [ ] Review REVIEW.md council decisions

## Core Implementation

### Task 1: Create useDocumentTitle Hook
- [ ] Create `/frontend/src/hooks/useDocumentTitle.ts`
  - Files: `frontend/src/hooks/useDocumentTitle.ts`
  - Acceptance: Hook exports `useDocumentTitle` function and `TitleStatus` type
  - Details:
    - Define `TitleStatus = 'idle' | 'streaming' | 'done'`
    - Implement hook that consumes `loading` from `useAppContext()`
    - Use `useRef` to track previous loading state for transition detection
    - Implement 3000ms timeout for done->idle transition
    - Update `document.title` based on status:
      - idle: `Ruska AI`
      - streaming: `[Streaming...] Ruska AI`
      - done: `[Done] Ruska AI`
    - Return `{ status: TitleStatus }` for observability
    - Implement proper cleanup (restore title on unmount, clear timeouts)

### Task 2: Create Unit Tests
- [ ] Create `/frontend/src/hooks/useDocumentTitle.test.ts`
  - Files: `frontend/src/hooks/useDocumentTitle.test.ts`
  - Acceptance: All test cases pass with `npm run test`
  - Test cases required:
    - [ ] Initial idle state shows default title
    - [ ] Streaming state when loading=true
    - [ ] Done state when loading transitions true->false
    - [ ] Returns to idle after 3000ms timeout
    - [ ] Handles undefined/null loading gracefully
    - [ ] Restores default title on unmount
    - [ ] Clears timeout on unmount
    - [ ] Cancels done timeout when new stream starts
    - [ ] Handles rapid loading state changes

### Task 3: Integrate Hook in App.tsx
- [ ] Modify `/frontend/src/App.tsx`
  - Files: `frontend/src/App.tsx`
  - Acceptance: Hook is invoked at app level
  - Changes:
    - Add import: `import { useDocumentTitle } from "@/hooks/useDocumentTitle";`
    - Add hook invocation: `useDocumentTitle();`

## Testing

- [ ] Run unit tests: `npm run test`
- [ ] Verify all tests pass
- [ ] Run linting: `npm run lint`
- [ ] Run formatting: `npm run format`

## Manual Verification

- [ ] Start dev server: `npm run dev`
- [ ] Verify title shows "Ruska AI" on idle
- [ ] Submit a chat message and verify title shows "[Streaming...] Ruska AI"
- [ ] Wait for response and verify title shows "[Done] Ruska AI"
- [ ] Wait 3 seconds and verify title returns to "Ruska AI"

## Documentation

- [ ] Add inline comments for complex logic if needed
- [ ] Update CHANGELOG.md with feature entry

## Final Verification

- [ ] All tests passing
- [ ] No linting errors
- [ ] No type errors
- [ ] Code formatted with Prettier
- [ ] Changes committed
- [ ] Ready for PR

---

## Completion Signature

- **Total Tasks:** 18
- **Estimated Effort:** 2-4 hours
- **Dependencies:** None (uses existing AppContext loading state)
- **Risk Level:** Low

---

## Progress Log

- [x] Task 1: Create useDocumentTitle Hook - Completed 2026-01-13
  - Created `frontend/src/hooks/useDocumentTitle.ts` with full implementation
- [x] Task 2: Create Unit Tests - Completed 2026-01-13
  - Created `frontend/src/hooks/useDocumentTitle.test.ts` with 12 test cases
- [x] Task 3: Integrate Hook in App.tsx - Completed 2026-01-13
  - Added import and hook invocation
- [x] Testing: All 12 tests passing
- [x] Formatting: Code formatted with Prettier
- [x] Linting: No new errors (1 pre-existing warning in unrelated file)

---

## Validation Results

**Status:** PASS

**Test Results:**
- 12/12 tests passing
- All edge cases covered (undefined/null loading, rapid state changes, timeout cancellation)
- Cleanup properly tested (unmount, timeout clearing)

**Code Quality:**
- Follows codebase conventions
- No linting errors introduced
- TypeScript types properly defined
- Proper cleanup implemented

**Implementation Summary:**
- Hook: `frontend/src/hooks/useDocumentTitle.ts` (~75 LOC)
- Tests: `frontend/src/hooks/useDocumentTitle.test.ts` (~140 LOC)
- Integration: Single line in `frontend/src/App.tsx`

**Ready for PR:** YES

