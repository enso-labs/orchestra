# Bug 855 Plan

## Root Cause

The frontend now has two competing file-state models:

- `ChatContext` composes the visible workspace from persisted settings files, memory files, backend-synced files, baseline overrides, and thread-scoped files, then hydrates the canonical `fileSystem`.
- `useChat.handleSubmit()` still serializes `input.files` from the legacy nested `filesMap`.

That mismatch means the next prompt can be built from stale per-message file entries instead of the current workspace snapshot. The problem is most visible after thread hydration and delete/rename flows, because the visible editor state is current while `filesMap` may still contain old message-scoped entries.

## Affected Files

- `frontend/src/hooks/useChat.ts`
  - Add a dedicated submission-files source that can be driven by the canonical workspace state.
  - Use that source in both unified and legacy stream payload builders.
- `frontend/src/context/ChatContext.tsx`
  - Push the current visible workspace snapshot into `useChat` whenever `fileSystem` changes.
  - Keep the legacy `filesMap` sync for streaming/thread hydration, but stop relying on it for request submission.
- `frontend/src/hooks/useChat.test.tsx`
  - Add regression coverage proving canonical submission files override stale `filesMap` entries.

## Fix Strategy

1. Add failing hook tests around outbound payload construction.
2. Introduce a submission-files ref/setter in `useChat`.
3. Update `ChatContext` to publish the canonical workspace snapshot into that setter on every `fileSystem` change, including the empty state.
4. Keep existing `filesMap` behavior for thread/file association so the UI does not regress.
5. Run targeted frontend tests.

## Regression Risk

- Empty workspaces must submit no files, not fall back to stale `filesMap`.
- Existing stream/file association logic must still keep thread-scoped files visible after responses load.
- Legacy code paths using the fallback SSE handler must serialize the same payload as the unified path.
