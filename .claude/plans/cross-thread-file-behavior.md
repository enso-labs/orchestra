# Plan: Cross-Thread File Workspace Behavior

## Goal

Reproduce and document the logged-in user file-workspace behavior across thread switches, then align the app to a `settings-only` editable workspace model where:

- editable files belong to the authenticated user, not to a thread
- historical thread loads restore messages/checkpoints/todos only
- live-generated files can appear immediately, but once visible they follow user-workspace lifecycle rules
- `FileEditorPanel` remains the UI owner of visible files, tabs, active file, and dirty state through `ChatContext`

This document is the implementation plan for the phase. It includes the behavior contract, code-change plan, test plan, and the headed browser repro template to fill during execution.

## Scope

In scope:

- logged-in local-dev behavior on `http://localhost:5173`
- thread switching, revisiting threads, refresh, and dirty edits
- frontend ownership changes required to stop thread history from hydrating the editable workspace
- verification against persisted user settings in `/settings` and `/settings/default`

Out of scope:

- archive/version-management UX beyond follow-up notes
- new backend endpoints
- public-doc updates before the shipped behavior matches this contract

## Current Code Truths

These are the relevant current behaviors in the worktree:

- [`frontend/src/pages/threads/ThreadPage.tsx`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/pages/threads/ThreadPage.tsx#L94) clears route-mismatch thread state and also calls `setFilesMap(new Map())`, which couples route transitions to workspace-facing file ingestion.
- [`frontend/src/hooks/useThread.ts`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/hooks/useThread.ts#L103) rebuilds `ThreadData.filesMap` from `thread.metadata.files` by attaching that payload to the latest AI message on historical loads.
- [`frontend/src/context/ChatContext.tsx`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/context/ChatContext.tsx#L169) builds the visible workspace from five sources: memory files, settings files, backend-sync files, baseline overrides, and thread-scoped files.
- [`frontend/src/context/ChatContext.tsx`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/context/ChatContext.tsx#L523) treats non-streaming `filesMap` updates as `threadScopedFiles`, and a later `filesMap` replacement overwrites that transient source wholesale.
- [`frontend/src/components/panels/FileEditorPanel.tsx`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/components/panels/FileEditorPanel.tsx#L65) already reads `fileSystem`, `openTabs`, `activeFile`, and `dirtyFiles` from `ChatContext`. The panel is not the source of the current cross-thread bug.
- [`backend/src/schemas/entities/settings.py`](/home/ryaneggz/ruska-ai/orchestra/backend/src/schemas/entities/settings.py#L33) and [`backend/src/repos/user_settings_repo.py`](/home/ryaneggz/ruska-ai/orchestra/backend/src/repos/user_settings_repo.py#L107) already support persisted workspace files in `defaults.files` plus tombstones in `defaults.deleted_files`.
- [`frontend/src/tests/context/ChatContext.test.tsx`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/tests/context/ChatContext.test.tsx#L285) already proves the desired durable-file promotion path.
- [`frontend/src/tests/context/ChatContext.test.tsx`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/tests/context/ChatContext.test.tsx#L468) currently codifies the behavior we want to remove: thread-scoped file replacement on thread switch.

## Problem Summary

The editor-visible workspace currently has two conflicting authorities:

- durable user sources: settings files, memory files, promoted user files
- thread restore sources: `thread.metadata.files` and route-transition `filesMap` resets

That split is what creates wipe/restore/contamination risk when navigating old threads. The UI contract says the editor belongs to the logged-in user, but historical thread restore still acts like a second owner.

## Target Behavior Contract

- The editable workspace is global to the authenticated user.
- Opening, switching, or revisiting threads must never delete, replace, or resurrect editable workspace files.
- Historical thread navigation restores messages, checkpoints, metadata, and todos only.
- Historical `thread.metadata.files` may remain in loaded thread metadata for backward compatibility, but it is non-authoritative for the editor.
- `setFilesMap()` is a live-ingestion channel for stream events, not a historical restore API.
- Live-generated files are promoted into durable workspace state once they appear during a stream.
- `FileEditorPanel` continues to render from `fileSystem`, `openTabs`, `activeFile`, and `dirtyFiles` owned by `ChatContext`.
- Dirty edits must survive thread navigation and page refresh until normal autosave/manual save semantics resolve them.

## Failure Taxonomy

Use these labels during repro:

- `wipe`: existing workspace file disappears after thread transition
- `unexpected restore`: historical thread snapshot reintroduces stale file content into the editor
- `cross-thread contamination`: Thread A file state shows up only because Thread A was opened, not because it belongs to the user workspace
- `dirty-state loss`: open tab, active file, or unsaved edits are lost during navigation

## Implementation Plan

### 1. Historical Thread Loading Becomes Settings-Only

Primary files:

- [`frontend/src/hooks/useThread.ts`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/hooks/useThread.ts)

Planned change:

- Keep loading checkpoints, messages, metadata, todos, and model exactly as today.
- Stop mapping `threadData.files` into `ThreadData.filesMap`.
- Return `new Map()` for `filesMap` on historical thread loads.
- Leave `threadData.files` inside `metadata` as opaque historical data for future archive/version work.

Expected result:

- opening an older thread cannot hydrate the editor with historical snapshot files
- `useLoadThreadEffect()` still clears thread todos/messages/checkpoints correctly

### 2. Route Transitions Must Not Mutate Durable Workspace

Primary files:

- [`frontend/src/pages/threads/ThreadPage.tsx`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/pages/threads/ThreadPage.tsx)
- audit follow-up: [`frontend/src/pages/agents/thread.tsx`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/pages/agents/thread.tsx), [`frontend/src/pages/agents/edit.tsx`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/pages/agents/edit.tsx), [`frontend/src/components/buttons/NewThreadButton.tsx`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/components/buttons/NewThreadButton.tsx)

Planned change:

- Keep clearing messages, checkpoints, todos, and view mode on route-thread mismatch.
- Do not call `setFilesMap(new Map())` from `ThreadPage` route mismatch handling.
- Treat route changes as thread transport resets only, not workspace resets.
- Audit other `clearThreadScopedFiles()` callers so “new chat” or agent-page teardown only clears truly ephemeral preview state and does not affect durable workspace state.

Expected result:

- thread navigation stops being able to wipe visible files or editor tabs
- dirty edits on durable files remain loaded through navigation

### 3. `ChatContext` Ownership Tightening

Primary file:

- [`frontend/src/context/ChatContext.tsx`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/context/ChatContext.tsx)

Planned change:

- Keep these as the only editable-workspace population sources for authenticated usage:
  - `settingsFiles`
  - `memoryFiles`
  - `baselineOverrides`
  - `backendSyncFiles` only where that source is intentionally part of the current workspace view
- Keep live stream promotion behavior: when `isStreamingRef.current` is true, newly surfaced files are promoted into durable user-owned state exactly once.
- Remove historical-thread authority from `filesMap` by ensuring non-streaming historical loads no longer create `threadScopedFiles`.
- Preserve dirty paths by continuing to ignore incoming file replacements for paths in `dirtyFilesRef`.
- Keep autosave payload generation unchanged: only durable sources persist to `defaults.files`.

Implementation note:

- The current `threadScopedFiles` mechanism can remain temporarily if it is only used for non-authoritative preview flows.
- If tightening `setFilesMap()` breaks shared-thread file preview, add an explicit preview-only API rather than reusing thread restore hydration for authenticated workspace routes.

Expected result:

- live runs can still create files immediately
- switching threads no longer replaces the workspace with thread-owned data
- refresh rebuilds from persisted settings plus memory state, not from last thread history

### 4. `FileEditorPanel` Ownership Stays As-Is

Primary file:

- [`frontend/src/components/panels/FileEditorPanel.tsx`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/components/panels/FileEditorPanel.tsx)

Planned change:

- No ownership rewrite is expected in this phase.
- The panel should continue to read from `fileSystem`, `openTabs`, `activeFile`, and `dirtyFiles`.
- Validation focus is on ensuring upstream thread loading no longer invalidates those values.

### 5. Browser Repro and Evidence Capture

Skill to use during execution: `agent-browser`

Preflight:

1. Verify the frontend dev server on `:5173` belongs to this worktree.
2. Start the backend from this worktree on `:8000`.
3. Do not inspect any `.env*` file directly.
4. Use headed mode with a dedicated session:

```bash
agent-browser --headed --session cross-thread-files open http://localhost:5173
```

Suggested local commands before browser work:

```bash
lsof -i :5173 -t 2>/dev/null && ls -l /proc/$(lsof -i :5173 -t 2>/dev/null | head -1)/cwd 2>/dev/null
cd backend && make dev
cd frontend && npm run dev
mkdir -p .claude/artifacts/cross-thread-file-behavior
```

Screenshot sequence:

- `01-login.png`
- `02-thread-a-empty-workspace.png`
- `03-thread-a-generated-file.png`
- `04-thread-b-after-new-session.png`
- `05-thread-a-revisited.png`
- `06-thread-switch-during-dirty-edit.png`
- `07-post-refresh-workspace.png`

Required evidence fields after each capture:

- thread ID
- current URL
- visible workspace files
- open tabs
- active file
- dirty files or visible dirty indicator
- contract status: `match` or failure label

### 6. Test Plan

Primary files:

- [`frontend/src/tests/context/ChatContext.test.tsx`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/tests/context/ChatContext.test.tsx)
- [`frontend/src/pages/threads/ThreadPage.test.tsx`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/pages/threads/ThreadPage.test.tsx)
- likely new or expanded tests around [`frontend/src/hooks/useThread.ts`](/home/ryaneggz/ruska-ai/orchestra/frontend/src/hooks/useThread.ts)

Keep passing:

- durable settings/memory hydration
- streamed file promotion into durable state
- dirty-state protection during persistence reloads

Change or add:

- historical thread loads return an empty `filesMap`
- thread-route mismatch does not call `setFilesMap(new Map())`
- thread switching does not remove durable workspace files
- thread switching does not remove unsaved dirty edits
- historical `thread.metadata.files` does not populate the editable workspace

Tests to replace:

- the existing “replaces stale thread-scoped files when switching threads” assertion should be inverted to the new contract

## Behavior Matrix

| Scenario | Trigger | Expected result | Failure class if broken | Verification |
| --- | --- | --- | --- | --- |
| 1. Thread A generates file | live run creates a file | file appears immediately and survives first autosave boundary | `wipe` | browser + unit |
| 2. Start Thread B in same session | new thread without reopening A | generated file remains visible in workspace | `wipe` or `cross-thread contamination` | browser + unit |
| 3. Revisit Thread A | sidebar navigation back to A | workspace does not wipe, duplicate, or revert | `wipe` or `unexpected restore` | browser + unit |
| 4. Dirty edit then switch thread | edit in `FileEditorPanel`, navigate before manual save | dirty file content, tab, and active selection remain loaded | `dirty-state loss` | browser + unit |
| 5. Refresh while logged in | browser reload | workspace rebuilds from settings/memory, not historical thread files | `unexpected restore` | browser + unit |
| 6. Historical thread with old file snapshot | load checkpoint metadata containing `thread.metadata.files` | editor ignores historical snapshot for workspace hydration | `unexpected restore` | unit |

## Repro Evidence Log

Headed run executed with:

```bash
agent-browser --headed --session cross-thread-files open http://localhost:5173
```

Seeded login used: `admin@example.com` / `test1234`

| Screenshot | Thread ID | URL | Visible files | Open tabs | Active file | Dirty state | Contract status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `01-login.png` | none | `http://localhost:5173/chat` | files badge shows `1` | not inspected | not inspected | none visible | `match` | authenticated landing state after login |
| `02-thread-a-empty-workspace.png` | none | `http://localhost:5173/chat` | `/AGENTS.md` | `/AGENTS.md` | `/AGENTS.md` | none visible | `match` | baseline is not literally empty in this seeded environment because a persisted workspace file already exists |
| `03-thread-a-generated-file.png` | `a9667288-6f87-447b-9a97-375e4fe6fe01` | `http://localhost:5173/thread/a9667288-6f87-447b-9a97-375e4fe6fe01` | `/AGENTS.md`, `/cross-thread/thread-a-generated.md` | `/AGENTS.md`, `/cross-thread/thread-a-generated.md` | `/cross-thread/thread-a-generated.md` | none visible | `match` | generated file appeared in editor and survived the first autosave boundary; console logged persistent save success after creation |
| `04-thread-b-after-new-session.png` | `06e21ddd-5a70-4c95-b809-c0724e4d3ec1` | `http://localhost:5173/thread/06e21ddd-5a70-4c95-b809-c0724e4d3ec1` | files badge shows `2` with Thread A unloaded | panel closed | panel closed | none visible | `match` | manual `/chat` navigation plus a no-file prompt created Thread B; workspace file count remained `2` without reopening Thread A |
| `05-thread-a-revisited.png` | `a9667288-6f87-447b-9a97-375e4fe6fe01` | `http://localhost:5173/thread/a9667288-6f87-447b-9a97-375e4fe6fe01` | files badge shows `2` | panel closed | panel closed | none visible | `match` | reopening Thread A from the sidebar did not wipe, duplicate, or revert the workspace |
| `06-thread-switch-during-dirty-edit.png` | `06e21ddd-5a70-4c95-b809-c0724e4d3ec1` | `http://localhost:5173/thread/06e21ddd-5a70-4c95-b809-c0724e4d3ec1` | `/AGENTS.md`, `/cross-thread/thread-a-generated.md` | `/AGENTS.md`, `/cross-thread/thread-a-generated.md` | `/cross-thread/thread-a-generated.md` | dirty tab marker preserved on `thread-a-generated.md`; editor content still contained `DIRTY_THREAD_SWITCH_MARKER` after reopening Files on Thread B | `match` | before the switch, Thread A showed `• thread-a-generated.md`; after switching to Thread B and reopening the panel, the dirty tab and unsaved content were still present |
| `07-post-refresh-workspace.png` | `06e21ddd-5a70-4c95-b809-c0724e4d3ec1` | `http://localhost:5173/thread/06e21ddd-5a70-4c95-b809-c0724e4d3ec1` | `/AGENTS.md`, `/cross-thread/thread-a-generated.md` | `/AGENTS.md`, `/cross-thread/thread-a-generated.md` | `/AGENTS.md` | dirty marker cleared; unsaved `DIRTY_THREAD_SWITCH_MARKER` lost after refresh | `dirty-state loss` | refresh rebuilt the workspace from persisted state, not the in-memory dirty editor state; the generated file still existed, but the active file reset and the unsaved edit disappeared |

## Observed Findings

- Thread-to-thread navigation did not wipe or resurrect files in this run. Once `/cross-thread/thread-a-generated.md` appeared, it behaved like a durable workspace file across Thread A, Thread B, and Thread A revisit.
- Dirty state survived thread navigation. The generated file kept both its dirty tab marker and unsaved content after switching from Thread A to Thread B.
- Dirty state did not survive a full page refresh. After reload, the workspace still contained the durable files, but the unsaved marker was gone, the dirty tab marker cleared, and the active editor reset to `/AGENTS.md`.
- The current code still violates the desired ownership model even though the main wipe/restore bug did not reproduce in this specific session. Historical thread load still maps `thread.metadata.files` into `filesMap`, and route mismatch handling still clears `setFilesMap(new Map())`, so the spec should treat the current implementation as structurally unsafe until those paths are removed.

## Risks And Follow-Ups

- `SharedThreadPage` currently uses `setFilesMap()` to show shared files. If `setFilesMap()` is narrowed further, shared-thread preview may need its own explicit preview API.
- Agent config/thread pages currently call `clearThreadScopedFiles()` on unmount. They need an audit after the authenticated workspace contract is tightened so they do not regress editor ownership.
- The plan assumes seeded login `admin@example.com` / `test1234` works locally.
- If autosave timing is flaky in headed repro, capture both pre-autosave and post-autosave states and classify separately.

## Recommended Execution Order

1. Update tests to encode the settings-only thread contract.
2. Change `useThread.ts` so historical loads return an empty `filesMap`.
3. Remove workspace mutation from `ThreadPage.tsx` route mismatch handling.
4. Tighten `ChatContext` ownership only as far as needed to preserve live promotion and stop historical hydration.
5. Run frontend unit tests.
6. Execute the headed `agent-browser` repro and fill the evidence log.
7. Only after the behavior matches the contract, consider public doc and `website/public/llm.txt` updates.
