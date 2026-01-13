# Architectural Proposal: Site Title Status Indicator

**Feature:** GitHub Issue #658: FEAT: Site Title Provide Status of idle|stream|done for tab
**Author:** AGENT_1: ARCHITECT
**Date:** 2026-01-13
**Status:** Draft

---

## 1. Executive Summary

This proposal outlines the implementation strategy for dynamically updating the browser tab title to reflect the current chat/agent status (idle, streaming, done). The feature enhances user experience by providing visual feedback in the browser tab, particularly useful when users have multiple tabs open.

### Key Recommendations

1. **Create a new `useDocumentTitle` hook** that encapsulates all document title logic
2. **Derive status from existing `loading` state** in AppContext rather than introducing new state
3. **Implement a state machine approach** with three states: `idle`, `streaming`, `done`
4. **Place the hook invocation at the App level** for global effect
5. **Follow established codebase patterns** for hooks and testing

### Estimated Effort

- **Complexity:** Low-Medium
- **Files Changed:** 3-4 files
- **Estimated Time:** 2-4 hours including tests

---

## 2. Architectural Analysis

### 2.1 Current State Architecture

The frontend uses a layered context architecture for state management:

```
main.tsx
  ThemeProvider
    NuqsAdapter
      AppProvider          <- Global loading state lives here
        AgentProvider
          ProjectProvider
            PromptProvider
              ChatProvider <- Streaming logic lives here
                AppRoutes
```

#### Key State Flow

1. **`useAppHook.ts`** defines the global `loading` state:
   ```typescript
   const [loading, setLoading] = useState(false);
   ```

2. **`useChat.ts`** controls the loading state during SSE streaming:
   ```typescript
   // On submit
   setLoading(true);

   // On stream close/error/abort
   setLoading(false);
   ```

3. **`AppContext.tsx`** exposes the hook values to the entire app:
   ```typescript
   const appHooks = useAppHook();
   return (
     <AppContext.Provider value={{ ...appHooks }}>
       {children}
     </AppContext.Provider>
   );
   ```

### 2.2 Document Title Current State

- Default title set in `index.html`: `"Ruska AI - Orchestra"`
- No dynamic title management exists currently
- Title includes an emoji (feather) which should be preserved

### 2.3 State Transition Model

The three status states can be derived as follows:

```
                 +------------------+
                 |                  |
                 v                  |
    [IDLE] ---> [STREAMING] ---> [DONE] ---> [IDLE]
      ^             |               |           ^
      |             |               |           |
      +-------------+---------------+-----------+
            (timeout or new session)
```

| State | Condition | Title Format |
|-------|-----------|--------------|
| `idle` | `loading === false` AND (no recent completion OR timeout elapsed) | `Ruska AI - Orchestra` |
| `streaming` | `loading === true` | `Streaming... - Ruska AI` |
| `done` | `loading` transitions `true -> false` | `Done! - Ruska AI` |

---

## 3. Implementation Strategy

### 3.1 Proposed Architecture

Create a dedicated hook that:
1. Subscribes to the `loading` state from AppContext
2. Tracks state transitions to detect completion
3. Manages `document.title` side effects
4. Implements a timeout to return to idle state after "done"

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  useDocumentTitle()                      ││
│  │  ┌──────────────┐    ┌──────────────┐    ┌────────────┐ ││
│  │  │ useAppContext│ -> │ Status Logic │ -> │ useEffect  │ ││
│  │  │   loading    │    │ idle/stream/ │    │ doc.title  │ ││
│  │  │              │    │ done         │    │            │ ││
│  │  └──────────────┘    └──────────────┘    └────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 3.2 File Structure

```
frontend/src/
├── hooks/
│   ├── useDocumentTitle.ts          # NEW: Main hook implementation
│   └── useDocumentTitle.test.ts     # NEW: Unit tests (co-located)
├── App.tsx                          # MODIFY: Add hook invocation
└── lib/
    └── config/
        └── index.ts                 # OPTIONAL: Add title constants
```

### 3.3 Implementation Details

#### 3.3.1 New Hook: `useDocumentTitle.ts`

```typescript
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "@/context/AppContext";

export type TitleStatus = "idle" | "streaming" | "done";

const DEFAULT_TITLE = "Ruska AI - Orchestra";
const DONE_TIMEOUT_MS = 3000; // Return to idle after 3 seconds

interface UseDocumentTitleOptions {
  defaultTitle?: string;
  doneTimeout?: number;
}

export function useDocumentTitle(options: UseDocumentTitleOptions = {}) {
  const { defaultTitle = DEFAULT_TITLE, doneTimeout = DONE_TIMEOUT_MS } = options;
  const { loading } = useAppContext();

  const [status, setStatus] = useState<TitleStatus>("idle");
  const prevLoadingRef = useRef<boolean>(loading);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Derive status from loading state transitions
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (loading) {
      // Started streaming
      setStatus("streaming");
    } else if (wasLoading && !loading) {
      // Completed streaming -> show "done" briefly
      setStatus("done");
      timeoutRef.current = setTimeout(() => {
        setStatus("idle");
      }, doneTimeout);
    }
    // If !wasLoading && !loading, status remains as-is (idle or done transitioning)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [loading, doneTimeout]);

  // Update document.title based on status
  useEffect(() => {
    switch (status) {
      case "streaming":
        document.title = `Streaming... - Ruska AI`;
        break;
      case "done":
        document.title = `Done! - Ruska AI`;
        break;
      case "idle":
      default:
        document.title = defaultTitle;
        break;
    }

    // Cleanup: restore default title on unmount
    return () => {
      document.title = defaultTitle;
    };
  }, [status, defaultTitle]);

  return { status };
}
```

