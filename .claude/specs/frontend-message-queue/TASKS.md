# Implementation Tasks: Frontend Message Queue

## Pre-Implementation
- [x] Verify development environment setup
  - Files: `frontend/package.json`
  - Acceptance: `npm install` succeeds, `npm run dev` starts dev server
- [x] Create feature branch: `feat/504-frontend-queue` (already exists per git status)
  - Acceptance: Working on correct branch
- [x] Review REVIEW.md council decisions
  - Files: `.claude/specs/frontend-message-queue/REVIEW.md`
  - Acceptance: Understand unified implementation plan

## Core Implementation

### Task 1: Create Type Definitions
- [x] Create queue type definitions file
  - Files: `frontend/src/lib/entities/queue.ts`
  - Create: `QueuedMessage`, `UseMessageQueueConfig`, `UseMessageQueueReturn` interfaces
  - Acceptance: TypeScript compiles without errors

### Task 2: Export Queue Types
- [x] Update entities index to export queue types
  - Files: `frontend/src/lib/entities/index.ts`
  - Add: `export * from "./queue";`
  - Acceptance: Types importable from `@/lib/entities`

### Task 3: Implement useMessageQueue Hook
- [x] Create useMessageQueue hook with ref-based queue
  - Files: `frontend/src/hooks/useMessageQueue.ts`
  - Implement:
    - `queueRef` for queue array (no re-renders)
    - `queueLength` state for UI
    - `isProcessing` state for loading indicator
    - `enqueue(query, images)` function
    - `dequeue(id)` function
    - `clearQueue()` function
    - `processNext()` internal function
    - Auto-process effect watching `isStreaming`
  - Pattern: Follow OPTIMIZER's hybrid ref+state pattern
  - Acceptance: Hook can be imported and instantiated

### Task 4: Integrate Queue Hook into ChatContext
- [x] Wire up useMessageQueue in ChatContext provider
  - Files: `frontend/src/context/ChatContext.tsx`
  - Changes:
    - Import useMessageQueue
    - Instantiate with `{ isStreaming: !!chatHooks.controller, executeSubmit: chatHooks.handleSubmit }`
    - Spread queueHooks into context value
  - Acceptance: Queue functions accessible via `useChatContext()`

### Task 5: Update ChatInput to Use Queue
- [x] Modify ChatInput to enqueue instead of direct submit
  - Files: `frontend/src/components/inputs/ChatInput.tsx`
  - Changes:
    - Import `enqueue` from context
    - Replace `handleSubmit(query, images)` call with `enqueue(query, images)`
    - Remove `!loading` check from Enter key handler
    - Keep input clearing logic (already exists)
  - Acceptance: Typing and pressing Enter adds to queue

### Task 6: Update ChatSubmitButton for Queue UI
- [x] Modify ChatSubmitButton to show queue controls during streaming
  - Files: `frontend/src/components/buttons/ChatSubmitButton.tsx`
  - Changes:
    - Import `queueLength`, `enqueue` from context
    - When `controller` exists:
      - Show queue count badge if `queueLength > 0`
      - Show submit-to-queue button (Plus icon) if query/images not empty
      - Keep abort button
    - Add `Plus` icon import from lucide-react
    - Add `Badge` import from shadcn/ui
  - Acceptance: During streaming, can see queue count and add more messages

### Task 7: Add Queue Clear Integration
- [x] Clear queue when messages are cleared
  - Files: `frontend/src/context/ChatContext.tsx` (implemented here instead of useChat.ts)
  - Changes:
    - Added effect in ChatContext.tsx that clears queue when messages.length === 0
  - Acceptance: Clearing conversation also clears the queue

### Task 8: Add Navigation Warning
- [x] Warn user before leaving with queued messages
  - Files: `frontend/src/hooks/useMessageQueue.ts`
  - Add `useEffect` with `beforeunload` handler
  - Only warn if `queueLength > 0`
  - Acceptance: Browser shows confirmation dialog when navigating away with queue items

## Testing

### Task 9: Create Queue Hook Unit Tests
- [ ] Write unit tests for useMessageQueue
  - Files: `frontend/src/tests/hooks/useMessageQueue.test.ts`
  - Test cases:
    - enqueue adds message to queue with correct structure
    - dequeue removes specific message by ID
    - clearQueue empties the queue
    - processNext triggers executeSubmit with correct args
    - Auto-process fires when isStreaming changes from true to false
    - Queue length state updates correctly
    - Unique IDs generated for each message
  - Pattern: Follow `useFileSystem.test.ts` structure
  - Acceptance: All tests pass

### Task 10: Test Manual Scenarios
- [ ] Manually verify queue functionality
  - Test cases:
    - Submit message, see it process immediately
    - During streaming, submit second message, see queue badge
    - Stream completes, second message auto-processes
    - Add 3 messages to queue, verify order preserved
    - Abort stream, verify queue still has items
    - Clear messages, verify queue cleared
    - Navigate away with queue items, see warning
  - Acceptance: All manual tests pass

