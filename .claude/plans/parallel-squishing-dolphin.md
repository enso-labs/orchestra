# Plan: Minimize Monaco Reloads on Thread Switch

## Context

Every time a user selects a different thread from the sidebar, all Monaco editor instances in the conversation unmount and remount. A typical thread has 5-20+ tool calls, each rendering a full Monaco editor instance via `DefaultTool` for read-only JSON/markdown display. This causes:

- Monaco CDN scripts to be re-validated (NetworkFirst caching strategy)
- Hundreds of DOM nodes per editor instance to be destroyed and recreated
- Visible UI jank during thread transitions

The root cause: `DefaultTool` uses the full Monaco Editor (`@monaco-editor/react`) just to display read-only snippets -- the heaviest code editor available used as a glorified `<pre>` tag.

## Approach: Replace Monaco with Lightweight Syntax Highlighter in Chat Messages

`react-syntax-highlighter` with Prism is **already installed and bundled** (used by `MarkdownCard.tsx`). Reusing it adds zero additional bundle cost.

### Step 1: Modify `DefaultTool` to use `react-syntax-highlighter`

**File:** `frontend/src/components/tools/Default.tsx`

Replace the Monaco `Editor` import with `SyntaxHighlighter` from `react-syntax-highlighter`, following the exact pattern from `MarkdownCard.tsx` (lines 4-8, 42-48):

```tsx
// Replace:
import Editor from "@monaco-editor/react";

// With:
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
```

Keep all existing content/language/height derivation logic (lines 17-62) unchanged. Only replace the render output:

```tsx
// Replace the <Editor .../> JSX with:
<SyntaxHighlighter
  style={theme === "light" ? oneLight : oneDark}
  language={language}
  wrapLongLines={true}
  customStyle={{
    margin: 0,
    fontSize: "11px",
    maxHeight: height,
    overflow: "auto",
    borderRadius: "0.375rem",
  }}
>
  {content}
</SyntaxHighlighter>
```

### Step 2: Verify no breaking changes

- `DefaultTool` props interface (`selectedToolMessage`, `collapsed`) stays the same
- Consumers (`ChatMessages.tsx` line 171, `ToolTimelineItem.tsx` line 88) need zero changes
- Visual output: Prism's `oneDark`/`oneLight` closely match Monaco's `vs-dark`/`light` themes

### Step 3: Verify build

Run `npm run build` to confirm:
- Monaco chunk is no longer pulled into the chat message rendering path
- Bundle size for chat path decreases significantly
- No build errors

### Optional Future Enhancements (not in this PR)

1. **Lazy-load Monaco for FileEditorPanel** - Use `React.lazy()` for `MonacoEditor` component
2. **Configure Monaco loader for local bundles** - Eliminate CDN dependency for remaining Monaco usages
3. **Change PWA caching** to `CacheFirst` for Monaco scripts (versions are pinned)

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/tools/Default.tsx` | Replace Monaco with SyntaxHighlighter |

## Files for Reference (no changes needed)

| File | Why |
|------|-----|
| `frontend/src/components/cards/MarkdownCard.tsx` | Pattern to follow for SyntaxHighlighter usage |
| `frontend/src/components/lists/ChatMessages.tsx` | Consumer - verify no breaking changes |
| `frontend/src/components/timeline/ToolTimelineItem.tsx` | Consumer - verify no breaking changes |
| `frontend/src/components/inputs/MonacoEditor.tsx` | Unchanged - still used for interactive editing |
| `frontend/src/components/panels/FileEditorPanel.tsx` | Unchanged - legitimate Monaco use case |

## Verification

1. `npm run build` -- no errors, Monaco chunk not loaded on chat path
2. `npm run test` -- existing tests pass
3. Manual: switch between 3+ threads rapidly -- no Monaco network requests in DevTools
4. Manual: expand tool outputs in chat -- JSON is syntax-highlighted correctly
5. Manual: verify FileEditorPanel still works with full Monaco (split view mode)
6. Manual: verify light/dark theme switching works for tool output highlighting
