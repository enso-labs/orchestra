# Reflection: Lessons from "New Chat" SSE Race Condition Fix

## Context

Debugging why messages persisted after clicking "New Chat" in the Orchestra frontend. The task spanned root cause analysis, multiple fix attempts, and browser-based validation.

## What Happened

### Initial Plan (Incorrect)
The plan identified the SSE race condition correctly and proposed a single-line abort guard in `useChat.ts`. This was necessary but **insufficient** — it only solved the streaming case, not the static messages case.

### The Real Root Cause (Discovered During Browser Testing)
React 18 batches all state updates within event handlers. When `NewThreadButton` called `clearMessages()` then `navigate("/chat")` in the same handler, the route change rendered `/chat` **before React committed the cleared state**. The old messages from the previous thread appeared on the clean chat page.

Key evidence: `flushSync` (which forces synchronous state commits) also failed — React's batching in event handlers was more aggressive than expected, or the shared `ChatContext` provider above the router meant state was shared.

### What Actually Fixed It
Adding a `useEffect` in `chat-v2.tsx` that detects `staleThreadId` in navigation state and calls `clearMessages()` on the destination page. This is the reliable cleanup point because:
- It runs **after** the route has mounted
- It doesn't fight React's batching — it works with it
- It's idempotent (if `clearMessages` already took effect, the guard `messages.length > 0` skips)

### Final Changes (3 files)
1. `useChat.ts` — abort guard on `stream.onEvent` (prevents SSE re-population)
2. `NewThreadButton.tsx` — passes `staleThreadId` via navigation state
3. `chat-v2.tsx` — `useEffect` clears lingering messages when `staleThreadId` present

## Lessons for Future Sessions

### 1. React state + navigation = always test in browser
Unit tests passed at every stage, but the bug was only visible in the real app. React batching behavior in event handlers cannot be reliably tested with `fireEvent` + mocked hooks. **Always do headed browser validation for state-clearing + navigation bugs.**

### 2. Don't fight React's batching — work with it
Three approaches were tried and failed:
- `setTimeout(0)` — too early, React hadn't flushed yet
- `flushSync` — didn't work as expected in the shared context provider pattern
- Synchronous clear + navigate — React batches both

The working approach: **let the destination handle cleanup**. Pass a flag via navigation state, and clear on mount. This pattern is robust against any batching behavior.

### 3. Module-level mutable state (`in_mem_messages`) is a foot-gun
`useChat.ts` uses a module-level `let in_mem_messages: any[]` that persists across route changes. This singleton, combined with SSE closures that capture it, creates subtle race conditions. Any future work touching `useChat.ts` should be aware of this.

### 4. Plan should include browser validation as a gate
The original plan's verification section said "run tests + manual test with agent-browser." In practice, the browser test revealed the plan was wrong. **Future plans for UI state bugs should gate on browser validation, not just unit tests.**

### 5. The `staleThreadId` pattern is the project's standard
The codebase already had `staleThreadId` in `useInitialThreadRedirect` to prevent URL bounce-back. The fix extended this pattern to also clear messages. When working on the chat navigation flow, check this pattern first.
