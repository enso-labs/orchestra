# PROPOSAL_GUARDIAN.md
# GitHub Issue #658: Site Title Status Indicator

**Agent:** GUARDIAN (Security, Error Handling, Edge Cases, Testing)
**Date:** 2026-01-13
**Feature:** Bind `document.title` to agent/chat state to show status (idle, streaming, done) in browser tab

---

## 1. Executive Summary

This proposal analyzes the implementation of a dynamic browser tab title feature from the perspective of security, error handling, edge cases, and testing. The feature will update `document.title` based on the application's streaming state, providing visual feedback to users via the browser tab.

**Key Findings:**
- **Security Risk:** LOW - The feature uses controlled string literals only, eliminating XSS concerns
- **Error Handling:** MODERATE - Requires careful handling of undefined states and cleanup
- **Edge Cases:** MODERATE - Multiple scenarios require attention (multi-tab, rapid transitions, unmounting)
- **Testing:** STRAIGHTFORWARD - Can leverage existing Vitest infrastructure with document mocking

**Recommendation:** Proceed with implementation using a dedicated hook (`useDocumentTitle`) with comprehensive cleanup and defensive state handling.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**Loading State Flow:**
```
handleSubmit() in useChat.ts
    |
    v
setLoading(true) --> AppContext.loading = true
    |
    v
[SSE streaming events]
    |
    v
setLoading(false) --> AppContext.loading = false
```

**State Providers (from main.tsx):**
```
ThemeProvider
  └─ NuqsAdapter
       └─ AppProvider          <-- loading state lives here
            └─ AgentProvider
                 └─ ProjectProvider
                       └─ PromptProvider
                             └─ ChatProvider  <-- consumes/sets loading
                                   └─ AppRoutes
```

**Current Loading State Locations:**
1. `useAppHook.ts` (line 19): `const [loading, setLoading] = useState(false)`
2. `AppContext.tsx`: Provides loading state to entire app
3. `useChat.ts`: Sets loading true/false during SSE streaming

**Default Title (index.html line 15):**
```html
<title>Ruska AI - Orchestra</title>
```

### 2.2 State Machine Analysis

The loading state follows a binary pattern:
```
IDLE (loading=false) --> STREAMING (loading=true) --> DONE (loading=false)
```

However, we should model this as a tri-state for better UX:
```typescript
type TitleStatus = 'idle' | 'streaming' | 'done';
```

**Rationale for "done" state:** Users benefit from seeing a "done" indicator briefly after streaming completes, allowing them to notice completion when returning to the tab.

---

## 3. Implementation Strategy

### 3.1 Recommended Approach: Dedicated Hook

Create a new hook `useDocumentTitle.ts` that:
1. Subscribes to the loading state from AppContext
2. Manages title updates with proper cleanup
3. Handles the tri-state logic (idle -> streaming -> done -> idle)

**File Location:** `/frontend/src/hooks/useDocumentTitle.ts`

### 3.2 Proposed Hook Implementation

```typescript
import { useEffect, useRef } from "react";
import { useAppContext } from "@/context/AppContext";

const DEFAULT_TITLE = "Ruska AI - Orchestra";
const DONE_DISPLAY_DURATION_MS = 2000;

type TitleStatus = "idle" | "streaming" | "done";

interface TitleConfig {
  idle: string;
  streaming: string;
  done: string;
}

const TITLE_MAP: TitleConfig = {
  idle: DEFAULT_TITLE,
  streaming: `[Streaming...] ${DEFAULT_TITLE}`,
  done: `[Done] ${DEFAULT_TITLE}`,
};

export function useDocumentTitle(): void {
  const { loading } = useAppContext();
  const prevLoadingRef = useRef<boolean | undefined>(undefined);
  const doneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<TitleStatus>("idle");

  useEffect(() => {
    // Guard: Handle undefined loading state gracefully
    const isLoading = loading === true;
    const wasLoading = prevLoadingRef.current === true;

    // Cleanup any pending "done" timeout
    const clearDoneTimeout = () => {
      if (doneTimeoutRef.current !== null) {
        clearTimeout(doneTimeoutRef.current);
        doneTimeoutRef.current = null;
      }
    };

    // Determine new status
    let newStatus: TitleStatus;

    if (isLoading) {
      // Currently streaming
      clearDoneTimeout();
      newStatus = "streaming";
    } else if (wasLoading && !isLoading) {
      // Just finished streaming -> show "done" briefly
      clearDoneTimeout();
      newStatus = "done";

      // Schedule transition back to idle
      doneTimeoutRef.current = setTimeout(() => {
        statusRef.current = "idle";
        document.title = TITLE_MAP.idle;
        doneTimeoutRef.current = null;
      }, DONE_DISPLAY_DURATION_MS);
    } else {
      // Idle state (never loaded, or already transitioned)
      newStatus = statusRef.current === "done" ? "done" : "idle";
    }

    // Update title if status changed
    if (newStatus !== statusRef.current || prevLoadingRef.current === undefined) {
      statusRef.current = newStatus;
      document.title = TITLE_MAP[newStatus];
    }

    prevLoadingRef.current = isLoading;

    // Cleanup on unmount: restore default title
    return () => {
      clearDoneTimeout();
    };
  }, [loading]);

  // Final cleanup effect for component unmount
  useEffect(() => {
    return () => {
      document.title = TITLE_MAP.idle;
      if (doneTimeoutRef.current !== null) {
        clearTimeout(doneTimeoutRef.current);
      }
    };
  }, []);
}
```

