# Code Review Report: `feat/694-show-subagent-tool-calls`

**Date:** 2026-02-16
**Reviewer:** Claude (automated)
**Branch:** `feat/694-show-subagent-tool-calls`
**Base:** `development`

---

## 1. Pre-commit Hook Results

| Check | Result | Notes |
|-------|--------|-------|
| Backend lint (`ruff check`) | PASS | All checks passed |
| Backend format (`ruff format --check`) | PASS | 199 files already formatted |
| Frontend lint (`eslint .`) | PASS | No warnings or errors |
| Frontend build (`tsc -b && vite build`) | PASS | Types clean, build succeeded |
| Frontend tests (`vitest run`) | **FAIL** | 2 of 255 tests failing |

### Failing Tests (format.test.ts)

**Test 1: "should preserve agent_name on tool call messages"** (line 412)
- **Expectation:** `result[0].role === "AIMessageChunk"`
- **Actual:** `result[0].role === "tool_input"`
- **Root cause:** The test expects role `"AIMessageChunk"` but `formatMessages()` correctly splits AI messages with `tool_calls` into `tool_input` messages with role `"tool_input"`. The test expectation is wrong.
- Additionally, `agent_name` is NOT propagated from parent AI message to the generated `tool_input` messages (lines 147-155 of `format.ts` construct new objects without spreading the parent's `agent_name`).

**Test 2: "should preserve agent_name through full checkpoint thread"** (line 500)
- **Expectation:** `result[1].agent_name === "researcher"`
- **Actual:** `result[1].agent_name === undefined`
- **Root cause:** Same underlying issue. Message at index 1 is a `tool_input` (split from the AI message with tool_calls at index 2 of input). The tool_input construction in `formatMessages()` (lines 147-155) doesn't propagate `agent_name` from the parent message.

### Fix Required

In `format.ts` lines 147-155, the tool_input message construction should include `agent_name` from the parent message:

```typescript
return {
    id: `${message.id}-tc-${tool_call.id}`,
    type: "tool_input",
    role: "tool_input",
    tool_call_id: tool_call.id,
    name: tool_call.name,
    input: args,
    parent_message_id: message.id,
    // Propagate agent_name from parent AI message
    ...(message.agent_name !== undefined && { agent_name: message.agent_name }),
};
```

And test 1 should expect `"tool_input"` not `"AIMessageChunk"`:
```typescript
expect(result[0].role).toBe("tool_input");
```

---

## 2. Code Review Findings

### 2a. Out-of-Scope Changes (BLOCKER for clean PR)

14 files staged on this branch are NOT part of the subagent attribution PRD:

| File | Description |
|------|-------------|
| `backend/src/constants/default_memories.py` | New -- default memory templates |
| `backend/src/utils/memory_seed.py` | New -- seed utility |
| `backend/seeds/memory_seeder.py` | New -- CLI seed script |
| `backend/src/routes/v0/auth.py` | Modified -- adds memory seeding on register/oauth |
| `backend/Makefile` | Modified -- adds `seeds.memory` target |
| `backend/pyproject.toml` | Modified -- adds ruff E501 exclusion for default_memories |
| `tasks/prd-isolate-memories-page.md` | New -- separate PRD doc |
| `tasks/prd-separate-tool-inputs.md` | New -- separate PRD doc |
| `frontend/src/pages/memories/*` | Modified/New -- memories page UI |
| `frontend/src/pages/settings/index.tsx` | Modified |
| `frontend/src/components/drawers/app-sidebar.tsx` | Modified -- sidebar nav changes |
| `frontend/src/routes/AppRoutes.tsx` | Modified -- new route |
| `.claude/plans/feat-781/01.md` | New plan file |
| `.claude/plans/feat-784/01.md` | New plan file |

**Recommendation:** Split into separate PR(s) or explicitly acknowledge mixed scope in PR description.

### 2b. In-Scope Code Quality Issues

#### Backend (stream.py, messages.py)

| Severity | Issue | Location |
|----------|-------|----------|
| Low | **Code duplication**: `lc_agent_name` -> `agent_name` promotion logic duplicated between `_to_dict()` (stream.py:40-42) and `from_message_to_dict()` (messages.py:22-23) | Both files |
| Low | **Redundant dict conversion**: `handle_multi_mode()` line 163 creates `dict(msg)` just for a log check. `_to_dict()` already handles promotion downstream. | stream.py:163 |
| Medium | **No backend tests**: No unit tests for `agent_name` promotion in `_to_dict()` or `from_message_to_dict()` | Missing |

#### Frontend (format.ts, message.ts, useChat.ts)

| Severity | Issue | Location |
|----------|-------|----------|
| **High** | **agent_name not propagated to tool_input messages** in `formatMessages()`. Tool inputs generated from AI messages with tool_calls don't inherit `agent_name` from the parent. | format.ts:147-155 |
| Low | `agent_name` extraction in `useChat.ts` (lines 549-551) sets `undefined` -> `null` before passing to StreamMessageHandler. Clean pattern. | useChat.ts:549-551 |
| Low | `messageUpdate()` preserves `agent_name` via null-coalescing correctly. | message.ts:121 |

#### Frontend (ChatMessages.tsx, ToolTimeline.tsx, ToolTimelineItem.tsx, SubagentBadge.tsx)

| Severity | Issue | Location |
|----------|-------|----------|
| Low | **Duplicated `ToolMessage` interface** in both `ToolTimeline.tsx` (line 4) and `ToolTimelineItem.tsx` (line 14). Should extract to a shared type. | Both files |
| Low | **Missing `title` attribute** on SubagentBadge truncated span. When `agent_name` exceeds 120px, the full name is inaccessible. | SubagentBadge.tsx:19 |

### 2c. Architectural Concern: Checkpoint Persistence

| Severity | Issue |
|----------|-------|
| **Critical** | `agent_name` / `lc_agent_name` is NOT persisted in thread checkpoint data. Subagent attribution only appears during live streaming and is lost on page refresh / thread reload. |

**Evidence:** API query of thread `cdfaf242-e0c2-410e-aca8-3bfce7db1b1d` (a thread with 3 subagent task calls) shows 3 stored messages with no `agent_name` or `lc_agent_name` field. The checkpoint stores parent-level LangChain messages only; subagent-level message metadata is transient.

**Impact:** Users will see SubagentBadge and "via" annotations while watching a live stream, but these disappear on reload. This may confuse users or reduce the feature's utility.

**Recommendation:** Either persist `agent_name` in the thread update (stream.py final block), or document this as a known limitation.

---

## 3. Browser Validation

**Environment:** Backend on :8000, Frontend on :5173 (correct worktree confirmed)

### Validation Results

| AC | Story | What to Verify | Result | Notes |
|----|-------|----------------|--------|-------|
| US-005 AC2 | SubagentBadge | Bot icon + agent name in muted style | **INCONCLUSIVE** | No `data-testid="subagent-badge"` found in DOM on any reloaded thread |
| US-005 AC3 | SubagentBadge | Badge absent when no agent_name | PASS | Parent-agent messages correctly show no badge |
| US-006 AC1 | ChatMessages | SubagentBadge above assistant messages | **INCONCLUSIVE** | agent_name not present on checkpoint-reloaded messages |
| US-006 AC2 | ChatMessages | Left border on subagent messages | **INCONCLUSIVE** | Requires agent_name to trigger `isSubagent` check |
| US-006 AC3 | ChatMessages | Parent agent messages unchanged | PASS | Parent messages render normally with no extra UI |
| US-007 AC1 | ToolTimeline | "via {agent_name}" in tool header | **INCONCLUSIVE** | No "via" text found anywhere in DOM |
| US-007 AC2 | ToolTimeline | No "via" on parent-agent tool calls | PASS | Correctly absent |

**Why INCONCLUSIVE:** All existing threads were loaded from checkpoint data which does not persist `agent_name`. A live streaming session would be needed to fully validate US-005 AC2, US-006 AC1/AC2, and US-007 AC1. The code paths are structurally correct (verified via code review), but end-to-end visual validation requires a live subagent invocation.

### Screenshots Captured

| File | Description |
|------|-------------|
| `/tmp/cr-01-homepage.png` | App accessible, dark theme |
| `/tmp/cr-02-subagent-thread.png` | Thread with 3 parallel subagent calls -- no SubagentBadge visible |
| `/tmp/cr-06-fib-thread.png` | Single subagent thread -- no SubagentBadge visible |

---

## 4. Overall Recommendation

### **REQUEST CHANGES**

#### Must-Fix Before Merge (3 items)

1. **Fix 2 failing tests** in `format.test.ts`:
   - Test "should preserve agent_name on tool call messages": fix expected role from `"AIMessageChunk"` to `"tool_input"`
   - Both tests: propagate `agent_name` to tool_input messages in `formatMessages()` (format.ts:147-155)

2. **Split or acknowledge out-of-scope changes**: 14 files unrelated to the subagent attribution PRD are staged. Either move to separate branch/PR or explicitly acknowledge in PR description.

3. **Document or fix checkpoint persistence gap**: `agent_name` is lost on thread reload. Either:
   - Persist `agent_name` in `from_message_to_dict()` output that gets stored in the thread
   - Or add a `## Known Limitations` section to the PR description

#### Nice-to-Have (non-blocking)

- Extract shared `ToolMessage` interface from `ToolTimeline.tsx` / `ToolTimelineItem.tsx`
- Add `title={name}` attribute to SubagentBadge for accessibility
- Add backend unit tests for `_to_dict()` agent_name promotion
- Remove redundant `dict(msg)` call in `handle_multi_mode()` line 163
