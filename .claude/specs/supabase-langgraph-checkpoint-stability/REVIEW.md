# Council Review: Stabilize LangGraph Postgres Checkpointing on Supabase

**Date:** 2026-01-19
**Reviewers:** AI Council (ARCHITECT, CRAFTSMAN, GUARDIAN synthesis)
**Feature:** Supabase LangGraph Checkpoint Stability
**Status:** READY FOR APPROVAL

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN |
|--------|-----------|-----------|----------|
| **Core Pattern** | `ResilientAsyncPostgresSaver` wrapper | `ResilientAsyncPostgresSaver` wrapper | `ResilientCheckpointSaver` wrapper |
| **Connection Strategy** | Dual connection strings (session mode port 5432 for checkpoints) | `CHECKPOINT_DATABASE_URL` env var for direct connection | Factory function pattern with existing `DB_URI` |
| **Retry Logic** | `@with_reconnect` decorator on methods | `_execute_with_retry` internal method | `_execute_with_retry` with error classification |
| **Worker Pattern** | `WorkerState` singleton per worker process | Global `_worker_checkpointer` singleton in broker | Per-request factory (existing pattern) |
| **Fallback Strategy** | Not included | Not included | `InMemorySaver` fallback with logging |
| **Error Classification** | Basic recoverable vs non-recoverable | Pattern matching on error strings | Full exception hierarchy with sanitization |
| **TCP Keepalive** | Yes (configurable) | Yes (configurable) | Not explicitly included |
| **Jitter in Backoff** | Not explicit | Yes (configurable) | Yes (required for thundering herd prevention) |
| **New Files** | 2 (`checkpoint_resilient.py`, `workers/state.py`) | 1 (`resilient_checkpoint.py`) | 2 (`errors.py`, `checkpoint_resilient.py`) |
| **Estimated LOC** | ~800 | ~300-350 | ~600 |
| **Estimated Days** | 4-6 | 2-3 | 4-5 |
| **Risk Level** | Medium | Medium | Medium |

---

## 2. Consensus Points

All three proposals **unanimously agree** on:

### 2.1 Root Cause
- Supavisor transaction pooling is incompatible with psycopg async pipeline mode
- Per-task connection creation causes excessive connection churn
- Missing TCP keepalives allow stale connections to go undetected
- Long-running streams exceed pooler timeouts

### 2.2 Solution Architecture
- **Wrapper Pattern**: All proposals recommend wrapping `AsyncPostgresSaver` rather than modifying LangGraph internals (composition over inheritance)
- **Retry Logic**: Exponential backoff with configurable retries (3 retries, 1-30s delays)
- **Connection Validation**: Health checks before operations to detect stale connections
- **Auto-Reconnection**: Create new connection when current connection fails
- **Worker-Level Reuse**: Minimize connection churn by reusing checkpointer across tasks (though implementation details differ)
- **Configuration via Environment**: New env vars for checkpoint-specific settings
- **Backward Compatibility**: Keep existing `get_checkpoint_db()` for gradual migration

### 2.3 Key Implementation Details
- All proposals delegate checkpoint methods (`aput`, `aget`, `alist`, etc.) through the wrapper
- All proposals use `asynccontextmanager` pattern consistent with existing codebase
- All proposals recommend structured logging for observability
- All proposals suggest integration tests with simulated failures

---

## 3. Divergence Analysis

### 3.1 Connection String Strategy

| Approach | Proposals | Pros | Cons |
|----------|-----------|------|------|
| **Dual Connection Strings** | ARCHITECT | Clear separation, audit-friendly | Two env vars to manage |
| **Single Fallback String** | CRAFTSMAN, GUARDIAN | Simpler config, graceful fallback to existing | Less explicit about usage |

**Recommendation**: Adopt ARCHITECT's dual connection string approach with CRAFTSMAN's fallback pattern. Use `POSTGRES_CONNECTION_STRING_SESSION` for checkpointing (port 5432 session mode), falling back to `DB_URI` if not set.

### 3.2 Worker Lifecycle Pattern

| Approach | Proposal | Pros | Cons |
|----------|----------|------|------|
| **`WorkerState` class singleton** | ARCHITECT | Encapsulated, testable, clear lifecycle | More code, class overhead |
| **Global module singleton** | CRAFTSMAN | Simple, fewer files | Global state, harder to test |
| **Per-request factory** | GUARDIAN | Consistent with existing patterns, isolated | Connection churn remains |

**Recommendation**: Adopt ARCHITECT's `WorkerState` pattern for cleaner encapsulation and explicit lifecycle management via TaskIQ hooks. This provides better testability and clearer separation of concerns.

### 3.3 Error Handling Strategy

