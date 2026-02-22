# Plan: Render Task Content with Monaco Editor on Epic Detail Page

## Context

The Epic Detail Page (`/epics/:id`) currently renders task descriptions as plain `<p>` text. The user wants each task's `description` content rendered using a read-only Monaco Editor, similar to the tool display component in `Default.tsx`. This provides syntax highlighting, scrollability, and a consistent read-only viewer experience.

## User Story

**As a user viewing the Epic page, I want to see task content rendered in a read-only Monaco Editor (similar to the Default.tsx tool display), defaulting to markdown content type, that is scrollable.**

### Acceptance Criteria
- Task descriptions render in a read-only Monaco Editor
- Editor defaults to markdown language
- Editor is scrollable but read-only (`readOnly: true`, `domReadOnly: true`)
- Editor is theme-aware (light/dark matching app theme)
- Empty descriptions show nothing (no blank editor)
- Verify in browser using `agent-browser` skill

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/pages/epics/EpicDetailPage.tsx` | Replace `<p>` description with Monaco Editor; import Editor and useTheme |

## Implementation

### Step 1: Update EpicDetailPage.tsx

In `EpicDetailPage.tsx`, replace the plain text description rendering (line ~272-274):

```tsx
{task.description && (
    <p className="text-xs text-muted-foreground">
        {task.description}
    </p>
)}
```

With a Monaco Editor block:

```tsx
{task.description && (
    <div style={{ height: Math.max(60, Math.min(task.description.split("\n").length * 18 + 10, 200)) }}>
        <Editor
            value={task.description}
            language="markdown"
            height={Math.max(60, Math.min(task.description.split("\n").length * 18 + 10, 200))}
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

Key differences from Default.tsx:
- **No content parsing** — task description is always a plain string, no JSON detection needed
- **Language fixed to `"markdown"`** — per requirements, defaults to markdown
- **Scrollbar vertical: `"auto"`** — visible when content overflows (scrollable requirement)
- **Max height: 200px** — slightly taller than Default.tsx collapsed (100px) since this is the primary content view

### Step 2: Add imports

Add to the imports section of `EpicDetailPage.tsx`:

```tsx
import Editor from "@monaco-editor/react";
import { useTheme } from "@/hooks/useTheme";
```

### Step 3: Wire up theme hook

Inside the `EpicDetailPage` component function, add:

```tsx
const { theme } = useTheme();
```

## Verification

1. `npx tsc --noEmit` from `frontend/` — typecheck passes
2. Use `agent-browser` skill to navigate to an epic with tasks and verify:
   - Monaco editors render for tasks with descriptions
   - Editors are read-only (typing is blocked)
   - Content is scrollable when it overflows
   - Theme matches (Day = light, Night = dark)
   - No blank editors for tasks without descriptions
   - No console errors
