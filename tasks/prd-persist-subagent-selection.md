# PRD: Persist Subagent Selection (#803-A)

## Introduction

Subagent selections in the "Manage Tools" modal are ephemeral -- they're lost on page refresh. Tools, MCP servers, and A2A agents all persist correctly via `PATCH /settings/default`, but subagents are stored only in React state. This PRD adds the same persistence pattern for subagents so users don't have to re-select their preferred subagents every session.

## Goals

- Persist subagent selections to the backend via the existing `PATCH /settings/default` endpoint
- Restore saved subagent selections on app startup without manual re-selection
- Follow the same debounced persistence pattern used by tools (`useToolSelection`)
- Handle race conditions between agents list loading and settings loading
- Ensure unauthenticated users are unaffected (no errors, no hidden API calls)

## User Stories

### US-001: Persist subagent selections across sessions
**Description:** As a user viewing the subagents tab of the Manage Tools modal, I want my subagent selections to be saved automatically so that I don't have to re-select my preferred subagents every time I refresh the page or start a new session.

**Acceptance Criteria:**
- [ ] When I toggle a subagent on/off, the selection is persisted to the backend via `PATCH /settings/default` within 500ms (debounced)
- [ ] When I reload the page, my previously selected subagents are restored
- [ ] The persistence uses agent IDs (strings), not full agent objects
- [ ] A toast error appears if the save fails: "Failed to save subagent defaults"
- [ ] Selecting/deselecting subagents updates both local state AND the backend
- [ ] Typecheck passes (`npx tsc --noEmit` from `frontend/`)
- [ ] Lint passes (`npm run lint` from `frontend/`)

### US-002: Load saved subagent defaults on app start
**Description:** As a returning user, I want my saved subagent selections to be loaded when the app starts so that my chat sessions include my preferred subagents without manual re-selection.

**Acceptance Criteria:**
- [ ] On app mount, `GET /settings` returns `defaults.subagents` as a list of agent IDs
- [ ] The returned IDs are resolved against the loaded agents list to populate `agent.subagents` with full `Agent` objects
- [ ] If a saved agent ID no longer exists (agent was deleted), it is silently filtered out -- no error shown
- [ ] If the agents list hasn't loaded yet when settings arrive, resolution is deferred until agents are available (race condition handled)
- [ ] The subagent badges/indicators in the UI reflect the loaded defaults
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill

### US-003: Subagents field in settings API
**Description:** As a developer, I need the `/settings/default` API to support a `subagents` field so that subagent defaults can be stored and retrieved alongside tools, MCP, and A2A configs.

**Acceptance Criteria:**
- [ ] `PATCH /settings/default` accepts `{ "subagents": ["agent-id-1", "agent-id-2"] }` and returns 200 with the IDs
- [ ] `PATCH /settings/default` accepts `{ "subagents": null }` to clear the selection
- [ ] `GET /settings` returns `{ "defaults": { "subagents": ["agent-id-1", ...], ... } }`
- [ ] Fresh users get `defaults.subagents: null` (not an empty list)
- [ ] Patching `subagents` does NOT affect other defaults (model, tools, mcp, a2a)
- [ ] The `subagents` field stores a flat list of string IDs (not nested agent objects)
- [ ] Backend tests pass (`make test`)
- [ ] Format passes (`make format`)

### US-004: Unauthenticated users are unaffected
**Description:** As an unauthenticated user, I want the subagents tab to remain hidden so that no persistence is attempted and no errors occur.

**Acceptance Criteria:**
- [ ] The "subagents" tab is not visible for unauthenticated users (existing behavior, no change needed)
- [ ] No `patchDefaults` calls are made for subagents when unauthenticated
- [ ] No errors appear in the console related to subagent persistence for unauthenticated users
- [ ] Verify in browser using agent-browser skill (test as logged-out user)

## Functional Requirements

- FR-1: Add `default_subagents: Optional[list[str]]` field to `UserSettings`, `DefaultsResponse`, and `PatchDefaultsRequest` Pydantic models in `backend/src/schemas/entities/settings.py`
- FR-2: Add `"subagents": "default_subagents"` entry to `_DEFAULTS_FIELD_MAP` in `backend/src/repos/user_settings_repo.py`
- FR-3: Add `subagents=settings.default_subagents` to `_build_response` in `backend/src/routes/v0/settings.py`
- FR-4: Add `subagents: string[] | null` to `DefaultsResponse` interface and `patchDefaults` parameter type in `frontend/src/lib/services/userSettingsService.ts`
- FR-5: Create `useSubagentSelection` hook in `frontend/src/components/modals/ToolSelectionModal/hooks/useSubagentSelection.ts` mirroring `useToolSelection` with debounced persistence, auth guard, and flush on close
- FR-6: Modify settings loading in `frontend/src/components/menus/BaseToolMenu.tsx` to extract and resolve `defaults.subagents` against the agents list
- FR-7: Wire `useSubagentSelection` hook into `ToolSelectionModal/index.tsx`, replacing direct `useAgentContext()` calls for subagent toggle/selection

