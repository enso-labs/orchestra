# Spec 006: Streaming & AG-UI Protocol Compatibility

## Objective
Ensure Orchestra's existing streaming setup is compatible with CopilotKit's AG-UI protocol.

## Files to Review/Modify
- `backend/src/utils/stream.py` — current streaming implementation
- CopilotKit runtime route — may need SSE/WebSocket adapter

## Investigation
1. Check how Orchestra currently streams responses (SSE? WebSocket? HTTP chunks?)
2. Verify CopilotKit's `LangGraphAgent` adapter handles the streaming format
3. If incompatible, add an adapter layer in the runtime route

## Notes
- AG-UI is an open protocol for frontend-agent communication
- CopilotKit's `LangGraphAgent` adapter should handle standard LangGraph streaming
- May need to ensure the backend exposes a LangGraph-compatible streaming endpoint
- Test with both short responses and long streaming responses

## Tests
- Agent streams responses through CopilotKit protocol
- No dropped messages or broken streams
- Existing non-CopilotKit streaming still works
- Typecheck passes
