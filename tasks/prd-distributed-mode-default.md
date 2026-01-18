# PRD: Default Architecture to Distributed Mode

## Introduction

Simplify the streaming architecture by consolidating to a single `/api/llm/stream` endpoint that defaults to distributed mode. The mode is controlled by the `DISTRIBUTED_WORKERS` environment variable:
- `DISTRIBUTED_WORKERS=True` (default): Distributed mode - tasks enqueued to TaskIQ, processed by workers, results streamed via Redis
- `DISTRIBUTED_WORKERS=False`: Sync mode - direct in-process execution with immediate SSE response

The recent refactoring introduced a separate `/api/llm/stream/distributed` endpoint, which added complexity without simplifying the system. This PRD restores the original unified approach while maintaining the scalable distributed architecture.

## Goals

- Single `/api/llm/stream` endpoint that handles both modes based on environment configuration
- Distributed mode as the default for production scalability
- Sync mode available for development/testing via `DISTRIBUTED_WORKERS=False`
- Remove the separate `/api/llm/stream/distributed` endpoint immediately (no migration period)
- Simplify frontend by removing mode-specific logic (frontend already adapts via HTTP status codes)
- Maintain backward compatibility with existing frontend behavior (200 for sync, 202 for distributed)
- Add health check endpoint that indicates which mode is active

## User Stories

### US-001: Unify Backend Stream Endpoint
**Description:** As a developer, I want a single stream endpoint that switches behavior based on environment configuration so that the API is simpler and more maintainable.

**Acceptance Criteria:**
- [ ] Single `/api/llm/stream` endpoint handles both modes
- [ ] When `DISTRIBUTED_WORKERS=True` (default): Returns HTTP 202 with `{"thread_id": "...", "poll_url": "..."}` and enqueues task
- [ ] When `DISTRIBUTED_WORKERS=False`: Returns HTTP 200 with SSE stream (direct execution)
- [ ] Remove `/api/llm/stream/distributed` endpoint entirely
- [ ] Environment variable is read from settings/config at startup
- [ ] Typecheck/lint passes
- [ ] Existing tests pass or are updated

### US-002: Update Environment Configuration
**Description:** As a DevOps engineer, I want the distributed mode to be the default so that production deployments are scalable out of the box.

**Acceptance Criteria:**
- [ ] `DISTRIBUTED_WORKERS` defaults to `True` when not set
- [ ] Update `.example.env` to show `DISTRIBUTED_WORKERS=True` as default with clear documentation
- [ ] Add comment explaining sync mode is for development only
- [ ] Document that workers must be running when `DISTRIBUTED_WORKERS=True`
- [ ] Typecheck/lint passes

### US-003: Simplify Frontend Stream Handling
**Description:** As a frontend developer, I want the frontend to work seamlessly with both modes without needing to know which mode is active so that the client code is simpler.

**Acceptance Criteria:**
- [ ] `initiateStream()` in `threadService.ts` continues to work (already handles 200 vs 202)
- [ ] Remove any references to `/llm/stream/distributed` endpoint
- [ ] Remove `DistributedStreamOptions.skipInitialDelay` logic if no longer needed
- [ ] Verify `handleSSEUnified()` in `useChat.ts` works correctly
- [ ] Legacy `handleSSE()` fallback can be removed if unified handler is stable
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Update Backend Controller Logic
**Description:** As a backend developer, I want the LLM controller to transparently handle mode switching so that the route handler remains clean.

**Acceptance Criteria:**
- [ ] `StreamingService` or controller checks `settings.DISTRIBUTED_WORKERS` at request time
- [ ] Mode-specific logic encapsulated in service layer, not route handler
- [ ] Shared request validation regardless of mode
- [ ] Consistent error handling for both modes
- [ ] Typecheck/lint passes

### US-005: Remove Distributed Endpoint from Backend Routes
**Description:** As a developer, I want the `/api/llm/stream/distributed` endpoint removed so that there's only one way to stream.

**Acceptance Criteria:**
- [ ] Remove `POST /api/llm/stream/distributed` route from `llm.py`
- [ ] Remove any related route registration
- [ ] Update any API documentation or OpenAPI schemas
- [ ] Ensure no frontend code references the removed endpoint
- [ ] Typecheck/lint passes

### US-006: Add Health Check Endpoint for Mode Status
**Description:** As a DevOps engineer, I want a health check endpoint that indicates which streaming mode is active so that I can verify deployments and debug issues.

**Acceptance Criteria:**
- [ ] Add `GET /api/health` or extend existing health endpoint
- [ ] Response includes `distributed_workers: true|false` field
- [ ] Response includes `redis_connected: true|false` when in distributed mode
- [ ] Response includes `worker_mode: "distributed"|"sync"` for clarity
- [ ] Endpoint is unauthenticated for monitoring tools
- [ ] Typecheck/lint passes

