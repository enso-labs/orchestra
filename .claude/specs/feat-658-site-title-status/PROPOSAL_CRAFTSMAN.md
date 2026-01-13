# PROPOSAL: Site Title Status Indicator

**Agent:** CRAFTSMAN - Software Architect (Clean Code, Maintainability, SOLID Principles)
**Feature:** GitHub Issue #658: FEAT: Site Title Provide Status of idle|stream|done for tab
**Date:** 2026-01-13

---

## 1. Executive Summary

This proposal outlines a minimal, maintainable implementation for binding `document.title` to the agent/chat streaming state. The solution introduces a single-purpose hook (`useDocumentTitle`) that observes the global `loading` state and updates the browser tab title to reflect the current status: idle, streaming, or done.

**Key Design Principles Applied:**
- Single Responsibility Principle: One hook, one job
- Dependency Injection: Status derived from props/context
- Clean Code: Readable, minimal, no external dependencies

**Estimated Effort:** Low complexity (~2-4 hours including tests)

---

## 2. Architectural Analysis

### 2.1 Current State Architecture

The frontend follows a React Context-based state management pattern:

```
main.tsx
  └── ThemeProvider
        └── NuqsAdapter
              └── AppProvider (provides: loading, setLoading, ...)
                    └── AgentProvider
                          └── ProjectProvider
                                └── PromptProvider
                                      └── ChatProvider (consumes: setLoading from AppContext)
                                            └── AppRoutes
```

**Key State Flow:**
1. `useAppHook.ts` defines the global `loading` state (boolean)
2. `AppContext.tsx` provides `loading` and `setLoading` to the entire app
3. `useChat.ts` consumes `setLoading` from `AppContext` to control streaming state:
   - `handleSubmit()` calls `setLoading(true)` when starting a request
   - SSE handlers call `setLoading(false)` on completion, error, or abort

**Current Title:**
- Static title in `index.html`: `"Ruska AI - Orchestra"`

### 2.2 State Lifecycle Analysis

```
User sends message
       │
       ▼
handleSubmit()
       │
       ├──► setLoading(true)  ──────────────────┐
       │                                         │
       ▼                                         │
handleSSE() / streamThread()                     │
       │                                         │
       ├──► SSE "message" events                 │  loading = true
       │                                         │  (STREAMING)
       ├──► SSE "close" event                    │
       │         └──► setLoading(false) ─────────┤
       │                                         │
       ├──► SSE "error" event                    │
       │         └──► setLoading(false) ─────────┤
       │                                         │
       └──► AbortController "abort"              │
                 └──► setLoading(false) ─────────┘

                                         loading = false
                                         (IDLE / DONE)
```

### 2.3 Hook Pattern Analysis

The codebase follows consistent patterns for hooks:

| Hook | Pattern | Purpose |
|------|---------|---------|
| `useMediaQuery.ts` | Effect-based observer | Observes window state, returns derived value |
| `useTheme.ts` | Context consumer | Wraps context with type safety |
| `useChat.ts` | Complex state manager | Manages chat state, SSE, messages |

**Recommendation:** Follow the `useMediaQuery` pattern - a simple effect-based hook that observes state and produces side effects.

---

## 3. Implementation Strategy

### 3.1 Proposed Solution: `useDocumentTitle` Hook

Create a lightweight, reusable hook that updates `document.title` based on provided status.

**File Location:** `frontend/src/hooks/useDocumentTitle.ts`

```typescript
import { useEffect } from "react";

export type DocumentTitleStatus = "idle" | "streaming" | "done";

const BASE_TITLE = "Ruska AI - Orchestra";

const STATUS_PREFIXES: Record<DocumentTitleStatus, string> = {
  idle: "",
  streaming: "[...] ",
  done: "[Done] ",
};

/**
 * Updates the browser tab title based on streaming status.
 *
 * @param status - Current status: 'idle', 'streaming', or 'done'
 */
export function useDocumentTitle(status: DocumentTitleStatus): void {
  useEffect(() => {
    const prefix = STATUS_PREFIXES[status];
    document.title = `${prefix}${BASE_TITLE}`;

    // Cleanup: restore base title on unmount
    return () => {
      document.title = BASE_TITLE;
    };
  }, [status]);
}
```

### 3.2 Integration Point

**Option A: Integrate in `AppProvider` (Recommended)**

Add to `AppContext.tsx` where `loading` state originates:

```typescript
// In AppProvider component
const [hasCompletedOnce, setHasCompletedOnce] = useState(false);

// Derive status from loading state
const documentStatus: DocumentTitleStatus = loading
  ? "streaming"
  : hasCompletedOnce
    ? "done"
    : "idle";

// Track completion
useEffect(() => {
  if (!loading && messages.length > 0) {
    setHasCompletedOnce(true);
  }
}, [loading]);

useDocumentTitle(documentStatus);
```

**Option B: Integrate in `ChatProvider`**

Alternative if "done" state requires message context:

```typescript
// In ChatProvider component
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAppContext } from "@/context/AppContext";

// Inside ChatProvider:
const { loading } = useAppContext();
const { messages } = chatHooks;

const documentStatus = loading
  ? "streaming"
  : messages.length > 0
    ? "done"
    : "idle";

useDocumentTitle(documentStatus);
```

### 3.3 Status Derivation Logic

