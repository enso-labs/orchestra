# PRD: Replace DefaultTool JSON Viewer with Monaco Editor

## Introduction

During streaming, tool_input JSON is incomplete and `JSON.parse()` in `DefaultTool` throws "Error parsing JSON" to the user (issue [#815](https://github.com/ruska-ai/orchestra/issues/815)). This replaces the `@uiw/react-json-view` tree viewer in `Default.tsx` with a read-only Monaco Editor that treats content as text, so partial/incomplete JSON streams in gracefully with syntax highlighting and no validation errors. This also upgrades the overall tool output display with consistent syntax highlighting and language auto-detection.

## Goals

- Eliminate "Error parsing JSON" errors during streaming by removing `JSON.parse()` from the render path
- Provide syntax-highlighted, read-only display of tool inputs/outputs using Monaco Editor
- Auto-detect content language (default to JSON, fall back to markdown for non-JSON content)
- Maintain identical external API (`selectedToolMessage` + `collapsed` props) so consumers require zero changes
- Dynamic height based on content length with sensible min/max clamping

## User Stories

### US-001: Replace JSON tree view with read-only Monaco Editor
**Description:** As a developer, I want to swap `@uiw/react-json-view` for a read-only `@monaco-editor/react` `Editor` in `Default.tsx` so that tool content renders as syntax-highlighted text without parse errors.

**Acceptance Criteria:**
- [ ] `Default.tsx` imports `Editor` from `@monaco-editor/react` directly (not the `MonacoEditor` wrapper)
- [ ] `@uiw/react-json-view` imports are removed from `Default.tsx`
- [ ] Editor is configured as read-only (`readOnly: true`, `domReadOnly: true`)
- [ ] Monaco options: `minimap: false`, `lineNumbers: "off"`, `wordWrap: "on"`, `fontSize: 11`, `scrollBeyondLastLine: false`, `renderLineHighlight: "none"`, `contextmenu: false`, minimal scrollbar
- [ ] Folding enabled when `collapsed=false`, disabled when `collapsed=true`
- [ ] Theme follows app theme: `theme === "light" ? "light" : "vs-dark"`
- [ ] Component export name and props interface unchanged
- [ ] Typecheck passes (`npx tsc --noEmit` from frontend/)
- [ ] Lint passes (`npm run lint` from frontend/)

### US-002: Content preparation with streaming-safe formatting
**Description:** As a user, I want tool content to display correctly whether it arrives as complete JSON, partial/streaming JSON, or non-JSON text, so I never see parse errors.

**Acceptance Criteria:**
- [ ] Content extracted from `message.args || message.input || message.content` (existing logic)
- [ ] If input is an object, `JSON.stringify(input, null, 2)` produces pretty-printed string
- [ ] If input is a string, attempt `JSON.parse` then `JSON.stringify(parsed, null, 2)` for pretty-printing
- [ ] If parse fails (e.g. mid-stream incomplete JSON), pass raw string through as-is
- [ ] Content preparation uses `useMemo` to avoid unnecessary recalculations
- [ ] No `try/catch` error UI is rendered &mdash; Monaco displays whatever text it receives

### US-003: Auto-detect language for syntax highlighting
**Description:** As a user, I want tool content to get appropriate syntax highlighting regardless of format, so JSON gets JSON highlighting and non-JSON gets markdown highlighting.

**Acceptance Criteria:**
- [ ] Default language is `"json"` when content looks like JSON (starts with `{`, `[`, or successfully parsed)
- [ ] Falls back to `"markdown"` for content that is clearly not JSON
- [ ] Language detection uses `useMemo` for efficiency
- [ ] Syntax highlighting renders correctly for both JSON and markdown content

### US-004: Dynamic height based on content and collapse state
**Description:** As a user, I want tool display areas to size appropriately based on content length, so short outputs are compact and long outputs are scrollable without wasting space.

**Acceptance Criteria:**
- [ ] Height formula: `lineCount * 18 + 10` pixels (based on content line count)
- [ ] When `collapsed=true` (tool results in timeline): clamp between 60px and 100px
- [ ] When `collapsed=false` (tool inputs in chat): clamp between 60px and 300px
- [ ] Height recalculates when content changes (via `useMemo`)

### US-005: Verify streaming and complete tool display
**Description:** As a user, I want to confirm the new display works end-to-end in both streaming and completed states.

**Acceptance Criteria:**
- [ ] Start a chat and trigger a tool call (e.g. search query)
- [ ] During streaming: NO "Error parsing JSON" errors appear
- [ ] After streaming completes: pretty-printed JSON with syntax highlighting displays
- [ ] Expand a tool result in timeline &mdash; Monaco displays content correctly
- [ ] Toggle light/dark theme &mdash; editor theme switches accordingly
- [ ] Content is not editable (read-only confirmed)
- [ ] **Verify in browser using agent-browser skill**

### US-006: Fix blank tool inputs on new chat page during streaming
**Description:** As a user, I want tool inputs to display their content on the `/chat` page (new chat, streaming path), so I can see what arguments the AI is passing to tools in real time &mdash; not blank dark rectangles.

**Acceptance Criteria:**
- [ ] Tool input content is visible in the Monaco editor on the `/chat` page during and after streaming
- [ ] Progressive streaming updates render incrementally as `tool_input` chunks arrive
- [ ] No regression on `/thread/:id` page &mdash; finalized tool inputs still display correctly
- [ ] State management is consistent: `in_mem_messages` data flows correctly into the rendered `DefaultTool` component
- [ ] `useMemo` in `Default.tsx` re-derives content when the underlying message object updates (not stale)
- [ ] Monaco editor receives a non-empty `value` prop whenever tool input data exists in the message
- [ ] No blank/empty editor frames when tool call data is present in the message store
- [ ] Verified in browser using agent-browser skill on both `/chat` and `/thread/:id` pages

**Investigation Areas:**
- `frontend/src/hooks/useChat.ts` &mdash; how `in_mem_messages` accumulates streaming tool call data vs `setMessages`/`setMessagesState`
- `frontend/src/lib/message.ts` &mdash; `parseToolCalls()` and `parseToolResults()` extraction logic for streaming chunks
- `frontend/src/components/tools/Default.tsx` &mdash; `useMemo` content derivation from `selectedToolMessage`
- `frontend/src/components/ChatMessages.tsx` &mdash; how messages are passed from chat state to tool display components

## Functional Requirements

- FR-1: Replace `@uiw/react-json-view` `JsonView` component with `@monaco-editor/react` `Editor` in `Default.tsx`
- FR-2: Remove `try/catch` + error UI rendering; Monaco renders raw text without validation
- FR-3: Prepare content via `useMemo`: stringify objects, pretty-print valid JSON strings, pass-through invalid/partial JSON strings as-is
- FR-4: Auto-detect language: default `"json"`, fall back to `"markdown"` when content does not appear to be JSON
- FR-5: Calculate editor height dynamically from line count, clamped by collapse state (60-100px collapsed, 60-300px expanded)
- FR-6: Apply read-only Monaco options: `readOnly`, `domReadOnly`, no minimap, no line numbers, word wrap on, font size 11, no context menu, folding only when expanded
- FR-7: Theme Monaco using the same `useTheme` pattern as existing `MonacoEditor.tsx`

## Non-Goals

- No changes to `ChatMessages.tsx` or `ToolTimelineItem.tsx` (consumers unchanged)
- No removal of `@uiw/react-json-view` from `package.json` (still used by `ToolTestPanel.tsx`)
- No editable state or `onChange` logic (this is strictly read-only display)
- No custom Monaco wrapper component &mdash; use `Editor` from `@monaco-editor/react` directly
- No changes to the existing `MonacoEditor.tsx` input component

## Technical Considerations

- `@monaco-editor/react` is already installed in the project; no new dependencies needed
- The existing `MonacoEditor.tsx` wrapper carries editable state and `onChange` logic that is unnecessary here &mdash; import `Editor` directly from the package instead
- Monaco Editor bundles are already loaded by other components, so no additional bundle size impact
- Theme detection follows the same `useTheme` hook pattern used throughout the app

## Success Metrics

- Zero "Error parsing JSON" errors during tool streaming
- Tool inputs/outputs display with syntax highlighting in under 100ms
- No regressions in existing tool display consumers (`ChatMessages`, `ToolTimelineItem`)

## Open Questions

- Should the editor show a loading/skeleton state when tool input content is empty during the initial streaming frames, or remain invisible until content arrives?
- Is the divergence between `in_mem_messages` (streaming accumulator) and `setMessages`/`setMessagesState` (React state) causing the blank editor &mdash; i.e., does the component receive an empty string while data exists only in the ref?
- Is Monaco Editor appropriate for rapidly-updating streaming content, or should a simpler `<pre>` fallback be used during active streaming and Monaco mounted only after the tool call completes?