### 3.3 Integration Point

The hook should be called from `AppProvider` to ensure:
1. Single instance of document.title management
2. Early mounting in component tree
3. Access to loading state

**Modification to AppContext.tsx:**

```typescript
import { useContext, createContext, useEffect } from "react";
import useAppHook from "@/hooks/useAppHook";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function AppProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const appHooks = useAppHook();

  useEffect(() => {
    appHooks.fetchAppVersion();
  }, []);

  return (
    <AppContext.Provider value={{ ...appHooks }}>
      <DocumentTitleManager />
      {children}
    </AppContext.Provider>
  );
}

// Separate component to access context after provider is established
function DocumentTitleManager() {
  useDocumentTitle();
  return null;
}
```

---

## 4. Design Decisions

### 4.1 Security Considerations

| Concern | Assessment | Mitigation |
|---------|------------|------------|
| XSS via document.title | NOT APPLICABLE | Only controlled string literals used; no user input |
| DOM manipulation | SAFE | `document.title` is a standard, safe API |
| Third-party scripts | LOW RISK | No external dependencies for this feature |

**Decision:** No sanitization required as title values are hardcoded string constants.

### 4.2 Error Handling Strategy

| Scenario | Handling |
|----------|----------|
| `loading` is undefined | Treat as `false` (idle state) |
| `loading` is null | Treat as `false` (idle state) |
| Context not available | Hook should throw clear error (standard context behavior) |
| Rapid loading toggles | Debounced via useEffect batching |
| Component unmount during stream | Cleanup restores default title |

**Defensive Code Pattern:**
```typescript
const isLoading = loading === true; // Strict equality handles undefined/null
```

### 4.3 Edge Case Analysis

#### Edge Case 1: Multiple Browser Tabs
**Scenario:** User has multiple Orchestra tabs open
**Behavior:** Each tab maintains independent title state
**Assessment:** CORRECT - Each React instance manages its own document.title
**Risk:** None - browsers handle tab titles independently

#### Edge Case 2: Rapid State Changes
**Scenario:** User submits query, immediately aborts, submits again
**Behavior:** Title transitions streaming -> idle -> streaming
**Assessment:** React's useEffect batching naturally handles this
**Risk:** LOW - may see brief flicker, acceptable UX

#### Edge Case 3: Component Unmounting During Stream
**Scenario:** User navigates away while streaming
**Behavior:** Cleanup effect restores default title
**Assessment:** Must ensure cleanup runs before component tree unmounts
**Risk:** MITIGATED by mounting hook in AppProvider (never unmounts)

#### Edge Case 4: Page Refresh During Stream
**Scenario:** User refreshes page while streaming
**Behavior:** HTML default title shown until React hydrates
**Assessment:** ACCEPTABLE - inherent to SPA architecture
**Risk:** None - standard behavior

#### Edge Case 5: "Done" Timeout During Navigation
**Scenario:** "Done" showing, user navigates, returns before timeout
**Behavior:** Timeout may fire in background if AppProvider persists
**Assessment:** ACCEPTABLE - AppProvider doesn't unmount on route change
**Risk:** None