### US-007: Update Integration Tests
**Description:** As a QA engineer, I want tests to verify both modes work correctly through the unified endpoint so that we have confidence in the architecture.

**Acceptance Criteria:**
- [ ] Test sync mode: `DISTRIBUTED_WORKERS=False` → HTTP 200 + SSE stream
- [ ] Test distributed mode: `DISTRIBUTED_WORKERS=True` → HTTP 202 + polling
- [ ] Remove tests for `/api/llm/stream/distributed` endpoint
- [ ] Update test fixtures to use environment variable for mode switching
- [ ] Add tests for health check endpoint
- [ ] All existing streaming tests pass
- [ ] Typecheck/lint passes

### US-008: Update Frontend Integration Tests
**Description:** As a QA engineer, I want frontend tests updated to reflect the simplified architecture so that test coverage remains accurate.

**Acceptance Criteria:**
- [ ] Update `distributedStream.test.ts` if needed
- [ ] Verify `streamSource.test.ts` covers both modes
- [ ] Remove any tests for deprecated distributed endpoint
- [ ] All frontend tests pass
- [ ] Typecheck/lint passes

### US-009: Documentation Update
**Description:** As a developer, I want documentation updated to reflect the new architecture so that new team members understand the system.

**Acceptance Criteria:**
- [ ] Update any SPEC.md files referencing the old dual-endpoint approach
- [ ] Document the `DISTRIBUTED_WORKERS` environment variable clearly
- [ ] Add deployment guidance: "For production, ensure workers are running"
- [ ] Document the health check endpoint and its response format
- [ ] Update any architecture diagrams if present
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: The `/api/llm/stream` endpoint MUST check `DISTRIBUTED_WORKERS` setting to determine mode
- FR-2: When `DISTRIBUTED_WORKERS=True`, the endpoint MUST return HTTP 202 with JSON body `{"thread_id": "...", "poll_url": "/api/threads/{thread_id}/stream"}`
- FR-3: When `DISTRIBUTED_WORKERS=False`, the endpoint MUST return HTTP 200 with `text/event-stream` content type
- FR-4: The `/api/llm/stream/distributed` endpoint MUST be removed immediately
- FR-5: The frontend MUST work with either mode without code changes (via HTTP status detection)
- FR-6: The `DISTRIBUTED_WORKERS` environment variable MUST default to `True`
- FR-7: The system MUST log which mode is active at startup
- FR-8: Error responses MUST be consistent between modes (same error format)
- FR-9: A health check endpoint MUST expose the current worker mode and connectivity status

## Non-Goals

- No changes to the worker task implementation (`run_agent_stream`)
- No changes to Redis stream format or consumption logic
- No changes to the polling endpoint (`/api/threads/{thread_id}/stream`)
- No introduction of new streaming protocols or formats
- No changes to authentication or authorization logic
- No performance optimizations beyond removing redundant code
- No migration period for the removed endpoint

## Technical Considerations

### Backend Changes
- Modify `/backend/src/routes/v0/llm.py` to add mode switching logic
- Remove the distributed endpoint route immediately
- Use dependency injection or settings access to check `DISTRIBUTED_WORKERS`
- Consider using a factory pattern in `StreamingService` for mode selection
- Add or extend health check endpoint in `/backend/src/routes/`

### Frontend Changes (Minimal)
- The frontend `initiateStream()` already handles both 200 and 202 responses correctly
- May need to remove dead code referencing the distributed endpoint
- Clean up any mode-specific workarounds

### Configuration
- Keep existing name: `DISTRIBUTED_WORKERS` (plural)
- Change default from `false` to `True`

### Health Check Response Format
```json
{
  "status": "healthy",
  "worker_mode": "distributed",
  "distributed_workers": true,
  "redis_connected": true,
  "version": "1.0.0"
}
```

### Backward Compatibility
- The HTTP response contract (200 for sync, 202 for distributed) remains unchanged
- Frontend code that already works will continue to work
- No breaking changes to external consumers

## Success Metrics

- Single endpoint serves both modes correctly based on environment variable
- Zero code changes required in frontend to support mode switching
- Reduced codebase complexity (fewer routes, less conditional logic)
- All existing tests pass (with updates for removed endpoint)
- Development workflow unchanged: `DISTRIBUTED_WORKERS=False` for local dev
- Production deployments default to distributed mode for scalability
- Health check endpoint correctly reports mode and Redis connectivity

## Open Questions

None - all questions resolved.

## Decisions Made

1. **Environment variable name**: Keep `DISTRIBUTED_WORKERS` (plural) for consistency with existing configuration
2. **Migration period**: None - remove `/api/llm/stream/distributed` endpoint immediately
3. **Health check**: Add endpoint that exposes current mode and Redis connectivity status
