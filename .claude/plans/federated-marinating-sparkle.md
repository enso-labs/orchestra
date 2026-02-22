# Plan: Render Task Content with Monaco Editor on Epic Detail Page

## Context

The Epic Detail Page (`/epics/:id`) currently renders task descriptions as plain `<p>` text (see `.images/feat-813/01.png`). The descriptions contain structured markdown-like content (bullet points, checklists, multi-line instructions) that renders as a wall of unstyled text. Replacing with a read-only Monaco Editor provides syntax highlighting, proper scrollability, and a consistent viewer experience matching the tool display on the chat page.

## User Story

**As a user viewing the Epic page, I want to see task content rendered in a read-only Monaco Editor (similar to Default.tsx), defaulting to markdown content type, that is scrollable.**

### Acceptance Criteria
- Task descriptions render in a read-only Monaco Editor
- Editor defaults to markdown language
- Editor is scrollable but read-only (`readOnly: true`, `domReadOnly: true`)
- Editor is theme-aware (light/dark matching app theme)
- Max height capped at 200px to prevent oversized cards (scrollable beyond that)
- Empty descriptions render nothing (no blank editor)
- Verify in browser using `agent-browser` skill

## File to Modify

| File | Change |
|------|--------|
| `frontend/src/pages/epics/EpicDetailPage.tsx` | Replace `<p>` description with Monaco Editor; add imports for `Editor` and `useTheme` |

## Implementation

### Step 1: Add imports (EpicDetailPage.tsx)

```tsx
import Editor from "@monaco-editor/react";
import { useTheme } from "@/hooks/useTheme";
```

### Step 2: Add theme hook inside component

```tsx
const { theme } = useTheme();
```

### Step 3: Replace description `<p>` with Monaco Editor

Replace (line ~272-274):
```tsx
{task.description && (
    <p className="text-xs text-muted-foreground">
        {task.description}
    </p>
)}
```

With:
```tsx
{task.description && (
    <div style={{
        height: Math.max(60, Math.min(task.description.split("\n").length * 18 + 10, 200))
    }}>
        <Editor
            value={task.description}
            language="markdown"
            height={Math.max(60, Math.min(
                task.description.split("\n").length * 18 + 10, 200
            ))}
            theme={theme === "light" ? "light" : "vs-dark"}
            options={{
                readOnly: true,
                domReadOnly: true,
                minimap: { enabled: false },
                lineNumbers: "off",
                wordWrap: "on",
                fontSize: 11,
                scrollBeyondLastLine: false,
                renderLineHighlight: "none",
                contextmenu: false,
                folding: false,
                scrollbar: {
                    vertical: "auto",
                    horizontal: "hidden",
                    handleMouseWheel: true,
                },
            }}
        />
    </div>
)}
```

### Design Decisions (informed by screenshot)
- **Language: `"markdown"`** — descriptions contain bullet points, lists, structured content
- **Max height: 200px** — current plain text descriptions are very tall; capping prevents card bloat while allowing scroll
- **Min height: 60px** — minimum readable area
- **Scrollbar vertical: `"auto"`** — only shows when content overflows (unlike Default.tsx which hides scrollbars)
- **No JSON detection** — unlike Default.tsx, task descriptions are always plain text/markdown
- **No folding** — content should be fully visible within the scroll area

## Verification

1. `npx tsc --noEmit` from `frontend/` — typecheck passes
2. Use `agent-browser` to navigate to epic page (`localhost:5173/epics/ce9770f0-12f3-4f6f-a920-3cbaabff41e9`) and verify:
   - Monaco editors render for tasks with descriptions
   - Editors are read-only (typing blocked)
   - Content is scrollable when overflowing 200px
   - Theme matches (Day = light, Night/Dusk = dark)
   - No blank editors for empty descriptions
   - No console errors
