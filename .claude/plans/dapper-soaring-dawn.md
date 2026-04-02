# Plan: Eliminate Direct `useEffect` — Adopt Declarative React Patterns

## Context

Based on [this tweet](https://x.com/alvinsng/status/2033969062834045089) ("Why we banned React's useEffect"), we're refactoring the Orchestra frontend to eliminate direct `useEffect` calls in favor of 5 declarative patterns:

1. **Derive state, don't sync it** — `useMemo` / inline calculation instead of effect-based state sync
2. **Use data-fetching libraries** — TanStack Query instead of manual fetch-in-effect
3. **Event handlers, not effects** — handle actions in click/submit handlers directly
4. **`useMountEffect` for external sync** — semantic wrapper for one-time DOM/third-party setup
5. **Reset with `key`, not choreography** — React `key` prop to force clean remounts

**Current state**: ~200+ `useEffect` calls across 83 files. No data-fetching library. A non-standard `useEffectXxx()` wrapper pattern is used across 13+ hooks. After all phases, ~120 legitimate effects (DOM listeners, scroll, animation) remain, wrapped in `useMountEffect` or explicitly commented.

---

## Phase 0: Foundation (1 PR, no behavioral changes)

**Goal**: Install TanStack Query, create utility hooks, establish lint guidance.

### 0A. Install TanStack Query v5
- **File**: `frontend/package.json`
- Add `@tanstack/react-query` and `@tanstack/react-query-devtools`

### 0B. Create QueryClient + Provider
- **Create**: `frontend/src/lib/queryClient.ts` — singleton with defaults (`staleTime: 5min`, `retry: 1`, `refetchOnWindowFocus: false`)
- **Create**: `frontend/src/providers/QueryProvider.tsx` — wraps `<QueryClientProvider>` + devtools
- **Modify**: App root to wrap with `QueryProvider` (outermost layer)

### 0C. Create `useMountEffect` hook
- **Create**: `frontend/src/hooks/useMountEffect.ts`
- Thin wrapper: `useEffect(fn, [])` with centralized eslint-disable comment
- Will replace ~25-30 empty-dependency effects

### 0D. Create query key factory
- **Create**: `frontend/src/lib/queryKeys.ts`
- Centralized keys: `user`, `settings`, `models`, `agents.*`, `threads.*`, `projects`, `memories`, `tokens`, `schedules.*`, `sandboxHealth`

### Verification
- App boots with QueryProvider wrapping
- `npm run test` passes with no regressions

---

## Phase 1: Settings & Leaf Components (1 PR, low risk)

**Goal**: Replace simplest "fetch on mount" effects with `useQuery`. Isolated components, no downstream consumers.

### Files to modify (replace `useEffect(() => fetch, [])` with `useQuery`):
| File | Current Pattern | Replacement |
|------|----------------|-------------|
| `src/components/settings/DefaultModelSettings.tsx:39` | `useEffect → getSettings().then(setDefaultModel)` | `useQuery` + derive `defaultModel` from query data |
| `src/components/settings/TimezoneSettings.tsx:36` | `useEffect → getSettings().then(setTimezone)` | `useQuery` + derive timezone |
| `src/components/settings/SandboxSettings.tsx:68` | `useEffect → getSettings() + getProviderKeys()` | `useQuery` for each |
| `src/components/settings/ApiTokensSettings.tsx:40` | `useEffect → fetch tokens` | `useQuery` + `useMutation` for create/delete |
| `src/components/settings/MemorySettings.tsx:70` | `useEffect → fetchMemories` | `useQuery` with search params as key deps |
| `src/components/settings/UserApiKeysSettings.tsx:60` | `useEffect → fetch provider keys` | `useQuery` |
| `src/hooks/useSandboxHealth.ts:52` | `useEffect → check health on URL change` | `useQuery` with `enabled: !!mcpSandboxUrl` |
| `src/hooks/useModelsList.ts` | `useEffect → listModels()` | `useQuery` returning `{ models, isLoading }` |

### Verification
- Settings page loads all settings correctly
- Sandbox health indicator works
- `npm run test` passes

---

## Phase 2: Hook Data-Fetching Layer (1-2 PRs, medium risk)

**Goal**: Replace the `useEffectXxx()` wrapper pattern in shared hooks. This is the biggest structural change — these hooks are consumed by every page.

### 2A. `useAuth.tsx` — Replace `useEffectGetUser`
- **File**: `src/hooks/useAuth.tsx:15-24`
- Replace nested `useEffectGetUser()` function with `useQuery({ queryKey: queryKeys.user(), queryFn: ... })`
- Remove `useState` for `user` — derive from query

### 2B. `useModel.tsx` — Replace `useModelsEffect`
- **File**: `src/hooks/useModel.tsx`
- Replace `useModelsEffect()` with internal `useQuery`
- **Breaking**: Remove `useModelsEffect` from return type
- **Consumer updates** (remove `useModelsEffect()` calls):
  - `src/pages/threads/ThreadPage.tsx:72`
  - `src/pages/chat/chat-v2.tsx:40`
  - `src/pages/agents/edit.tsx:33`
  - `src/pages/agents/thread.tsx:24`
  - `src/components/settings/DefaultModelSettings.tsx:37`

### 2C. `useAgent.ts` — Replace `useEffectGetAgents` + fix state-sync
- **File**: `src/hooks/useAgent.ts`
- Replace `useEffectGetAgents()`, `useEffectGetPublicAgents()`, `useEffectGetAgent()` with `useQuery` calls
- **Remove state-sync effect at line 44-48**: The `model` sync (`setAgent({ ...agent, model })`) is unnecessary — `useChat.getMetadata` already reads `model` at submission time
- **Consumer updates** (remove `useEffectGetAgents()` calls):
  - `src/pages/threads/ThreadPage.tsx:73`
  - `src/pages/chat/chat-v2.tsx:41`
  - `src/pages/agents/edit.tsx:22`
  - `src/pages/agents/thread.tsx:42`
  - `src/pages/agents/index.tsx:69`

### 2D. `useThread.ts` — Replace thread data fetching
- **File**: `src/hooks/useThread.ts`
- Remove debug `console.log` effect at line 67-73
- Replace `useListThreadsEffect`, `useListCheckpointsEffect`, `useLoadThreadEffect` with query-based hooks
- Consider `useInfiniteQuery` for `loadMoreThreads` pagination
- **Consumer updates** (remove wrapper calls from all pages):
  - `src/pages/threads/ThreadPage.tsx:75-76`
  - `src/pages/chat/chat-v2.tsx`
  - `src/pages/agents/thread.tsx`

### 2E. `useChat.ts` — Remove `useEffectUpdateAssistantId`
- **File**: `src/hooks/useChat.ts:846-859`
- This effect syncs `agent.id` into `metadata.assistant_id` — redundant since `getMetadata()` already reads `agent.id` at submission time
- Remove effect + remove from return type
- **Consumer updates**: Remove `useEffectUpdateAssistantId()` calls from all pages

### Verification
- Chat with an agent (send message, receive streaming response)
- Switch between threads
- Agent selection and listing works
- Thread pagination works
- `npm run test` passes

---

## Phase 3: State-Sync & Key-Reset Effects (1-2 PRs, medium risk)

**Goal**: Convert state-sync effects to derived values, key-reset effects to React `key` props.

### 3A. ThreadPage key-reset pattern
- **File**: `src/pages/threads/ThreadPage.tsx:94-115`
- Current: effect resets 5 state values when `threadId` changes
- **Fix**: Extract thread content into `<ThreadContent key={threadId} />` — React unmounts/remounts on key change, naturally resetting state

### 3B. Agent edit/thread page resets
- **File**: `src/pages/agents/edit.tsx:59-71` — reset agent state on mount/unmount
- **File**: `src/pages/agents/thread.tsx:80-92` — similar pattern
- **Fix**: Use `key={agentId}` on content wrapper + `useMountEffect` for cleanup-only logic

### 3C. FileEditorPanel state-sync effects
- **File**: `src/components/panels/FileEditorPanel.tsx`
- Line 158: `isMobile → setIsTreeCollapsed` — derive directly or initialize with `useState(isMobile)`
- Line 225: reset editor on file change — use `key={selectedFile}` on MonacoEditor
- Line 248: reset preview on file change — derive `canPreview` as computed value
- Line 260: `setIsRecording(isRecordingInProgress)` — remove local state, use prop directly

### 3D. ToolTimelineItem auto-expand
- **File**: `src/components/timeline/ToolTimelineItem.tsx:123`
- Replace `useEffect(() => { if (artifact) setIsExpanded(true) })` with `useState(!!message.artifact)`

### Verification
- Navigate between threads — state resets correctly
- File editor panel behavior preserved on mobile/desktop
- Agent edit page initializes and cleans up properly
- `npm run test` passes

---

## Phase 4: ChatContext Effect Chains (1 PR, high risk)

**Goal**: Break the complex effect chains in ChatContext.tsx — the highest-risk area.

### File: `src/context/ChatContext.tsx`

| Lines | Current | Replacement |
|-------|---------|-------------|
| 534-536 | `loadPersistentContextFiles` on mount | `useMountEffect(loadPersistentContextFiles)` |
| 538-560 | Sync visible workspace files (7 deps) | `useMemo` for `visibleWorkspaceFiles` + controlled sync |
| 562-623 | `filesMap` → source classification | Push classification into SSE handler in `useChat`, or keep with clear comment |
| 629-668 | `fileSystem` → `submissionFiles` | `useMemo` — compute at submission time, remove state |
| 672-676 | Clear queue on message reset | Call `clearQueue()` directly in `clearMessages()` |
| 785-836 | Autosave with debounce | Extract to custom `useAutoSave` hook |
| 838-853 | Post-streaming flush | Merge into `useAutoSave` hook |

### Verification
- Create/edit files in file editor — files persist across sessions
- Stream a response with file artifacts — files appear correctly
- Autosave fires after editing, suppressed during streaming
- Switch threads — files reset properly
- `npm run test` passes

---

## Phase 5: Remaining Effects & Cleanup (1-2 PRs, low-medium risk)

### 5A. Convert mount-only effects to `useMountEffect`
- `src/context/AppContext.tsx:20` — fetch app version
- `src/context/ThemeContext.tsx:34` — apply theme classes
- `src/context/OnboardingContext.tsx:43` — auth polling (convert to `useQuery` with `refetchInterval`)
- `src/hooks/useDocumentTitle.ts` — title management
- `src/embed/EmbedWidget.tsx:49,54,61` — auto-scroll, cleanup, focus
- `src/pages/OAuthCallback.tsx:19` — token exchange

### 5B. Move event-handler effects to actual handlers
- `src/pages/prompts/index.tsx:23` — clear search params (move to navigation handler)
- `src/pages/agents/index.tsx:78` — clear messages (move to mount via `useMountEffect`)

### 5C. Fix `useMessageQueue.ts` effect chains
- Lines 246-295: Move `processNext()` calls into stream completion handler and `setEditingId` handler respectively

### 5D. Fix `useServerHook.ts` state-sync effects
- `useDefaultServerConfigEffect` → derive default code with `useMemo`
- `useJsonValidationEffect` → derive with `useMemo`
- `useFormHandlerEffect` → derive JSON from form state with `useMemo`

### Verification
- All pages load without errors
- Onboarding flow works
- OAuth callback completes
- Schedule executions auto-refresh
- `npm run test` passes

---

## Phase 6: Lint Enforcement (1 PR)

- Add ESLint rule to warn on direct `useEffect` import from `react`
- Allow exceptions for files with legitimate DOM effects (Monaco, voice visualizer, Mermaid)
- Document patterns in `frontend/CLAUDE.md` under a new "Effect Patterns" section

---

## Summary

| Phase | PRs | Effects Eliminated | Risk | Key Files |
|-------|-----|-------------------|------|-----------|
| 0 | 1 | 0 (foundation) | Low | package.json, new files |
| 1 | 1 | ~15 | Low | settings components, leaf hooks |
| 2 | 1-2 | ~40 | Medium | useAuth, useModel, useAgent, useThread, useChat |
| 3 | 1-2 | ~25 | Medium | ThreadPage, FileEditorPanel, agent pages |
| 4 | 1 | ~8 | High | ChatContext.tsx |
| 5 | 1-2 | ~30 | Low-Med | Contexts, remaining pages/components |
| 6 | 1 | 0 (enforcement) | Low | ESLint config, CLAUDE.md |

**Total**: ~118 effects eliminated across 6-9 PRs. ~80-120 legitimate effects remain (DOM listeners, scroll, animation, third-party integrations) — these use `useMountEffect` or have explicit justification comments.

### Parallel Work Opportunities
- Phases 1 and 3 can be worked on in parallel (different files)
- Phase 4 must follow Phase 2 (ChatContext consumes hooks refactored in Phase 2)
- Phase 6 follows all other phases

### Testing Strategy (all phases)
- `npm run test` after every PR
- Manual smoke test: send a chat message, switch threads, edit agent, open settings
- For Phase 4 (ChatContext): write characterization tests before modifying
