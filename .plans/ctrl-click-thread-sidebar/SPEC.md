# Ctrl+Click Thread Sidebar Feature

## Problem Statement

In `frontend/src/components/drawers/app-sidebar.tsx`, the `ThreadItem` component currently uses a `<button>` element with an `onClick` handler that calls `handleThreadClick()`. This handler uses `navigate()` for navigation, which does not support Ctrl+Click (or Cmd+Click on macOS) to open the thread in a new browser tab.

## Current Implementation

### ThreadItem Component (`app-sidebar.tsx:146-351`)

```tsx
const handleThreadClick = () => {
  // Navigate to thread route
  if (pathname.startsWith("/assistant/")) {
    navigate(`/assistant/${agent.id}/thread/${thread.value?.thread_id || thread.key}`);
  } else {
    navigate(`/thread/${thread.value?.thread_id || thread.key}`);
  }
  // Close sidebar on mobile
  if (isMobile) {
    setOpenMobile(false);
  }
};
```

The button element:
```tsx
<button
  onClick={handleThreadClick}
  className="flex items-start gap-2.5 w-full"
>
```

### useLinkClick Hook (`hooks/useLinkClick.tsx`)

This existing hook already handles the Ctrl/Cmd+Click pattern:

```tsx
const handleClick = useCallback(
  (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    if (event.ctrlKey || event.metaKey) {
      // Open in new tab if Ctrl or Cmd key pressed
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      // Normal navigation within app
      navigate(url);
    }
  },
  [navigate, url],
);
```

## Solution

Modify `handleThreadClick` in `ThreadItem` to check for `event.ctrlKey` or `event.metaKey` and open in a new tab when detected, similar to the `useLinkClick` hook pattern.

## Technical Approach

### Option A: Inline Event Check (Recommended)
Modify `handleThreadClick` to accept the click event and check for modifier keys. This is the simplest approach and keeps the logic self-contained.

**Pros:**
- Minimal code changes
- No additional hook dependencies
- Maintains existing mobile sidebar close logic

### Option B: Use useLinkClick Hook
Refactor to use the existing `useLinkClick` hook.

**Cons:**
- The hook returns a static URL handler, but thread URLs are dynamic (depend on the thread being clicked)
- Would require restructuring the component or creating multiple hook instances
- Doesn't easily integrate with the mobile sidebar close logic

## Implementation Details

### Changes to `app-sidebar.tsx`

1. Update `handleThreadClick` function signature to accept the click event
2. Add modifier key detection at the start of the function
3. Use `window.open()` for new tab when Ctrl/Cmd is pressed
4. Skip mobile sidebar close when opening in new tab

### Code Change

```tsx
const handleThreadClick = (event: React.MouseEvent<HTMLButtonElement>) => {
  // Build the thread URL
  const threadUrl = pathname.startsWith("/assistant/")
    ? `/assistant/${agent.id}/thread/${thread.value?.thread_id || thread.key}`
    : `/thread/${thread.value?.thread_id || thread.key}`;

  // Check for Ctrl/Cmd+Click to open in new tab
  if (event.ctrlKey || event.metaKey) {
    window.open(threadUrl, "_blank", "noopener,noreferrer");
    return;
  }

  // Normal navigation within app
  navigate(threadUrl);

  // Close sidebar on mobile
  if (isMobile) {
    setOpenMobile(false);
  }
};
```

Update the button's onClick:
```tsx
<button
  onClick={handleThreadClick}
  className="flex items-start gap-2.5 w-full"
>
```

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/drawers/app-sidebar.tsx` | Update `handleThreadClick` in `ThreadItem` component |

## Testing

1. Normal click on thread item -> navigates within app
2. Ctrl+Click on thread item -> opens in new browser tab
3. Cmd+Click on thread item (macOS) -> opens in new browser tab
4. Mobile: tap on thread item -> navigates and closes sidebar
5. Verify thread URLs work correctly for both `/thread/:id` and `/assistant/:agentId/thread/:id` routes

---

## Implementation Checklist

- [ ] Update `handleThreadClick` function to accept click event parameter
- [ ] Add modifier key detection (`event.ctrlKey || event.metaKey`)
- [ ] Extract thread URL construction to a variable for reuse
- [ ] Add `window.open()` call for new tab navigation when modifier key detected
- [ ] Early return after opening new tab to skip mobile sidebar logic
- [ ] Test normal click navigation
- [ ] Test Ctrl+Click opens new tab
- [ ] Test Cmd+Click opens new tab (macOS)
- [ ] Test mobile sidebar closes on normal navigation