#### Edge Case 6: Context Consumer Before Provider
**Scenario:** Hook called outside AppProvider
**Behavior:** `useAppContext()` returns empty object, loading undefined
**Assessment:** Handled by strict equality check
**Risk:** LOW - architectural constraint prevents this

---

## 5. Risk Assessment

### 5.1 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Title not updating | LOW | LOW | Comprehensive testing |
| Title stuck in wrong state | LOW | MEDIUM | Cleanup on unmount, timeout fallback |
| Memory leak from timeout | LOW | LOW | Proper cleanup in useEffect |
| Race condition with SSE | VERY LOW | LOW | React batching handles this |
| Breaking existing functionality | VERY LOW | MEDIUM | Isolated hook, no changes to loading logic |

### 5.2 Failure Modes and Recovery

**Failure Mode 1: Hook Never Runs**
- Detection: Title remains static
- Recovery: Check AppProvider mounting, verify context chain

**Failure Mode 2: Stuck in "Streaming" State**
- Detection: Title shows streaming after API error
- Recovery: Error handler in useChat.ts calls setLoading(false)
- Current Implementation: Lines 204, 213, 225 handle this

**Failure Mode 3: "Done" Never Transitions to "Idle"**
- Detection: Title stuck on "Done" after 2 seconds
- Recovery: setTimeout guaranteed execution unless tab backgrounded
- Browser Throttling Note: Browsers may throttle setTimeout in background tabs, which is acceptable

---

## 6. Testing Strategy

### 6.1 Test File Location

`/frontend/src/hooks/useDocumentTitle.test.ts`

### 6.2 Test Implementation

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDocumentTitle } from "./useDocumentTitle";
import React from "react";

// Mock AppContext
const mockLoadingState = { loading: false, setLoading: vi.fn() };

vi.mock("@/context/AppContext", () => ({
  useAppContext: () => mockLoadingState,
}));

