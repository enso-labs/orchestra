# Replace DefaultTool with Monaco Editor

> Fixes [#815](https://github.com/ruska-ai/orchestra/issues/815): During streaming, tool_input JSON is incomplete and `JSON.parse()` in `DefaultTool` throws "Error parsing JSON" to the user. Monaco Editor treats content as text-in-a-file, so partial/incomplete JSON streams in gracefully with syntax highlighting and no validation errors.

## Approach

Rewrite `Default.tsx` to use `@monaco-editor/react` `Editor` directly (not the `MonacoEditor` wrapper, which carries editable-state and onChange logic). Only **one file** changes; both consumers continue working unchanged.

## File to Modify

- `frontend/src/components/tools/Default.tsx` - Replace `@uiw/react-json-view` with read-only Monaco Editor

## No Changes Needed

- `ChatMessages.tsx` - same `<DefaultTool>` usage
- `ToolTimelineItem.tsx` - same `<DefaultTool>` usage
- `package.json` - `@monaco-editor/react` already installed; keep `@uiw/react-json-view` (used by `ToolTestPanel.tsx`)

## Implementation Details

1. **Content preparation** (`useMemo`): Extract input from `message.args || message.input || message.content`. If already an object, `JSON.stringify(input, null, 2)`. If a string, try to pretty-print via parse+stringify; if parse fails (e.g. mid-stream incomplete JSON), **pass raw string through as-is** with `language="json"` so Monaco provides syntax highlighting without throwing errors.

2. **No JSON validation/error display**: The key fix - remove the `try/catch` + error UI. Monaco just renders whatever text it receives, like writing to a `.json` file.

3. **Dynamic height**: Based on line count of content
   - `collapsed=true` (tool results): clamp 60-100px
   - `collapsed=false` (tool inputs): clamp 60-300px
   - Formula: `lineCount * 18 + 10`

4. **Monaco options** (read-only display):
   - `readOnly: true`, `domReadOnly: true`
   - `minimap: false`, `lineNumbers: "off"`, `wordWrap: "on"`
   - `fontSize: 11`, `scrollBeyondLastLine: false`
   - `renderLineHighlight: "none"`, `contextmenu: false`
   - `folding: !collapsed`, minimal scrollbar

5. **Theme**: `theme === "light" ? "light" : "vs-dark"` (same pattern as `MonacoEditor.tsx`)

## Key Behavior Change

| Aspect | Before | After |
|---|---|---|
| Streaming JSON | "Error parsing JSON" shown | Partial JSON renders gracefully |
| Complete JSON | Tree view with collapse/expand | Pretty-printed text with syntax highlighting |
| Non-JSON | Error + raw content | Displayed as plaintext |
| Copy | Click-to-copy with alert | Standard Ctrl+C on selection |

## Verification

1. `cd frontend && npm run dev:claude`
2. Start a new chat, trigger a tool call (e.g. search query)
3. During streaming: confirm NO "Error parsing JSON" errors appear
4. After streaming completes: confirm pretty-printed JSON with syntax highlighting
5. Expand a tool result in timeline - confirm Monaco displays content
6. Toggle light/dark theme
7. Verify content is not editable
