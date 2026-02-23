# Spec 001: Backend Schema Extension

## Objective
Add `default_model_visibility` field to the `UserSettings` entity and extend the API request/response schemas.

## Files Modified
- `backend/src/schemas/entities/settings.py`

## Changes

### `UserSettings` entity
Add field:
```python
default_model_visibility: Optional[list[str]] = Field(
    default=None,
    description="User's list of enabled model identifiers for the model selector"
)
```

### `DefaultsResponse`
Add field:
```python
model_visibility: Optional[list[str]] = None
```

### `PatchDefaultsRequest`
Add field:
```python
model_visibility: Optional[list[str]] = Field(
    default=None,
    description="List of enabled model IDs for visibility, or null to clear"
)
```

## Validation
- Field accepts `null` (clear/reset to defaults) or a list of model ID strings.
- No validation on model ID format — frontend sends `provider:model` strings.

## Tests
- Unit test that `UserSettings` accepts the new field.
- Unit test that `PatchDefaultsRequest` serializes correctly with `model_visibility`.
