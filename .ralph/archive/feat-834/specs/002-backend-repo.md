# Spec 002: Backend Repo & Route Integration

## Objective
Wire the new `model_visibility` field through the existing `patch_defaults` flow.

## Files Modified
- `backend/src/repos/user_settings_repo.py`
- `backend/src/routes/v0/settings.py`

## Changes

### `UserSettingsRepo._DEFAULTS_FIELD_MAP`
Add mapping:
```python
"model_visibility": "default_model_visibility",
```

No other repo changes needed — `patch_defaults()` already iterates the map generically.

### `_build_response()` in routes
Add to `DefaultsResponse` construction:
```python
model_visibility=settings.default_model_visibility,
```

### Route endpoints
No new routes. Existing `GET /settings` and `PATCH /settings/default` handle the new field automatically via schema changes.

## Tests
- Integration test: PATCH `/settings/default` with `{"model_visibility": ["openai:gpt-5.2"]}` returns updated defaults.
- Integration test: GET `/settings` includes `model_visibility` in response.
- Test: PATCH with `{"model_visibility": null}` clears the value.
