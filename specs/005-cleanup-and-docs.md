# Spec 005: Cleanup & Documentation

## Objective
Remove deprecated localStorage code and update documentation.

## Changes

### Cleanup
- Remove `STORAGE_KEY` constant from hook after migration logic is confirmed working.
- Remove migration code after a reasonable period (can be tracked as follow-up issue).

### Documentation
- Update wiki with new `model_visibility` field in settings API docs.
- Document migration behavior (localStorage → backend on first load).

### Final Validation
- All existing tests pass.
- New tests pass.
- E2E validated with agent-browser.
- Push all changes to branch for code review.
