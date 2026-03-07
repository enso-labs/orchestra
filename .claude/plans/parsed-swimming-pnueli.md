# Plan: Fix Sandbox "State" Selection Still Using Daytona

## Context

**Bug**: User switches sandbox from "Daytona" to "State" in the UI, but the backend still executes commands in Daytona (confirmed by `pwd` returning `/home/daytona`).

**Root cause**: `toSandboxPatchValue("state")` in `frontend/src/lib/config/sandbox.ts:48-50` converts the default value to `null` before sending to the backend. The backend stores `default_sandbox = None`. Then `resolve_sandbox_backend(None)` in `backend/src/agents/__init__.py:332-340` treats `None` as "auto" — try Daytona first, fall back to State. So selecting "State" effectively becomes "Auto" behavior.

**Resolution path**: The frontend `toSandboxPatchValue` function should always send the literal string value (`"state"` or `"daytona"`), never `null`. This ensures the backend receives and stores `"state"` explicitly, and `resolve_sandbox_backend("state")` correctly routes to StateBackend without trying Daytona.

## Changes

### 1. Frontend: `frontend/src/lib/config/sandbox.ts`

**`toSandboxPatchValue()`** — always return the literal value, never `null`:
```typescript
// BEFORE (buggy):
export function toSandboxPatchValue(value: SandboxType): string | null {
    return value === DEFAULT_SANDBOX ? null : value;
}

// AFTER (fixed):
export function toSandboxPatchValue(value: SandboxType): string {
    return value;
}
```

### 2. Frontend: `frontend/src/components/status/ThreadSandboxStatus.test.tsx`

Update the test assertion that checks the PATCH payload:
```typescript
// BEFORE:
expect(mockPatchDefaults).toHaveBeenCalledWith({ sandbox: null });

// AFTER:
expect(mockPatchDefaults).toHaveBeenCalledWith({ sandbox: "state" });
```

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/lib/config/sandbox.ts` | `toSandboxPatchValue` always returns the literal string |
| `frontend/src/components/status/ThreadSandboxStatus.test.tsx` | Update expected PATCH payload from `null` to `"state"` |

## Verification

1. `cd frontend && npx vitest run src/components/status/ThreadSandboxStatus.test.tsx` — tests pass
2. `cd frontend && npm run test` — all tests pass
3. Manual: Set sandbox to "State" → run a command → `pwd` should NOT return `/home/daytona`
