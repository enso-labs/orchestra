# Plan: Add US-007 Bug Fix to Spec — Empty Model Crashes Subagent Init

## Context

After Ralph completed US-001 through US-004 (subagent persistence), a runtime error surfaced when submitting a query with persisted subagents:

```
TypeError: _init_chat_model_helper() missing 1 required positional argument: 'model'
```

**Root cause:** When a subagent has `model: ""` (empty string — the default from `useAgent.ts` initial state), the backend's `init_subagents()` guard `if getattr(subagent, "model", None) is not None` passes the empty string through. The deepagents library then calls `init_chat_model("")`, which fails because `_init_chat_model_helper` requires a non-empty model string.

**Three-part chain:**
1. Frontend sends `model: ""` for agents without an explicit model (default `INIT_AGENT_STATE`)
2. Pydantic `Assistant.model: Optional[str] = None` accepts `""` without normalization
3. `init_subagents()` only guards against `None`, not empty strings — so `""` gets injected into the subagent dict instead of falling back to `default_model`

## Steps

1. **Update `specs/persist-subagent-selection.md`** — Add US-007 user story after US-006:

### US-007: Fix empty model string crashes subagent initialization

- **Bug description:** Persisted subagents with `model: ""` cause `TypeError: _init_chat_model_helper() missing 1 required positional argument: 'model'` when query is submitted
- **Fix 1 (required):** `backend/src/agents/__init__.py` line 194 — change `is not None` to truthy check
- **Fix 2 (defensive):** `backend/src/schemas/entities/llm.py` — add `field_validator("model")` to normalize `""` to `None`

### Acceptance criteria:
- `init_subagents` guard changed from `is not None` to truthy check (`if getattr(subagent, "model", None):`)
- `Assistant` model field has a `field_validator` that coerces empty/whitespace strings to `None`
- Submitting a query with persisted subagents (no explicit model) succeeds without error
- Subagents without a model correctly inherit the parent agent's model
- Backend tests pass
- Format passes

2. **Add to Edge Cases table** — new row for "Subagent with model: empty string"

3. **Add to Files to Modify table** — the two fix files under "Subagent Persistence" section

### Files to modify

| File | Change |
|------|--------|
| `specs/persist-subagent-selection.md` | Add US-007, edge case row, files-to-modify entries |

### Critical source files (referenced in the spec, not modified by this plan)

| File | Line | Issue |
|------|------|-------|
| `backend/src/agents/__init__.py` | 194 | `is not None` lets `""` through — change to truthy check |
| `backend/src/schemas/entities/llm.py` | 85 | `model: Optional[str]` accepts `""` — add field_validator |
| `frontend/src/hooks/useAgent.ts` | 21 | `model: ""` initial state is the source of empty strings (no change needed) |

## Verification

- Spec has US-007 with testable acceptance criteria
- Edge case "subagent with empty model string" documented
- Files to modify table includes both fix files
- Root cause analysis included in the technical implementation guide
