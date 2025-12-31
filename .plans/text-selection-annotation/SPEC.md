# Text Selection Annotation Feature

## Overview

Add a floating annotation popover that appears when users highlight/select text in chat messages (`ChatMessages.tsx`). The popover provides a quick action to add the selected text as context to the chat input (`ChatInput.tsx`).

## Requirements

1. Detect text selection within chat message content
2. Show a small floating popover near the selection
3. Popover contains an "Add to Input" action button
4. Clicking the action appends/prepends the selected text to the ChatInput textarea
5. Popover dismisses when selection is cleared or action is taken

## Technical Analysis

### Existing Components & Patterns

| Component | Location | Purpose |
|-----------|----------|---------|
| `Popover` | `components/ui/popover.tsx` | Radix UI popover primitive |
| `ChatMessages` | `components/lists/ChatMessages.tsx` | Renders message list with virtualization |
| `ChatInput` | `components/inputs/ChatInput.tsx` | Text input with submit functionality |
| `ChatContext` | `context/ChatContext.tsx` | Shared chat state including `query`, `setQuery` |

### Key Observations

1. **ChatContext** already exposes `setQuery` which can be used to update the input
2. **Popover** component uses Radix UI with `PopoverAnchor` for custom positioning
3. **ChatMessages** uses `@tanstack/react-virtual` for virtualization - selection handling must work with virtual items
4. **Message** component is memoized - new props will need to be added to the comparison function

### Implementation Approach

Use the browser's `Selection` API to:
1. Detect when text is selected (`selectionchange` event)
2. Get selection coordinates for popover positioning
3. Extract selected text content

Create a new `TextSelectionPopover` component that:
1. Listens for selection changes within the chat messages container
2. Calculates position based on selection bounding rect
3. Uses Radix Popover with `PopoverAnchor` for precise positioning
4. Calls `setQuery` from ChatContext to add text to input

## Architecture

```
ChatMessages.tsx
    |
    +-- TextSelectionPopover (new component)
    |       |
    |       +-- useTextSelection (new hook)
    |       |
    |       +-- Popover (existing ui/popover.tsx)
    |
    +-- useChatContext.setQuery (update input)
```

## File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `hooks/useTextSelection.ts` | NEW | Custom hook for text selection detection |
| `components/popovers/TextSelectionPopover.tsx` | NEW | Floating annotation component |
| `components/lists/ChatMessages.tsx` | MODIFY | Integrate TextSelectionPopover |
| `context/ChatContext.tsx` | MODIFY | Add `appendToQuery` helper function |

## Implementation Details

### 1. useTextSelection Hook

```typescript
// Returns: { selectedText, selectionRect, clearSelection }
// - selectedText: string | null
// - selectionRect: DOMRect | null (for positioning)
// - clearSelection: () => void
```

Features:
- Debounced selection detection to avoid flicker
- Only activates for selections within a specified container ref
- Returns bounding rectangle for popover positioning
- Handles edge cases (empty selection, selection outside container)

### 2. TextSelectionPopover Component

Props:
- `containerRef`: Reference to the messages container
- `onAddToInput`: Callback when "Add to Input" is clicked

Behavior:
- Positioned absolutely based on selection coordinates
- Shows only when valid text is selected
- Contains "Quote" or "Add to Input" button with icon
- Animates in/out using Radix animations

### 3. ChatMessages Integration

- Wrap message content area with a ref
- Pass ref to TextSelectionPopover
- Handle the `onAddToInput` callback to update query

### 4. ChatContext Enhancement

Add helper to prepend quoted text to query:
```typescript
const appendToQuery = (text: string) => {
  setQuery((prev) => prev ? `${prev}\n\n> ${text}` : `> ${text}`);
};
```

## UI/UX Considerations

1. **Popover Position**: Appear above the selection, centered horizontally
2. **Z-Index**: Must be above virtualized content (z-50 or higher)
3. **Mobile**: May need touch-based selection handling
4. **Accessibility**: Include proper ARIA labels
5. **Theme**: Use existing design tokens (bg-popover, text-popover-foreground)

## Edge Cases

1. Selection spans multiple messages - use only the visible selected text
2. Selection within code blocks - preserve formatting
3. Very long selections - truncate in popover display, use full text when adding
4. Virtual scrolling - selection may become invalid when items unmount

---

## Implementation Checklist

- [ ] Create `frontend/src/hooks/useTextSelection.ts` hook
- [ ] Create `frontend/src/components/popovers/TextSelectionPopover.tsx` component
- [ ] Add `appendToQuery` helper to `frontend/src/hooks/useChat.ts`
- [ ] Integrate TextSelectionPopover into `frontend/src/components/lists/ChatMessages.tsx`
- [ ] Test text selection on AI message responses
- [ ] Test text selection on human messages
- [ ] Test selection across virtualized boundaries
- [ ] Verify mobile touch selection works
- [ ] Run frontend tests (`npm run test`)