#### 3.3.2 Modify: `App.tsx`

```typescript
import { Outlet } from "react-router-dom";
import { QueryParamProvider } from "use-query-params";
import { ReactRouter6Adapter } from "use-query-params/adapters/react-router-6";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function App() {
  // Bind document.title to chat/streaming status
  useDocumentTitle();

  return (
    <QueryParamProvider adapter={ReactRouter6Adapter}>
      <Outlet />
    </QueryParamProvider>
  );
}
```

#### 3.3.3 Test File: `useDocumentTitle.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDocumentTitle } from "./useDocumentTitle";

// Mock AppContext
const mockLoading = { current: false };
vi.mock("@/context/AppContext", () => ({
  useAppContext: () => ({ loading: mockLoading.current }),
}));

describe("useDocumentTitle", () => {
  const originalTitle = document.title;

  beforeEach(() => {
    vi.useFakeTimers();
    mockLoading.current = false;
    document.title = "Ruska AI - Orchestra";
  });

  afterEach(() => {
    vi.useRealTimers();
    document.title = originalTitle;
  });

  it("should have idle status initially", () => {
    const { result } = renderHook(() => useDocumentTitle());
    expect(result.current.status).toBe("idle");
    expect(document.title).toBe("Ruska AI - Orchestra");
  });

  it("should change to streaming status when loading becomes true", () => {
    const { result, rerender } = renderHook(() => useDocumentTitle());

    mockLoading.current = true;
    rerender();

    expect(result.current.status).toBe("streaming");
    expect(document.title).toBe("Streaming... - Ruska AI");
  });

  it("should change to done status when loading transitions to false", () => {
    mockLoading.current = true;
    const { result, rerender } = renderHook(() => useDocumentTitle());

    mockLoading.current = false;
    rerender();

    expect(result.current.status).toBe("done");
    expect(document.title).toBe("Done! - Ruska AI");
  });

  it("should return to idle after timeout", () => {
    mockLoading.current = true;
    const { result, rerender } = renderHook(() =>
      useDocumentTitle({ doneTimeout: 1000 })
    );

    mockLoading.current = false;
    rerender();

    expect(result.current.status).toBe("done");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.status).toBe("idle");
    expect(document.title).toBe("Ruska AI - Orchestra");
  });

  it("should restore default title on unmount", () => {
    mockLoading.current = true;
    const { unmount, rerender } = renderHook(() => useDocumentTitle());
    rerender();

    expect(document.title).toBe("Streaming... - Ruska AI");

    unmount();

    expect(document.title).toBe("Ruska AI - Orchestra");
  });
});
```

---

## 4. Design Decisions

### 4.1 Why a Dedicated Hook?

| Option | Pros | Cons |
|--------|------|------|
| **Dedicated `useDocumentTitle` hook** | Clean separation, reusable, testable, follows codebase patterns | Adds a new file |
| Extend `useAppHook` | Keeps related state together | Violates single responsibility, harder to test |
| Inline in App.tsx | Simple | Not reusable, mixes concerns |

**Decision:** Dedicated hook - aligns with existing patterns (`useTheme`, `useModel`, etc.)

### 4.2 Why Track Transitions?

The `done` state requires detecting when `loading` transitions from `true` to `false`. Options:

| Option | Pros | Cons |
|--------|------|------|
| **Track previous value with useRef** | Simple, no additional state | Requires careful cleanup |
| Add explicit `streamComplete` event | Explicit, event-driven | Requires modifying useChat.ts |
| Use external state machine lib | Robust | Overkill for simple state |

**Decision:** useRef-based transition detection - minimal changes, proven pattern

### 4.3 Why App.tsx Placement?

The hook could be placed at different levels:

| Location | Scope | Consideration |
|----------|-------|---------------|
| **App.tsx** | Global | Always active, simple |
| Layout component | Per-layout | More complex, unnecessary |
| Chat page only | Chat only | Misses other streaming contexts |

**Decision:** App.tsx - ensures consistent behavior across all routes

### 4.4 Title Format Decisions

| Status | Format | Rationale |
|--------|--------|-----------|
| idle | `Ruska AI - Orchestra` | Original title preserved |
| streaming | `Streaming... - Ruska AI` | Status prefix for visibility |
| done | `Done! - Ruska AI` | Celebratory feedback |

The status prefix pattern ensures the status is visible even with many tabs (browser truncates right side).

### 4.5 Timeout Duration

The `done` state persists for 3 seconds before returning to `idle`:
- Long enough for user to notice completion
- Short enough to not feel stale
- Configurable via options for flexibility

---

## 5. Risk Assessment

### 5.1 Low Risk Items

| Risk | Mitigation |
|------|------------|
| Breaking existing title | Hook restores default on unmount |
| Memory leak (timeouts) | Proper cleanup in useEffect |
| SSR compatibility | N/A - Vite SPA, document always available |

### 5.2 Medium Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| Multiple streaming sources | Title could flicker | Single source of truth (AppContext loading) already aggregated |
| Race conditions with rapid start/stop | Brief incorrect status | useRef tracks actual transitions |

### 5.3 Edge Cases to Handle

1. **Page navigation during streaming**: Hook cleanup restores title
2. **Multiple rapid submissions**: Each new submission resets to streaming
3. **Error during stream**: Stream error handlers already set `loading = false`, triggering "done"
4. **Tab becomes inactive**: Title updates still work (browser behavior)

---

## 6. Estimated Complexity

### 6.1 Implementation Breakdown

| Task | Complexity | Time Estimate |
|------|------------|---------------|
| Create `useDocumentTitle.ts` | Low | 30-45 min |
| Create `useDocumentTitle.test.ts` | Low | 45-60 min |
| Modify `App.tsx` | Trivial | 5 min |
| Manual testing | Low | 15-30 min |
| Code review iterations | Low | 30 min |

**Total Estimate:** 2-4 hours

### 6.2 Complexity Score

| Dimension | Score (1-5) | Notes |
|-----------|-------------|-------|
| Code Changes | 2 | Few files, small changes |
| State Management | 2 | Leverages existing state |
| Testing | 2 | Standard hook testing |
| Risk | 1 | Isolated feature, easy rollback |
| Dependencies | 1 | No new dependencies |

**Overall Complexity: LOW**

---

## 7. Implementation Checklist

### Phase 1: Core Implementation
- [ ] Create `/frontend/src/hooks/useDocumentTitle.ts`
- [ ] Implement status derivation from loading state
- [ ] Implement document.title side effect
- [ ] Handle cleanup and timeouts

### Phase 2: Integration
- [ ] Modify `/frontend/src/App.tsx` to invoke hook
- [ ] Verify hook has access to AppContext (it does - App is child of AppProvider)

### Phase 3: Testing
- [ ] Create `/frontend/src/hooks/useDocumentTitle.test.ts`
- [ ] Test idle state
- [ ] Test streaming state
- [ ] Test done state and timeout
- [ ] Test cleanup on unmount
- [ ] Run `npm run test` to verify all tests pass

### Phase 4: Validation
- [ ] Manual testing with dev server
- [ ] Verify title changes during actual chat streaming
- [ ] Test error scenarios
- [ ] Test page navigation during stream

---

## 8. Alternative Approaches Considered

### 8.1 Browser Notification API

Could use Notification API instead of/alongside title:
- **Rejected:** Requires permission, more intrusive, overkill for this use case

### 8.2 Favicon Animation

Could animate favicon to indicate status:
- **Future Enhancement:** Could complement title, but adds complexity

### 8.3 Explicit State in Context

Could add `streamStatus: 'idle' | 'streaming' | 'done'` to AppContext:
- **Rejected:** Derivable from `loading` transitions, would require modifying core context

---

## 9. Conclusion

This proposal recommends implementing a new `useDocumentTitle` hook that:

1. **Follows established patterns** in the codebase (dedicated hooks, co-located tests)
2. **Minimizes changes** by deriving state from existing `loading` boolean
3. **Provides clean separation** of document title concerns from core app logic
4. **Handles edge cases** through proper cleanup and transition tracking
5. **Is easily testable** with standard React Testing Library patterns

The implementation is low-risk, low-complexity, and provides a meaningful UX improvement for users managing multiple browser tabs.

---

## Appendix A: File Locations Reference

| File | Path | Action |
|------|------|--------|
| useDocumentTitle.ts | `/frontend/src/hooks/useDocumentTitle.ts` | CREATE |
| useDocumentTitle.test.ts | `/frontend/src/hooks/useDocumentTitle.test.ts` | CREATE |
| App.tsx | `/frontend/src/App.tsx` | MODIFY |
| useAppHook.ts | `/frontend/src/hooks/useAppHook.ts` | READ-ONLY (reference) |
| AppContext.tsx | `/frontend/src/context/AppContext.tsx` | READ-ONLY (reference) |
| useChat.ts | `/frontend/src/hooks/useChat.ts` | READ-ONLY (reference) |

## Appendix B: Context Provider Hierarchy

```
main.tsx
└── StrictMode
    └── ThemeProvider
        └── NuqsAdapter
            └── AppProvider ─────────────────┐
                └── AgentProvider            │
                    └── ProjectProvider      │
                        └── PromptProvider   │
                            └── ChatProvider │
                                └── AppRoutes
                                    └── App.tsx ◄── useDocumentTitle() reads from AppContext
```

The hook in `App.tsx` has access to `AppContext` because `App` is rendered inside `AppRoutes`, which is a child of `AppProvider`.
