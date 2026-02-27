# Spec 004: Frontend UI Updates

## Objective
Handle loading/error states in the ModelVisibilitySettings component.

## Files Modified
- `frontend/src/components/settings/ModelVisibilitySettings.tsx`
- `frontend/src/components/lists/SelectModel.tsx` (minor, if needed)

## Changes

### `ModelVisibilitySettings`
- Add loading skeleton or spinner while `useModelVisibility` `isLoading` is true.
- Add error state if settings fetch fails.
- No structural changes — component already consumes hook correctly.

### `SelectModel`
- Should already work since hook API is unchanged.
- Verify it handles `isLoading` gracefully (show all models or skeleton while loading).

## Tests
- Visual verification via agent-browser that toggles persist across page reloads.
- E2E: toggle a model off → refresh → model stays off (backend-persisted).
