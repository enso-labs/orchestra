# Plan: User Timezone Configuration in Settings

## Context

Currently, the frontend auto-detects the user's timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` and passes it as metadata on each chat request (`useChat.ts:114,586`). The backend already supports timezone in `init_system_prompt()` (`backend/src/utils/format.py:89-111`) to localize times for the AI. However, users have no way to override the browser-detected timezone. This feature adds a persistent timezone setting so users can explicitly choose their timezone.

## Approach

Follow the exact same pattern as existing settings (model, sandbox, onboarding_completed): add a field to the settings entity, expose it via the existing PATCH endpoint, and create a new `TimezoneSettings` component on the settings page.

## Changes

### 1. Backend: Add `timezone` field to settings entity

**File: `backend/src/schemas/entities/settings.py`**
- Add `default_timezone: Optional[str] = Field(default=None, description="User's preferred IANA timezone identifier")` to `UserSettings`
- Add `timezone: Optional[str] = None` to `DefaultsResponse`
- Add `timezone: Optional[str] = Field(default=None, description="IANA timezone identifier, or null to clear")` to `PatchDefaultsRequest`

### 2. Backend: Wire timezone through repo and route

**File: `backend/src/repos/user_settings_repo.py`**
- Add `"timezone": "default_timezone"` to `_DEFAULTS_FIELD_MAP` (line ~198)

**File: `backend/src/routes/v0/settings.py`**
- Add `timezone=settings.default_timezone` to the `DefaultsResponse()` constructor in `_build_response` (line ~26)

### 3. Frontend: Update service types and patchDefaults

**File: `frontend/src/lib/services/userSettingsService.ts`**
- Add `timezone: string | null` to `DefaultsResponse` interface
- Add `timezone: string | null` to `patchDefaults` data parameter type

### 4. Frontend: Create TimezoneSettings component

**File: `frontend/src/components/settings/TimezoneSettings.tsx`** (new)
- Card with searchable combobox (same pattern as DefaultModelSettings)
- Populate with `Intl.supportedValuesOf("timeZone")` for the full IANA timezone list
- Show current browser-detected timezone as placeholder/hint
- On select, call `patchDefaults({ timezone: value })`
- Clear button to revert to auto-detect (sends `null`)

### 5. Frontend: Add TimezoneSettings to settings page

**File: `frontend/src/pages/settings/index.tsx`**
- Import and render `<TimezoneSettings />` after `<DefaultModelSettings />`

### 6. Frontend: Use persisted timezone in chat metadata

**File: `frontend/src/hooks/useChat.ts`**
- On init and when building chat metadata, check if user has a saved timezone setting
- If set, use it instead of `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Load settings once and store in state (or leverage existing settings fetch if available)

## Files Modified

| File | Action |
|------|--------|
| `backend/src/schemas/entities/settings.py` | Edit - add timezone fields |
| `backend/src/repos/user_settings_repo.py` | Edit - add field mapping |
| `backend/src/routes/v0/settings.py` | Edit - include timezone in response |
| `frontend/src/lib/services/userSettingsService.ts` | Edit - add timezone to types |
| `frontend/src/components/settings/TimezoneSettings.tsx` | **New** - timezone picker component |
| `frontend/src/pages/settings/index.tsx` | Edit - add TimezoneSettings |
| `frontend/src/hooks/useChat.ts` | Edit - use saved timezone |

## Verification

1. **Backend**: `cd backend && make test` - ensure no regressions
2. **Frontend**: `cd frontend && npm run test` - ensure no regressions
3. **Manual API test**:
   ```bash
   # Set timezone
   curl -X PATCH http://localhost:8000/api/settings/default \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"timezone": "America/New_York"}'

   # Clear timezone
   curl -X PATCH http://localhost:8000/api/settings/default \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"timezone": null}'
   ```
4. **UI**: Visit settings page, verify timezone picker shows, select a timezone, refresh and confirm it persists
5. **Chat**: Send a message and verify the AI receives the correct timezone in its system prompt
