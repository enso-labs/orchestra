# PRD: Fix #815 — Streaming JSON Tool Call Validation & PR Cleanup

## Introduction

PR #816 addressed issue #815 (tool call args show "Error parsing JSON" during streaming) by replacing the error catch block with a `SyntaxHighlighter` fallback. However, a code review identified four flaws that must be resolved before the PR can be merged:

1. **Screenshots do not validate the actual fix** — all 3 screenshots show tool calls with `null` args, not incomplete JSON streaming
2. **Code duplication** — `JsonView` block is copy-pasted twice; wrapper div repeated 5 times
3. **Unrelated `.gitignore` change** included in the PR
4. **Binary screenshot PNGs committed to the repo** instead of uploaded to GitHub PR comments

## Goals

- Produce a screenshot proving the `SyntaxHighlighter` fallback renders incomplete JSON during streaming (the core fix)
- Eliminate code duplication in `Default.tsx` by extracting a shared `JsonView` renderer
- Remove unrelated `.gitignore` change from the PR
- Remove committed screenshot PNGs from the repo; re-upload as GitHub PR comment attachments
- Ensure all existing tests continue to pass

## User Stories

### US-001: Refactor Default.tsx to eliminate code duplication
**Description:** As a developer, I want `Default.tsx` to have a single `JsonView` render block so the component stays maintainable.

**Acceptance Criteria:**
- [ ] `JsonView` with its props (`collapsed`, `onCopied`, `shortenTextAfterLength`, `style`) appears exactly ONCE in `Default.tsx`
- [ ] All existing behavior preserved: objects render via `JsonView`, valid JSON strings parse then render via `JsonView`, incomplete JSON falls back to `SyntaxHighlighter`, null/empty falls back to `null` text
- [ ] The wrapper `<div className="max-h-[100px] rounded overflow-x-auto">` appears exactly ONCE (wrap the entire return)
- [ ] All 10 existing `DefaultTool.test.tsx` tests pass
- [ ] `make format` passes (frontend prettier + lint)

### US-002: Remove unrelated .gitignore change from PR
**Description:** As a reviewer, I want the PR to contain only changes related to the #815 bug fix so the diff is clean.

**Acceptance Criteria:**
- [ ] `.gitignore` is reverted to its state on the `development` base branch
- [ ] `git diff development -- .gitignore` returns empty

### US-003: Remove committed screenshot PNGs from repo
**Description:** As a developer, I want binary screenshots removed from the git history of this branch so they don't bloat the repo.

**Acceptance Criteria:**
- [ ] Files `.claude/screenshots/815-*.png` are deleted from the branch
- [ ] The deletion is committed

### US-004: Capture screenshot proving SyntaxHighlighter fallback works during streaming
**Description:** As a reviewer, I want to see a screenshot of incomplete JSON args rendered with syntax highlighting (not a red error) so the fix is visually validated.

**Acceptance Criteria:**
- [ ] Use `agent-browser` in `--headed` mode to navigate to `/chat`
- [ ] Send a query that triggers a tool call with JSON arguments (e.g., ask a question to an assistant with `execute_code` or `search_engine` tools enabled — these produce args like `{"code": "..."}` or `{"query": "..."}`)
- [ ] Capture a screenshot **during streaming** that shows partial/incomplete JSON args rendered as syntax-highlighted text in the tool input area — NOT `null`, NOT a red error
- [ ] If the tool call args stream too fast to catch mid-stream, use the `execute_code` tool with a long code block prompt (e.g., "write a Python script that...") which produces args with a large `code` field that streams character-by-character over multiple seconds
- [ ] Upload screenshot(s) as GitHub PR comment image attachments (NOT committed to repo)
- [ ] Update PR body to reference the uploaded screenshot(s)
- [ ] Verify in browser using agent-browser skill

### US-005: Capture screenshot showing completed tool call with valid JSON args
**Description:** As a reviewer, I want to see the completed state where `JsonView` renders the fully-parsed JSON args.

