# Spec 003: Frontend Hook Migration

## Objective
Replace localStorage-based `useModelVisibility` with backend API calls via React Query.

## Files Modified
- `frontend/src/hooks/useModelVisibility.ts`
- `frontend/src/hooks/useModelVisibility.test.ts`

## Changes

### `useModelVisibility` hook
1. **Fetch**: Use React Query to `GET /settings` and extract `defaults.model_visibility`.
2. **Fallback**: If `model_visibility` is `null` (no backend data), use `DEFAULT_ENABLED_MODELS`.
3. **Migration**: On first load, if backend returns `null` AND localStorage has data, PATCH the localStorage values to the backend, then clear the localStorage key.
4. **Toggle**: On toggle, compute new list and `PATCH /settings/default` with `{ model_visibility: newList }`. Optimistic update via React Query.
5. **Remove**: All `localStorage.getItem`/`setItem` calls for `orchestra_model_visibility`.

### Hook API (unchanged)
```ts
{
  enabledModels: string[];
  toggleModelVisibility: (modelId: string) => void;
  isModelVisible: (modelId: string) => boolean;
  isLoading: boolean; // NEW — for loading state
}
```

### Test updates
- Mock API calls instead of localStorage.
- Test migration path: localStorage exists + backend null → PATCH called → localStorage cleared.
- Test default fallback when backend returns null and no localStorage.
- Test toggle calls PATCH with updated list.
