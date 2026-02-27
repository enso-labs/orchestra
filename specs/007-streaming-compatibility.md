# Spec 007: Verify Streaming Compatibility

## Summary
Ensure AG-UI protocol streaming is compatible with Orchestra's existing SSE setup and that the existing `/api/llm/stream` path is unaffected.

## Changes

### Files
- `backend/src/utils/stream.py` — verify/adapt if needed
- Integration tests

### Details
1. Verify CopilotKit AG-UI streaming works alongside existing SSE format
2. Ensure `/api/llm/stream` continues to work as before
3. Test concurrent usage of both paths

## Acceptance Criteria
- [ ] AG-UI streaming works through `/api/copilotkit`
- [ ] Existing `/api/llm/stream` unaffected
- [ ] No regressions in current chat functionality
- [ ] Typecheck passes
- [ ] Tests pass