**Acceptance Criteria:**
- [ ] After the streaming from US-004 completes, take a screenshot showing the tool input with fully-rendered `JsonView` (collapsed interactive JSON)
- [ ] Upload screenshot as GitHub PR comment image attachment
- [ ] Verify in browser using agent-browser skill

## Functional Requirements

- FR-1: `Default.tsx` must have a single `JsonView` component with shared props, not duplicated blocks
- FR-2: The component must handle 4 input states: (a) already-parsed object, (b) valid JSON string, (c) incomplete JSON string, (d) null/empty — with a clear conditional flow
- FR-3: Incomplete JSON strings must render via `SyntaxHighlighter` with `language="json"`, theme-aware styling, and transparent background
- FR-4: The PR diff must not include unrelated changes (`.gitignore`, binary PNGs)
- FR-5: PR body must include at least 2 screenshots: one showing incomplete JSON streaming, one showing completed JSON rendering

## Non-Goals

- No changes to `message.ts` (the stream handler) — the fix is purely in the rendering component
- No changes to backend streaming logic
- No new test cases beyond the existing 10 (the refactor should not change behavior)
- No changes to `ToolTimelineItem.tsx` or `ChatMessages.tsx`

## Technical Considerations

### Key Files

| File | Role |
|------|------|
| `frontend/src/components/tools/Default.tsx` | The component being fixed — renders tool call args |
| `frontend/src/lib/utils/message.ts` | Stream handler that passes `input` as string (incomplete) or object (complete) |
| `frontend/src/tests/components/DefaultTool.test.tsx` | Regression tests for the component |
| `frontend/src/components/cards/MarkdownCard.tsx` | Reference for `SyntaxHighlighter` usage pattern |
| `backend/src/constants/mock.py` | Shows exact SSE chunk format for tool_call_chunks |

### Streaming Data Flow

1. Backend sends `tool_call_chunks` with partial args: `{"`, `city`, `":"`, `Dallas`, `"}`
2. `message.ts:toolCall()` accumulates `state.args += chunk.args`
3. Tries `JSON.parse(state.args)` — fails mid-stream, keeps as string
4. Creates `tool_input` message with `input: "{\\"city\\":\\"Dal"` (string)
5. `Default.tsx` receives string `input` → falls to catch → `SyntaxHighlighter`
6. On final chunk, `JSON.parse` succeeds → `input` becomes `{city: "Dallas"}` (object)
7. `Default.tsx` receives object `input` → `JsonView`

### Refactored Component Structure (Suggested)

```tsx
// Single wrapper + shared JsonView renderer
function renderJsonView(value, collapsed, theme, getJsonTheme) { ... }

// Main component: determine input type, delegate
if (typeof input === "object" && input != null) return wrapper(renderJsonView(input, ...))
if (typeof input === "string" && input) {
  try { return wrapper(renderJsonView(JSON.parse(input), ...)) }
  catch { return wrapper(<SyntaxHighlighter ...>{input}</SyntaxHighlighter>) }
}
return wrapper(<span>null</span>)
```

### Reproduction Strategy for Screenshots

The `execute_code` tool produces the longest args because its schema includes a `code: str` field. Prompt the LLM to write a long Python script to ensure the args stream spans multiple seconds:

```
Write a comprehensive Python script that generates the Fibonacci sequence,
calculates prime numbers up to 1000, sorts a large list using quicksort,
and prints performance benchmarks for each algorithm.
```

This forces the LLM to generate `{"code": "import time\n\ndef fibonacci(n):\n    ...very long code..."}` which streams character-by-character.

## Success Metrics

- PR #816 has at least 1 screenshot showing incomplete JSON rendered as syntax-highlighted text (not `null`, not red error)
- `Default.tsx` has exactly 1 `JsonView` instance and 1 wrapper div
- All 268+ frontend tests pass
- PR diff contains only `Default.tsx` and `DefaultTool.test.tsx` changes

## Open Questions

- Should we also add a visual indicator (e.g., a pulsing cursor or "streaming..." label) alongside the `SyntaxHighlighter` fallback to signal that args are still being received? (Deferred — out of scope for this fix)
