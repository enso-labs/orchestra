# Initial Report: Frontend Message Queue Implementation

## Project Context

### Technology Stack
- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui
- **State Management**: React Context + Custom Hooks
- **Backend**: Python/FastAPI (NOT being changed in this implementation)

### Objective
Implement a frontend-only message queue system that:
1. Allows users to queue multiple messages while an LLM stream is active
2. Processes queued messages sequentially until the queue is empty
3. Provides visual feedback about queued messages

## Key Files Analysis

### 1. ChatInput.tsx (`frontend/src/components/inputs/ChatInput.tsx`)
Current behavior:
- Uses `handleSubmit(query, images)` from ChatContext
- Disabled submit when `loading` is true (from AppContext)
- On Enter key, checks `!loading && !isLikelyMobile()` before submitting

**Required Changes**: Instead of calling `handleSubmit` directly, push to a queue state.

### 2. ChatSubmitButton.tsx (`frontend/src/components/buttons/ChatSubmitButton.tsx`)
Current behavior:
- Renders abort button when `controller` exists (streaming active)
- Renders mic button when query is empty
- Renders submit button otherwise
- `controller` presence indicates active stream

**Key Insight from Requirements**: Currently "abort button" replaces submit. For queueing, we need to show BOTH:
- An abort button for the current stream
- A submit button to add to queue

### 3. useChat.ts (`frontend/src/hooks/useChat.ts`)
Current behavior:
- `handleSubmit()` immediately calls SSE handler
- `controller` state tracks active AbortController
- `setLoading(true)` during stream

**Required Changes**:
- Add queue state: `messageQueue: QueuedMessage[]`
- Add queue management: `addToQueue`, `removeFromQueue`, `clearQueue`
- Use `useEffect` to process queue when stream completes

### 4. ChatContext.tsx (`frontend/src/context/ChatContext.tsx`)
Aggregates multiple hooks and provides to components.

## Previous Attempt Analysis (PR #522)

The previous diff showed:
- Renamed `handleSubmit` to `hanleLLMStream` (typo noted)
- Created `useMessageQueue` hook
- Separated ThreadContext from ChatContext

**Key Learnings**:
- The approach of separating queue logic into a custom hook is sound
- The UI needed to handle both abort and queue-submit simultaneously
- Previous attempt was backend-driven; this attempt is frontend-only

## UI Reference
The GitHub issue shows a UI with queue indicators. Key elements:
- Visual indication of queued messages
- Ability to submit while streaming is active
- Queue count display

## Implementation Requirements

1. **Queue State Management**
   - New hook: `useMessageQueue.ts`
   - States: `messageQueue`, `isProcessing`
   - Actions: `addToQueue`, `removeFromQueue`, `processNext`, `clearQueue`

2. **Submit Behavior Change**
   - Submit always adds to queue (not directly to LLM)
   - If not currently streaming, immediately process next from queue
   - If streaming, message stays in queue until current completes

3. **UI Updates**
   - Show queue count badge
   - Enable submit button even during streaming (to add to queue)
   - Visual distinction for queued vs. processing message

4. **Stream Completion Hook**
   - When stream completes, check queue
   - If queue non-empty, auto-process next message
   - Chain until queue is empty

## Constraints
- **Frontend-only changes** - No backend modifications
- **Use React state and hooks** - No external state management libraries
- **Maintain existing patterns** - Follow established codebase conventions