| Condition | Status | Title Display |
|-----------|--------|---------------|
| `loading === false && messages.length === 0` | `idle` | `Ruska AI - Orchestra` |
| `loading === true` | `streaming` | `[...] Ruska AI - Orchestra` |
| `loading === false && messages.length > 0` | `done` | `[Done] Ruska AI - Orchestra` |

### 3.4 File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/hooks/useDocumentTitle.ts` | **New** | Hook implementation |
| `frontend/src/context/ChatContext.tsx` | **Modify** | Add hook invocation |
| `frontend/src/tests/hooks/useDocumentTitle.test.ts` | **New** | Unit tests |

---

## 4. Design Decisions

### 4.1 Why a Separate Hook vs. Inline Effect?

| Approach | Pros | Cons |
|----------|------|------|
| **Separate hook** | Testable, reusable, SRP-compliant | Extra file |
| Inline effect | Fewer files | Not reusable, harder to test |

**Decision:** Separate hook. Aligns with codebase patterns (`useMediaQuery`, `useTheme`) and enables isolated testing.

### 4.2 Why Props-Based vs. Context Consumer?

| Approach | Pros | Cons |
|----------|------|------|
| **Props-based (status param)** | Flexible, testable, DI principle | Caller computes status |
| Context consumer | Self-contained | Tightly coupled, harder to test |

**Decision:** Props-based. The hook receives `status` as a parameter, making it framework-agnostic and easily testable with mock values.

### 4.3 Status Indicator Style Options

| Style | Example | Accessibility |
|-------|---------|---------------|
| `[...] Title` | `[...] Ruska AI - Orchestra` | ASCII-safe, clear |
| `Title (streaming)` | `Ruska AI - Orchestra (streaming)` | Verbose |
| Emoji prefix | (Avoided per CLAUDE.md guidelines) | N/A |

**Decision:** Bracket prefix `[...]` for streaming, `[Done]` for completion. Clean, recognizable, ASCII-safe.

### 4.4 "Done" State Timeout Consideration

**Option:** Auto-revert to "idle" after N seconds

```typescript
useEffect(() => {
  if (status === "done") {
    const timer = setTimeout(() => {
      document.title = BASE_TITLE; // revert to idle
    }, 5000);
    return () => clearTimeout(timer);
  }
}, [status]);
```

**Decision:** Defer to implementation phase. Start without auto-revert; can add if UX testing indicates need.

---

## 5. Risk Assessment

### 5.1 Low Risk

| Risk | Mitigation |
|------|------------|
| Title flicker on rapid state changes | React batches updates; negligible concern |
| Memory leak from effect | Cleanup function restores title on unmount |
| SSR/hydration mismatch | Effect only runs client-side (document API) |

### 5.2 Medium Risk

| Risk | Mitigation |
|------|------------|
| Title not updating if context not available | Integration in ChatProvider ensures context is available |
| Multiple hook instances | Single invocation point prevents conflicts |

### 5.3 Testing Strategy

1. **Unit Tests:** Test hook in isolation with `@testing-library/react-hooks`
2. **Integration:** Verify title changes during actual streaming flow
3. **Manual:** Check browser tab during streaming, completion, and idle states

---

## 6. Estimated Complexity

| Task | Effort | Notes |
|------|--------|-------|
| Create `useDocumentTitle.ts` | 30 min | ~20 LOC |
| Integrate in `ChatContext.tsx` | 30 min | Status derivation logic |
| Write unit tests | 1-2 hours | Test all status transitions |
| Manual verification | 30 min | Browser tab testing |
| **Total** | **2-4 hours** | Low complexity |

---

## 7. Implementation Checklist

- [ ] Create `frontend/src/hooks/useDocumentTitle.ts`
- [ ] Add type exports for `DocumentTitleStatus`
- [ ] Integrate hook in `ChatContext.tsx` or `ChatProvider`
- [ ] Derive status from `loading` and `messages.length`
- [ ] Write unit tests in `frontend/src/tests/hooks/useDocumentTitle.test.ts`
- [ ] Run `npm run test` to verify all tests pass
- [ ] Run `npm run format` for code formatting
- [ ] Manual browser testing for title updates
- [ ] Update `index.html` title if needed (currently has emoji, consider removing)

---

## 8. Alternative Approaches Considered

### 8.1 Global Document Title Manager

A more complex approach using a singleton or reducer pattern:

```typescript
// NOT RECOMMENDED - over-engineered for this use case
const documentTitleReducer = (state, action) => { ... };
```

**Rejected:** Violates KISS principle. Simple hook suffices.

### 8.2 Browser Notification API Integration

Extend feature to show desktop notifications on completion.

**Deferred:** Out of scope for Issue #658. Could be future enhancement.

### 8.3 Favicon Animation

Animate or change favicon during streaming.

**Deferred:** Separate feature; requires asset creation and more complex implementation.

---

## 9. Conclusion

The proposed `useDocumentTitle` hook provides a clean, maintainable solution that:

1. **Respects Single Responsibility:** One hook, one purpose
2. **Enables Testability:** Props-based design allows isolated testing
3. **Follows Existing Patterns:** Consistent with `useMediaQuery` and other hooks
4. **Minimizes Complexity:** ~20 lines of implementation code
5. **Provides Clear UX:** Browser tab indicates streaming status at a glance

The implementation is straightforward and can be completed within 2-4 hours, including comprehensive tests.

---

*Proposal prepared by CRAFTSMAN Agent - Clean Code, Maintainability, SOLID Principles*