| Approach | Proposal | Pros | Cons |
|----------|----------|------|------|
| **Pattern matching only** | ARCHITECT, CRAFTSMAN | Simple, sufficient for known errors | May miss edge cases |
| **Full exception hierarchy** | GUARDIAN | Type-safe, extensible, sanitized messages | More code, slight overhead |

**Recommendation**: Adopt GUARDIAN's exception hierarchy (`CheckpointError`, `RetryableCheckpointError`, `PermanentCheckpointError`) for type safety and message sanitization, but simplify the pattern matching from all three proposals into a single classification function.

### 3.4 Fallback Strategy

| Approach | Proposal | Pros | Cons |
|----------|----------|------|------|
| **No fallback** | ARCHITECT, CRAFTSMAN | Simpler, no data inconsistency risk | Crashes on persistent failures |
| **InMemorySaver fallback** | GUARDIAN | Graceful degradation, PRD-compliant | Data loss risk, memory pressure |

**Recommendation**: Adopt GUARDIAN's `InMemorySaver` fallback with the following constraints:
- Fallback is **opt-in** via `CHECKPOINT_ENABLE_FALLBACK=true` (default: false)
- Clear logging when fallback activates
- Metrics exposed for monitoring
- Consider implementing a sync-back mechanism in future iteration

### 3.5 Jitter in Exponential Backoff

| Approach | Proposals | Pros | Cons |
|----------|-----------|------|------|
| **No explicit jitter** | ARCHITECT | Simpler calculation | Thundering herd risk |
| **Configurable jitter** | CRAFTSMAN, GUARDIAN | Prevents thundering herd | Slightly more complex |