## Non-Goals

- No changes to the SubagentsPanel component UI (props interface already matches)
- No changes to `attach_tool_details()` or backend tool tags
- No migration needed -- `default_subagents` uses the existing JSONB settings column
- No batch select/deselect for subagents (out of scope for this PR)
- No changes to how tools, MCP, or A2A persistence works

## Technical Considerations

- **Storage format:** Store as `list[str]` of agent IDs (not full objects). Mirrors how `default_tools` stores tool name strings. Prevents stale data when agent details change.
- **Race condition:** Settings may load before agents list. Store pending IDs in state, resolve reactively via a `useEffect` watching `[agents, pendingSubagentIds]`.
- **Debounce pattern:** Reuse the same 500ms debounce + `flushPersist()` on modal close pattern from `useToolSelection`.
- **No validation needed:** Unlike sandbox (which validates against an enum), subagent IDs are free-form strings. Invalid IDs are silently filtered during resolution.
- **Existing JSONB column:** `user_settings` table already stores defaults as JSONB. Adding `default_subagents` requires no migration -- Pydantic `default=None` handles missing keys.

### Key Files

| File | Change |
|------|--------|
| `backend/src/schemas/entities/settings.py` | Add `default_subagents` to 3 models |
| `backend/src/repos/user_settings_repo.py` | Add field mapping entry |
| `backend/src/routes/v0/settings.py` | Add to response builder |
| `frontend/src/lib/services/userSettingsService.ts` | Add `subagents` to types |
| `frontend/src/components/modals/ToolSelectionModal/hooks/useSubagentSelection.ts` | **NEW** hook |
| `frontend/src/components/modals/ToolSelectionModal/hooks/__tests__/useSubagentSelection.test.ts` | **NEW** test |
| `frontend/src/components/menus/BaseToolMenu.tsx` | Load + resolve defaults |
| `frontend/src/components/modals/ToolSelectionModal/index.tsx` | Wire hook |

### Testing

**Backend tests:**
| Test | File |
|------|------|
| `test_patch_default_subagents` -- PATCH with subagents returns 200 | `backend/tests/unit/routes/test_settings_routes.py` |
| `test_patch_clear_subagents` -- PATCH with null clears field | `backend/tests/unit/routes/test_settings_routes.py` |
| `test_get_settings_empty` -- verify `defaults.subagents` is null for fresh users | `backend/tests/unit/routes/test_settings_routes.py` |
| `test_patch_defaults_subagents` -- patching persists IDs | `backend/tests/unit/repos/test_user_settings_repo.py` |
| `test_patch_defaults_subagents_clear` -- patching with None clears | `backend/tests/unit/repos/test_user_settings_repo.py` |

**Frontend tests:**
| Test | File |
|------|------|
| Initialize with provided IDs | `hooks/__tests__/useSubagentSelection.test.ts` |
| Toggle on/off updates state and calls persist | `hooks/__tests__/useSubagentSelection.test.ts` |
| Debounced persistence (500ms delay) | `hooks/__tests__/useSubagentSelection.test.ts` |
| Clear selection empties state | `hooks/__tests__/useSubagentSelection.test.ts` |
| Auth guard skips patchDefaults when unauthenticated | `hooks/__tests__/useSubagentSelection.test.ts` |
| Filter missing agents silently | `hooks/__tests__/useSubagentSelection.test.ts` |

### Manual Validation (curl)

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "test1234"}' | jq -r '.access_token')

# Set default subagents
curl -X PATCH http://localhost:8000/api/settings/default \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subagents": ["agent-id-1", "agent-id-2"]}'

# Verify persisted
curl -X GET http://localhost:8000/api/settings \
  -H "Authorization: Bearer $TOKEN"

# Clear subagents
curl -X PATCH http://localhost:8000/api/settings/default \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subagents": null}'
```

## Success Metrics

- Subagent selections persist across page refreshes with zero data loss
- No increase in API call volume (debounced, same pattern as tools)
- No console errors for unauthenticated users
- Settings load time unaffected (single GET, no additional requests)

## Open Questions

- None -- spec is fully defined. All edge cases documented in `specs/persist-subagent-selection.md`.
