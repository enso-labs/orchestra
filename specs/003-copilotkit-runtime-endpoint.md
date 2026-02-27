# Spec 003: Create CopilotKit Runtime Endpoint

## Summary
Create a CopilotKit runtime API endpoint. Since Orchestra frontend is Vite + React Router (not Next.js), the endpoint should be a FastAPI route in the backend.

## Changes

### Files
- `backend/src/routes/copilotkit.py` (NEW) — FastAPI route for CopilotKit runtime
- `backend/src/main.py` or router registration — include new route

### Details
1. Create `POST /api/copilotkit` endpoint
2. Use CopilotKit's `LangGraphAgent` adapter to connect to the existing deep agent
3. Handle AG-UI protocol (SSE/WebSocket streaming)
4. Ensure endpoint is authenticated consistent with existing API routes

## Acceptance Criteria
- [ ] `POST /api/copilotkit` endpoint exists and responds
- [ ] Connects to existing deep agent via `LangGraphAgent` adapter
- [ ] Streaming works via AG-UI protocol
- [ ] Authentication consistent with existing routes
- [ ] Typecheck passes
- [ ] Tests pass