**Recommendation**: Include jitter (GUARDIAN's approach) with 10% random factor to prevent multiple workers from retrying simultaneously.

---

## 4. Unified Implementation Plan

### Phase 1: Foundation (Day 1) - LOW RISK
1. Create `backend/src/services/errors.py` with exception hierarchy
2. Add new constants to `backend/src/constants/__init__.py`:
   - `POSTGRES_CONNECTION_STRING_SESSION`
   - `CHECKPOINT_MAX_RETRIES`, `CHECKPOINT_RETRY_DELAY`
   - `DB_KEEPALIVE_*` settings
   - `CHECKPOINT_ENABLE_FALLBACK`
3. Enhance `backend/src/utils/retry.py` with jitter

### Phase 2: Resilient Wrapper (Days 2-3) - MEDIUM RISK
4. Create `backend/src/services/checkpoint_resilient.py`:
   - `ResilientAsyncPostgresSaver` class
   - Connection health validation
   - Retry with exponential backoff + jitter
   - Optional `InMemorySaver` fallback
   - Structured logging
5. Add `get_checkpoint_connection_kwargs()` to `backend/src/services/db.py`
6. Add `get_resilient_checkpoint_db()` factory function
7. Write unit tests for resilient wrapper

### Phase 3: Worker Integration (Days 3-4) - MEDIUM RISK
8. Create `backend/src/workers/state.py` with `WorkerState` singleton
9. Add TaskIQ lifecycle hooks to `backend/src/workers/broker.py`
10. Update `backend/src/workers/tasks.py` to use worker-level checkpointer
11. Write integration tests for worker resilience

### Phase 4: FastAPI Integration (Day 5) - LOW RISK
12. Update `backend/src/utils/stream.py` to use resilient checkpointer
13. End-to-end testing
14. Documentation updates

### Phase 5: Observability (Day 5-6) - LOW RISK
15. Add structured log fields for all checkpoint events
16. Add health check endpoint enhancements
17. Document monitoring recommendations

---

## 5. File Changes Summary

### New Files (4)
| File | Purpose | Source |
|------|---------|--------|
| `backend/src/services/errors.py` | Exception hierarchy | GUARDIAN |
| `backend/src/services/checkpoint_resilient.py` | Resilient wrapper class | All (synthesized) |
| `backend/src/workers/state.py` | Worker state singleton | ARCHITECT |
| `backend/tests/unit/services/test_checkpoint_resilient.py` | Unit tests | All |

### Modified Files (7)
| File | Changes |
|------|---------|
| `backend/src/constants/__init__.py` | Add connection strings, keepalive settings, retry config |
| `backend/src/services/db.py` | Add `get_checkpoint_connection_kwargs()`, `get_resilient_checkpoint_db()` |
| `backend/src/utils/retry.py` | Add jitter, error classification support |
| `backend/src/workers/broker.py` | Add startup/shutdown lifecycle hooks |
| `backend/src/workers/tasks.py` | Use worker-level checkpointer |
| `backend/src/utils/stream.py` | Use resilient checkpointer |
| `backend/src/services/checkpoint.py` | Extend retry decorator to all methods |

---

## 6. Risk Consolidation

### 6.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Reconnection race condition | Low | Medium | Async lock in wrapper |
| Fallback data loss | Medium | High | Opt-in flag, clear logging, future sync-back |
| Retry storm under load | Low | Medium | Jitter + max_delay cap |
| LangGraph API changes | Medium | Low | Wrapper isolates internals |
| Worker state corruption | Low | High | TaskIQ is single-threaded by default |
| Memory pressure from fallback | Low | Medium | Disable fallback by default |

### 6.2 Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Configuration error (wrong port) | Medium | High | Fallback to existing `DB_URI` |
| Increased latency from retries | Medium | Low | Fast-fail on permanent errors |
| Log volume increase | Low | Low | Log levels appropriately |

### 6.3 Edge Cases to Handle (Combined from GUARDIAN)

1. Connection drops mid-checkpoint-write (LangGraph handles via idempotent IDs)
2. Worker restart during stream (Redis stream already written, user can retry)
3. Database maintenance window (retries exhaust, task fails with error)
4. Concurrent tasks on same thread_id (LangGraph checkpoint versioning handles)
5. SSL certificate rotation (retry logic handles, workers recover)
6. Partial network failure (health check validates before operations)

---

## 7. Testing Strategy

### Unit Tests
- Error classification: Each psycopg error type maps to correct class
- Message sanitization: Connection strings removed
- Retry calculation: Exponential backoff with jitter and cap
- Wrapper delegation: All checkpoint methods proxied correctly
- Fallback activation: Triggers after max retries exhausted

### Integration Tests
- Simulated failures: Mock N failures then succeed
- Fallback behavior: Disable DB, verify in-memory works
- Worker lifecycle: Verify checkpointer persists across tasks
- Stream completion: Inject failure mid-stream, verify completion

### End-to-End Tests
- Full agent stream with flaky connection simulation
- Verify user receives complete response
- Verify checkpoint state eventually consistent

---

## 8. Deployment Strategy

1. **Feature Flag First**: Deploy with `CHECKPOINT_USE_RESILIENT=false`
2. **Canary Rollout**: Enable for single worker, monitor error rates
3. **Gradual Expansion**: Enable for all workers after 24h stability
4. **Fallback Disabled Initially**: Set `CHECKPOINT_ENABLE_FALLBACK=false`
5. **Monitor**: Watch for reconnection events in logs
6. **Rollback Plan**: Set env var to `false` and restart workers (<5 min)

---

## 9. Final Verdict

### GO / NO-GO / CONDITIONAL

**VERDICT: GO (CONDITIONAL)**

### Conditions for Approval:
1. **Session Mode Confirmed**: User has confirmed port 5432 (session mode) in PRD
2. **Feature Flag Required**: Implementation must include `CHECKPOINT_USE_RESILIENT` toggle
3. **Fallback Opt-In**: `CHECKPOINT_ENABLE_FALLBACK` must default to `false`
4. **Test Coverage**: Unit tests for error classification and retry logic before integration
5. **Structured Logging**: All failure events must use consistent `extra={}` format

### Rationale:
- All three proposals converge on the same core solution (wrapper pattern)
- Risk level is Medium with clear mitigation strategies
- PRD explicitly requests resilience and graceful degradation
- Implementation preserves backward compatibility
- Rollback is straightforward via environment variable

### Estimated Total Effort:
- **5-6 days** for complete implementation
- **~600-800 lines** of new/modified code (including tests)

---

## 10. Implementation Contract Summary

The approved implementation will:

1. **Create `ResilientAsyncPostgresSaver`** that wraps `AsyncPostgresSaver` with:
   - TCP keepalive configuration
   - Health check before operations
   - Retry with exponential backoff + jitter (3 attempts, 1-30s)
   - Error classification (retryable vs permanent)
   - Optional `InMemorySaver` fallback (disabled by default)
   - Structured logging for all events

2. **Introduce `WorkerState` singleton** for TaskIQ workers to:
   - Initialize checkpointer on worker startup
   - Reuse checkpointer across all tasks in worker
   - Cleanup on worker shutdown

3. **Add configuration via environment variables**:
   - `POSTGRES_CONNECTION_STRING_SESSION` (falls back to `DB_URI`)
   - `DB_KEEPALIVE_IDLE`, `DB_KEEPALIVE_INTERVAL`, `DB_KEEPALIVE_COUNT`
   - `CHECKPOINT_MAX_RETRIES`, `CHECKPOINT_RETRY_DELAY`
   - `CHECKPOINT_ENABLE_FALLBACK` (default: false)
   - `CHECKPOINT_USE_RESILIENT` (feature flag)

4. **Maintain backward compatibility** by:
   - Keeping existing `get_checkpoint_db()` function
   - Using feature flag for gradual rollout
   - Falling back to existing behavior if config missing

---

**Document Version:** 1.0
**Approved By:** AI Council
**Next Step:** Generate TASKS.md contract for implementation