describe("useDocumentTitle", () => {
  const ORIGINAL_TITLE = "Ruska AI - Orchestra";

  beforeEach(() => {
    vi.useFakeTimers();
    document.title = ORIGINAL_TITLE;
    mockLoadingState.loading = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.title = ORIGINAL_TITLE;
  });

  it("should not change title when idle on initial mount", () => {
    renderHook(() => useDocumentTitle());
    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  it("should show streaming indicator when loading is true", () => {
    mockLoadingState.loading = true;
    renderHook(() => useDocumentTitle());
    expect(document.title).toBe(`[Streaming...] ${ORIGINAL_TITLE}`);
  });

  it("should show done indicator when loading transitions from true to false", () => {
    mockLoadingState.loading = true;
    const { rerender } = renderHook(() => useDocumentTitle());

    expect(document.title).toBe(`[Streaming...] ${ORIGINAL_TITLE}`);

    mockLoadingState.loading = false;
    rerender();

    expect(document.title).toBe(`[Done] ${ORIGINAL_TITLE}`);
  });

  it("should return to idle title after done timeout", async () => {
    mockLoadingState.loading = true;
    const { rerender } = renderHook(() => useDocumentTitle());

    mockLoadingState.loading = false;
    rerender();

    expect(document.title).toBe(`[Done] ${ORIGINAL_TITLE}`);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  it("should handle undefined loading state gracefully", () => {
    mockLoadingState.loading = undefined;
    renderHook(() => useDocumentTitle());
    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  it("should handle null loading state gracefully", () => {
    mockLoadingState.loading = null;
    renderHook(() => useDocumentTitle());
    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  it("should restore default title on unmount", () => {
    mockLoadingState.loading = true;
    const { unmount } = renderHook(() => useDocumentTitle());

    expect(document.title).toBe(`[Streaming...] ${ORIGINAL_TITLE}`);

    unmount();

    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  it("should clear timeout on unmount", () => {
    mockLoadingState.loading = true;
    const { rerender, unmount } = renderHook(() => useDocumentTitle());

    mockLoadingState.loading = false;
    rerender();

    expect(document.title).toBe(`[Done] ${ORIGINAL_TITLE}`);

    unmount();

    expect(document.title).toBe(ORIGINAL_TITLE);

    // Advance timer to ensure no errors from cleared timeout
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  it("should cancel done timeout when new stream starts", () => {
    mockLoadingState.loading = true;
    const { rerender } = renderHook(() => useDocumentTitle());

    // Complete first stream
    mockLoadingState.loading = false;
    rerender();
    expect(document.title).toBe(`[Done] ${ORIGINAL_TITLE}`);

    // Start new stream before done timeout
    act(() => {
      vi.advanceTimersByTime(500);
    });

    mockLoadingState.loading = true;
    rerender();
    expect(document.title).toBe(`[Streaming...] ${ORIGINAL_TITLE}`);

    // Original timeout should not fire
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(document.title).toBe(`[Streaming...] ${ORIGINAL_TITLE}`);
  });

  it("should handle rapid loading state changes", () => {
    const { rerender } = renderHook(() => useDocumentTitle());

    // Rapid toggles
    for (let i = 0; i < 5; i++) {
      mockLoadingState.loading = true;
      rerender();
      mockLoadingState.loading = false;
      rerender();
    }

    // Should end in done state
    expect(document.title).toBe(`[Done] ${ORIGINAL_TITLE}`);

    // Should transition to idle after timeout
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(document.title).toBe(ORIGINAL_TITLE);
  });
});
```

### 6.3 Test Coverage Requirements

| Test Category | Coverage |
|---------------|----------|
| Happy path (idle -> streaming -> done -> idle) | YES |
| Edge case: undefined loading | YES |
| Edge case: null loading | YES |
| Edge case: rapid state changes | YES |
| Cleanup: unmount during stream | YES |
| Cleanup: timeout cancellation | YES |
| Memory leak prevention | YES (via timeout cleanup tests) |

---

## 7. Estimated Complexity

### 7.1 Implementation Effort

| Component | Complexity | Time Estimate |
|-----------|------------|---------------|
| `useDocumentTitle.ts` hook | LOW | 30 min |
| `AppContext.tsx` integration | LOW | 15 min |
| `useDocumentTitle.test.ts` tests | MEDIUM | 45 min |
| Manual testing | LOW | 15 min |

**Total Estimate:** 1.75 hours

### 7.2 Lines of Code

| File | LOC (estimated) |
|------|-----------------|
| `useDocumentTitle.ts` | ~60 |
| `AppContext.tsx` (changes) | ~10 |
| `useDocumentTitle.test.ts` | ~150 |

### 7.3 Risk-Adjusted Estimate

Adding 25% buffer for:
- Unexpected integration issues
- Additional edge case discovery
- CI/test environment differences

**Risk-Adjusted Total:** 2.25 hours

---

## 8. Recommendations

### 8.1 Implementation Order

1. Create `useDocumentTitle.ts` with full implementation
2. Create `useDocumentTitle.test.ts` with comprehensive tests
3. Run tests locally to verify
4. Integrate into `AppContext.tsx`
5. Manual browser testing
6. Run full test suite
7. Submit PR

### 8.2 Future Considerations

1. **Configurable Messages:** Consider making title prefixes configurable via props or constants file
2. **Favicon Animation:** Could extend to animated favicon during streaming (separate feature)
3. **Notification Badge:** Could show unread count for multi-conversation support
4. **Accessibility:** Screen readers may announce title changes - verify UX

### 8.3 Alternative Approaches Considered

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Inline in AppContext | Simpler | Less testable, clutters context | REJECTED |
| Separate component | Follows React patterns | Unnecessary complexity | REJECTED |
| Custom hook (chosen) | Testable, reusable, clean | Slightly more files | ACCEPTED |
| Modify useChat directly | Close to state source | Violates separation of concerns | REJECTED |

---

## 9. Conclusion

The Site Title Status feature is a low-risk, high-value enhancement that provides users with visual feedback about agent/chat state. The recommended implementation using a dedicated `useDocumentTitle` hook:

1. **Minimizes security risk** through controlled string literals
2. **Handles edge cases** with defensive coding and proper cleanup
3. **Is thoroughly testable** using the existing Vitest infrastructure
4. **Integrates cleanly** without modifying core loading state logic

The GUARDIAN assessment recommends proceeding with implementation following the outlined strategy.

---

**Document Version:** 1.0
**Status:** Complete
**Next Steps:** Implementation by development team
