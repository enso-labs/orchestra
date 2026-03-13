# Plan: Fix filesMap Not Persisted Across Threads

## Context

When a chat session generates/edits files (e.g., AGENTS.md), those files are persisted to `thread.files` on the backend but **not restored** when navigating back to the thread. The frontend's `loadThread()` deliberately returns an empty `filesMap`, so the file editor only shows persistent context files (e.g., 20 files) regardless of which thread is loaded.

**Bug validated via agent-browser (headed mode)**:
1. Logged in, sent message: "Add a comment to the top of AGENTS.md that says: # BUG TEST..."
2. AI successfully edited AGENTS.md (edit_file tool call confirmed in chat)
3. Clicked "New Chat", then navigated back to the thread
4. Opened Files panel - AGENTS.md content starts with `# Claude Code Project Guidelines` (the persistent baseline)
5. The `# BUG TEST` line added during the session is **missing** from the file editor
6. File count stays at "Files 20" (persistent files only) - identical to new thread page

## Root Cause

`frontend/src/hooks/useThread.ts:103-105`:
```typescript
// Historical thread files remain in metadata for backward compatibility,
// but they are not authoritative for the editable workspace.
const filesMap = new Map<string, any>();
```

The backend correctly enriches checkpoint metadata with `thread.files` (`backend/src/routes/v0/thread.py:55`), but the frontend ignores it.

## Fix

### File 1: `frontend/src/hooks/useThread.ts` (lines 103-105)

Replace the empty `filesMap` initialization with reconstruction from `threadData.files`:

```typescript
const filesMap = new Map<string, any>();
if (
    threadData.files &&
    typeof threadData.files === "object" &&
    Object.keys(threadData.files).length > 0
) {
    filesMap.set("thread", threadData.files);
}
```

This mirrors the existing pattern in `SharedThreadPage.tsx:55-59` which uses `filesMap.set("shared", data.thread.files)`.

**Why this is safe:**
- `ChatContext.tsx:562-631` processes filesMap entries - since `isStreamingRef.current` is `false` during thread load, files route to `threadScopedFiles` (ephemeral, cleared on thread switch)
- Lines 581-589 skip files already in `settingsFiles`, `baselineOverrides`, `backendSyncFiles`, or `dirtyFilesRef` - prevents thread files from overriding user-managed files
- `clearThreadScopedFiles()` is called on thread switch, so files don't leak between threads

### File 2: `frontend/src/hooks/useThread.test.tsx` (if test exists)

Update the test named "ignores historical metadata.files when hydrating a thread" to verify files ARE now populated. Rename to "hydrates filesMap from metadata.files when loading a thread".

## Verification

1. `cd frontend && npm run test` - ensure all tests pass
2. **Browser validation**:
   - Log in at localhost:5173
   - Open a thread that previously generated files (e.g., "Copy AGENTS.md to CLAUDE.md")
   - Verify the Files panel shows thread-specific files (count should match sidebar label, e.g., 17 files)
   - Click "New Chat" - verify thread files are cleared and only persistent files remain (20 files)
   - Navigate back to the thread - verify files reappear