## Documentation

### Task 11: Add Code Comments
- [ ] Document public API of useMessageQueue
  - Files: `frontend/src/hooks/useMessageQueue.ts`
  - Add JSDoc comments for:
    - Hook purpose and usage
    - Each return value
    - Configuration options
  - Acceptance: Code is self-documenting

## Verification

### Task 12: Lint and Type Check
- [ ] Ensure code quality
  - Commands: `npm run lint`, `npm run build`
  - Acceptance: No lint errors, no type errors

### Task 13: Run Full Test Suite
- [ ] Verify no regressions
  - Commands: `npm run test`
  - Acceptance: All existing tests still pass

### Task 14: Self-review Against REVIEW.md
- [ ] Verify implementation matches council decisions
  - Check: Ref-based queue pattern used
  - Check: Minimal state updates
  - Check: Backward compatible with handleSubmit
  - Check: Edge cases handled per GUARDIAN
  - Acceptance: Implementation aligns with REVIEW.md

### Task 15: Create Pull Request
- [ ] Open PR for review
  - Target: `development` branch
  - Include: Summary of changes, screenshots of queue UI
  - Link: Reference issue #504
  - Acceptance: PR created and ready for review

---

## Completion Signature

- **Total Tasks**: 15
- **Critical Path**: Tasks 1-6 (core functionality)
- **Dependencies**:
  - Task 2 depends on Task 1
  - Task 4 depends on Task 3
  - Tasks 5-6 depend on Task 4
  - Task 7 depends on Task 4
  - Task 8 depends on Task 3
  - Task 9 depends on Task 3
  - Tasks 10-15 depend on Tasks 1-8

---

## Progress Log

### 2026-01-20: Core Implementation Complete (Tasks 1-8)

**Completed by**: ELITE BUILDER (Claude Opus 4.5)

**Files Created:**
- `frontend/src/lib/entities/queue.ts` - Type definitions for QueuedMessage, UseMessageQueueConfig, UseMessageQueueReturn
- `frontend/src/hooks/useMessageQueue.ts` - Main hook implementation with ref-based queue pattern

**Files Modified:**
- `frontend/src/lib/entities/index.ts` - Added export for queue types
- `frontend/src/context/ChatContext.tsx` - Integrated queue hook, added clear effect
- `frontend/src/components/inputs/ChatInput.tsx` - Use enqueue instead of handleSubmit
- `frontend/src/components/buttons/ChatSubmitButton.tsx` - Added queue UI (badge + add-to-queue button)
- `frontend/src/hooks/useChat.ts` - Fixed handleSubmit type signature

**Verification:**
- TypeScript: `npm run build` passes
- Linter: `npm run lint` passes (no new errors)
- Tests: `npm run test` - 163 tests pass, no regressions

**Key Implementation Details:**
- Used OPTIMIZER's hybrid ref+state pattern for minimal re-renders
- Queue uses `useRef` for array storage, `useState` only for queueLength and isProcessing
- Auto-processing via useEffect with edge detection (prevStreamingRef)
- Navigation warning via beforeunload event handler
- Queue clears when messages are cleared (via ChatContext effect)

### 2026-01-20: UI Design Matching (QueuePanel Implementation)

**Completed by**: Claude Opus 4.5

**Problem**: Initial implementation did not match the UI design from GitHub issue #504 comment. The design showed a visible queue panel with list of messages, not just a badge/plus button.

**Files Created:**
- `frontend/src/components/panels/QueuePanel.tsx` - New component displaying queued messages list with:
  - Header showing "N messages queued" with list icon
  - Individual queue items showing index, message text, "Pending" badge
  - Edit button (pencil icon) for inline editing
  - Delete button (X icon) for removing items

**Files Modified:**
- `frontend/src/lib/entities/queue.ts` - Added `queuedItems` array and `updateQueuedMessage` to return type
- `frontend/src/hooks/useMessageQueue.ts` - Added:
  - `queuedItems` state for UI display
  - `updateQueuedMessage` function for inline editing
  - `syncQueueState` helper to keep queuedItems in sync
- `frontend/src/components/inputs/ChatInput.tsx` - Integrated QueuePanel above input
- `frontend/src/components/buttons/ChatSubmitButton.tsx` - Simplified streaming UI (removed badge/plus, kept submit+abort)

**Verification:**
- TypeScript: `npm run build` passes
- Linter: `npm run lint` passes (no new errors)
- Tests: `npm run test` - 163 tests pass, no regressions

**Design Elements Implemented:**
- Queue panel appears above chat input when messages are queued
- Shows numbered list (0, 1, 2...) of pending messages
- Each item has "Pending" badge, edit, and delete buttons
- Inline editing with Enter to save, Escape to cancel
- Panel collapses when queue is empty
