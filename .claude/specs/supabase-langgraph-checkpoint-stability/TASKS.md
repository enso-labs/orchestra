# TASKS.md: Stabilize LangGraph Postgres Checkpointing on Supabase

**Feature:** Supabase LangGraph Checkpoint Stability
**Generated:** 2026-01-19
**Status:** APPROVED (Conditional - see REVIEW.md)
**Estimated Effort:** 5-6 days

---

## Prerequisites

Before starting implementation:
- [ ] Confirm `POSTGRES_CONNECTION_STRING` uses port 5432 (session mode)
- [ ] Ensure test database available for integration tests
- [ ] Review existing `backend/src/services/db.py` implementation

---

## Phase 1: Foundation (Day 1) - LOW RISK

### Task 1.1: Create Exception Hierarchy

**File:** `backend/src/services/errors.py` (NEW)

**Requirements:**
- Create `CheckpointError` base class with message sanitization
- Create `RetryableCheckpointError` subclass for transient failures
- Create `PermanentCheckpointError` subclass for fatal failures
- Create `CheckpointDegradedError` for fallback mode
- Implement `classify_checkpoint_error()` function

**Error Patterns to Classify as Retryable:**
- `ssl connection has been closed`
- `connection closed unexpectedly`
- `connection refused`
- `connection reset`
- `broken pipe`
- `consuming input failed`
- `timeout`
- `server closed the connection`

**Error Patterns to Classify as Permanent:**
- `authentication failed`
- `password authentication failed`
- `permission denied`
- `role .* does not exist`
- `database .* does not exist`

**Security Requirement:**
- `_sanitize_message()` must remove:
  - PostgreSQL connection strings (`postgresql://...`)
  - Password parameters (`password=...`)
  - Host information (`host=...`)

**Acceptance Criteria:**
- [ ] All exception classes inherit from `CheckpointError`
- [ ] `classify_checkpoint_error()` returns correct class for all patterns
- [ ] Unknown errors default to `RetryableCheckpointError`
- [ ] Connection strings are never present in error messages

---

### Task 1.2: Add Configuration Constants

**File:** `backend/src/constants/__init__.py` (MODIFY)

**Add these constants:**

```python
# Checkpoint Database Configuration
def get_db_uri_session():
    """Session-mode connection string for checkpointing (port 5432)."""
    uri = os.getenv("POSTGRES_CONNECTION_STRING_SESSION")
    return uri if uri else DB_URI

DB_URI_SESSION = get_db_uri_session()

# TCP Keepalive Settings
DB_KEEPALIVE_IDLE = int(os.getenv("DB_KEEPALIVE_IDLE", "60"))
DB_KEEPALIVE_INTERVAL = int(os.getenv("DB_KEEPALIVE_INTERVAL", "15"))
DB_KEEPALIVE_COUNT = int(os.getenv("DB_KEEPALIVE_COUNT", "4"))

# Checkpoint Resilience Settings
CHECKPOINT_MAX_RETRIES = int(os.getenv("CHECKPOINT_MAX_RETRIES", "3"))
CHECKPOINT_RETRY_DELAY = float(os.getenv("CHECKPOINT_RETRY_DELAY", "1.0"))
CHECKPOINT_MAX_DELAY = float(os.getenv("CHECKPOINT_MAX_DELAY", "30.0"))
CHECKPOINT_JITTER = float(os.getenv("CHECKPOINT_JITTER", "0.1"))
CHECKPOINT_HEALTH_CHECK_INTERVAL = int(os.getenv("CHECKPOINT_HEALTH_CHECK_INTERVAL", "30"))

# Feature Flags
CHECKPOINT_USE_RESILIENT = os.getenv("CHECKPOINT_USE_RESILIENT", "false").lower() == "true"
CHECKPOINT_ENABLE_FALLBACK = os.getenv("CHECKPOINT_ENABLE_FALLBACK", "false").lower() == "true"
```

**Acceptance Criteria:**
- [ ] All constants have sensible defaults
- [ ] `DB_URI_SESSION` falls back to `DB_URI` if not set
- [ ] Feature flags default to `false` (opt-in)

---

### Task 1.3: Enhance Retry Utility with Jitter

**File:** `backend/src/utils/retry.py` (MODIFY)

**Add/Modify:**
1. Add `jitter` parameter (default: 0.1)
2. Add `max_delay` parameter (default: 30.0)
3. Add `classify_error` parameter (optional callable)
4. Add `on_retry` callback parameter
5. Add `on_failure` callback parameter
6. Update delay calculation: `delay = min(base * (backoff ** attempt), max_delay) + random.random() * jitter * delay`

**Acceptance Criteria:**
- [ ] Backward compatible with existing usage
- [ ] Jitter adds randomness to prevent thundering herd
- [ ] `max_delay` caps exponential growth
- [ ] `classify_error` can skip retry for permanent errors
- [ ] Callbacks are optional and called at appropriate times

---

## Phase 2: Resilient Wrapper (Days 2-3) - MEDIUM RISK

### Task 2.1: Create Resilient Checkpoint Saver

**File:** `backend/src/services/checkpoint_resilient.py` (NEW)

**Class: `ResilientAsyncPostgresSaver`**

**Constructor Parameters:**
- `connection_string: str` - Database connection string
- `max_retries: int = 3` - Maximum retry attempts
- `base_delay: float = 1.0` - Initial retry delay (seconds)
- `max_delay: float = 30.0` - Maximum retry delay cap
- `jitter: float = 0.1` - Randomization factor
- `enable_fallback: bool = False` - Enable InMemorySaver fallback
- `keepalives: int = 1` - TCP keepalive enable
- `keepalives_idle: int = 60` - Seconds before first probe
- `keepalives_interval: int = 15` - Seconds between probes
- `keepalives_count: int = 4` - Failed probes before dead

**Methods to Implement:**
1. `async connect() -> None` - Establish connection
2. `async close() -> None` - Close connection
3. `async _check_connection_health() -> bool` - Validate connection
4. `async _reconnect() -> None` - Force reconnection
5. `async _execute_with_retry(operation_name, operation)` - Core retry logic
6. `async setup() -> None` - Create checkpoint tables (delegated)
7. `async aget(config) -> Optional[Checkpoint]` - Get checkpoint (delegated with retry)
8. `async aget_tuple(config) -> Optional[CheckpointTuple]` - Get checkpoint tuple (delegated with retry)
9. `async aput(config, checkpoint, metadata, new_versions) -> RunnableConfig` - Store checkpoint (delegated with retry)
10. `async aput_writes(config, writes, task_id) -> None` - Store writes (delegated with retry)
11. `async alist(config, filter, before, limit)` - Async iterator (special handling)
12. `async adelete_thread(thread_id) -> None` - Delete thread (delegated with retry)
13. `@classmethod async create(cls, ...)` - Factory context manager

**Properties:**
- `is_using_fallback: bool` - Whether currently using InMemorySaver
- `metrics: dict` - Retry count, fallback count, etc.

**Logging Requirements (structured with `extra={}`):**
- `checkpoint_reconnect` - On successful reconnection
- `checkpoint_operation_failed` - On each failure (with attempt, error_type, retryable)
- `checkpoint_retry_scheduled` - Before each retry (with delay)
- `checkpoint_fallback_activated` - When fallback engaged
- `checkpoint_health_check_failed` - On health check failure

**Acceptance Criteria:**
- [ ] Implements same interface as `AsyncPostgresSaver`
- [ ] TCP keepalives configured on connection
- [ ] Retries only on retryable errors
- [ ] Exponential backoff with jitter
- [ ] Fallback only activates when enabled AND retries exhausted
- [ ] All methods use structured logging
- [ ] Context manager properly closes connection

---

### Task 2.2: Add Connection Factory to db.py

**File:** `backend/src/services/db.py` (MODIFY)

**Add function: `get_checkpoint_connection_kwargs()`**
```python
def get_checkpoint_connection_kwargs() -> dict:
    """Connection kwargs optimized for checkpointing."""
    return {
        "autocommit": True,
        "prepare_threshold": None,
        "row_factory": dict_row,
        "keepalives": 1,
        "keepalives_idle": DB_KEEPALIVE_IDLE,
        "keepalives_interval": DB_KEEPALIVE_INTERVAL,
        "keepalives_count": DB_KEEPALIVE_COUNT,
    }
```

**Add function: `get_resilient_checkpoint_db()`**
```python
@asynccontextmanager
async def get_resilient_checkpoint_db() -> AsyncIterator[ResilientAsyncPostgresSaver]:
    """Create resilient checkpoint saver with retry and optional fallback."""
    saver = ResilientAsyncPostgresSaver(
        connection_string=DB_URI_SESSION,
        max_retries=CHECKPOINT_MAX_RETRIES,
        base_delay=CHECKPOINT_RETRY_DELAY,
        max_delay=CHECKPOINT_MAX_DELAY,
        jitter=CHECKPOINT_JITTER,
        enable_fallback=CHECKPOINT_ENABLE_FALLBACK,
        keepalives=1,
        keepalives_idle=DB_KEEPALIVE_IDLE,
        keepalives_interval=DB_KEEPALIVE_INTERVAL,
        keepalives_count=DB_KEEPALIVE_COUNT,
    )
    try:
        await saver.connect()
        yield saver
    finally:
        await saver.close()
```

**Modify function: `get_checkpoint_db()`** (feature flag support)
```python
@asynccontextmanager
async def get_checkpoint_db() -> AsyncIterator[AsyncPostgresSaver]:
    """Get checkpoint saver (resilient or legacy based on feature flag)."""
    if CHECKPOINT_USE_RESILIENT:
        async with get_resilient_checkpoint_db() as saver:
            yield saver
    else:
        # Existing implementation
        async with await AsyncConnection.connect(
            DB_URI,
            autocommit=True,
            prepare_threshold=None,
            row_factory=dict_row,
        ) as conn:
            yield AsyncPostgresSaver(conn)
```

**Acceptance Criteria:**
- [ ] Existing code using `get_checkpoint_db()` works unchanged
- [ ] Feature flag toggles between implementations
- [ ] Resilient saver uses `DB_URI_SESSION`
- [ ] TCP keepalives are properly configured

---

### Task 2.3: Write Unit Tests for Resilient Wrapper

**File:** `backend/tests/unit/services/test_checkpoint_resilient.py` (NEW)

**Test Cases:**
1. `test_connect_creates_connection` - Verify connection established
2. `test_close_cleans_up_resources` - Verify cleanup
3. `test_health_check_detects_closed_connection` - Mock closed connection
4. `test_reconnect_creates_new_connection` - Mock old connection, verify new
5. `test_retry_on_ssl_error` - Mock SSL error, verify retry count
6. `test_no_retry_on_permanent_error` - Mock auth error, verify no retry
7. `test_exponential_backoff_with_jitter` - Verify delay calculation
8. `test_max_delay_cap` - Verify delay doesn't exceed max
9. `test_fallback_activates_after_retries` - Enable fallback, exhaust retries
10. `test_fallback_disabled_raises_error` - Disable fallback, verify exception
11. `test_metrics_updated_correctly` - Verify retry_count, fallback_count
12. `test_context_manager_closes_on_exception` - Verify cleanup on error

**Fixtures Needed:**
```python
@pytest.fixture
def mock_connection():
    """Mock psycopg AsyncConnection."""
    ...

@pytest.fixture
def flaky_connection_factory(fail_count=2):
    """Factory that fails N times then succeeds."""
    ...

@pytest.fixture
def always_failing_factory():
    """Factory that always raises OperationalError."""
    ...
```

**Acceptance Criteria:**
- [ ] All test cases pass
- [ ] Mocking properly isolates from real database
- [ ] Error classification tested for each pattern
- [ ] Fallback behavior tested in both enabled/disabled states

---

## Phase 3: Worker Integration (Days 3-4) - MEDIUM RISK

### Task 3.1: Create Worker State Singleton

**File:** `backend/src/workers/state.py` (NEW)

**Class: `WorkerState`**

**Responsibilities:**
- Hold singleton checkpointer instance for worker process
- Initialize on worker startup
- Cleanup on worker shutdown

**Implementation:**
```python
class WorkerState:
    _instance: Optional["WorkerState"] = None
    _checkpointer: Optional[ResilientAsyncPostgresSaver] = None
    _initialized: bool = False

    @classmethod
    def get_instance(cls) -> "WorkerState":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    async def initialize(cls) -> None:
        """Initialize worker state (call on startup)."""
        instance = cls.get_instance()
        if instance._initialized:
            return
        instance._checkpointer = ResilientAsyncPostgresSaver(...)
        await instance._checkpointer.connect()
        await instance._checkpointer.setup()
        instance._initialized = True

    @classmethod
    async def shutdown(cls) -> None:
        """Cleanup worker state (call on shutdown)."""
        instance = cls.get_instance()
        if instance._checkpointer:
            await instance._checkpointer.close()
        instance._checkpointer = None
        instance._initialized = False

    @classmethod
    def get_checkpointer(cls) -> ResilientAsyncPostgresSaver:
        instance = cls.get_instance()
        if not instance._initialized:
            raise RuntimeError("Worker state not initialized")
        return instance._checkpointer
```

**Add convenience function:**
```python
async def get_worker_checkpointer() -> ResilientAsyncPostgresSaver:
    """Get the worker's shared checkpointer."""
    return WorkerState.get_checkpointer()
```

**Acceptance Criteria:**
- [ ] Singleton pattern correctly implemented
- [ ] Raises clear error if accessed before initialization
- [ ] Cleanup properly closes connection
- [ ] Thread-safe for async coroutines (using TaskIQ's single-threaded model)

---

### Task 3.2: Add TaskIQ Lifecycle Hooks

**File:** `backend/src/workers/broker.py` (MODIFY)

**Add imports:**
```python
from src.workers.state import WorkerState
```

**Add lifecycle hooks:**
```python
@broker.on_event("startup")
async def on_startup():
    """Initialize worker state on startup."""
    from src.workers.state import WorkerState
    await WorkerState.initialize()

@broker.on_event("shutdown")
async def on_shutdown():
    """Cleanup worker state on shutdown."""
    from src.workers.state import WorkerState
    await WorkerState.shutdown()
```

**Acceptance Criteria:**
- [ ] Hooks registered with broker
- [ ] Startup initializes checkpointer before any tasks run
- [ ] Shutdown cleans up checkpointer after all tasks complete

---

### Task 3.3: Update TaskIQ Task Implementation

**File:** `backend/src/workers/tasks.py` (MODIFY)

**Changes:**
1. Import `get_worker_checkpointer` from `state.py`
2. Replace `async with get_checkpoint_db() as checkpointer:` with `checkpointer = await get_worker_checkpointer()`
3. Remove checkpointer from context manager
4. Add try/except around final checkpoint update to handle `CheckpointConnectionError`
5. Add import for `CheckpointConnectionError` from errors module

**Key Code Change:**
```python
# Before (around line 74-77):
async with (
    get_store_db() as store,
    get_checkpoint_db() as checkpointer,
):
    ...

# After:
# Get worker-level checkpointer (reused across tasks)
checkpointer = await get_worker_checkpointer()

async with get_store_db() as store:
    ...

    # Handle checkpoint errors gracefully
    try:
        if service_context.user_id and checkpointer:
            # Existing state update code...
            pass
    except CheckpointConnectionError as e:
        logger.warning(
            "checkpoint_final_update_failed",
            extra={
                "event": "checkpoint_final_update_failed",
                "thread_id": thread_id,
                "error": str(e),
            }
        )
        # Don't re-raise - stream was successful
```

**Acceptance Criteria:**
- [ ] Checkpointer is obtained from WorkerState, not context manager
- [ ] Store still uses context manager (different lifecycle)
- [ ] Checkpoint errors logged but don't fail the task
- [ ] Stream completion not blocked by checkpoint failures

---

### Task 3.4: Write Integration Tests for Worker Resilience

**File:** `backend/tests/integration/test_worker_checkpoint.py` (NEW)

**Test Cases:**
1. `test_worker_initializes_checkpointer` - Verify startup hook works
2. `test_worker_reuses_checkpointer` - Run multiple tasks, verify same instance
3. `test_worker_handles_checkpoint_failure` - Inject failure, verify task completes
4. `test_worker_cleans_up_on_shutdown` - Verify shutdown hook closes connection

**Acceptance Criteria:**
- [ ] Integration tests can run against test database
- [ ] Simulated failures don't crash worker
- [ ] Checkpointer reuse verified across tasks

---

## Phase 4: FastAPI Integration (Day 5) - LOW RISK

### Task 4.1: Update Stream Generator

**File:** `backend/src/utils/stream.py` (MODIFY)

**Change:**
- Use `get_resilient_checkpoint_db()` instead of `get_checkpoint_db()` in `stream_generator()`
- Or rely on feature flag in `get_checkpoint_db()` (if Task 2.2 implemented correctly)

**Acceptance Criteria:**
- [ ] FastAPI streaming uses resilient checkpointer when flag enabled
- [ ] Existing behavior unchanged when flag disabled

---

### Task 4.2: Extend Retry Coverage in CheckpointService

**File:** `backend/src/services/checkpoint.py` (MODIFY)

**Add retry decorator to these methods:**
- `create_checkpoint()`
- `get_checkpoint()`
- `delete_checkpoints_for_thread()`

**Use error classification:**
```python
from src.services.errors import classify_checkpoint_error, RetryableCheckpointError

def is_retryable(e: Exception) -> bool:
    return classify_checkpoint_error(e) is RetryableCheckpointError

@retry_db_operation(
    tries=3,
    delay=1,
    backoff=2,
    exceptions=(psycopg.OperationalError, ConnectionError),
    classify_error=is_retryable,
)
async def create_checkpoint(...):
    ...
```

**Acceptance Criteria:**
- [ ] All public checkpoint methods have retry protection
- [ ] Permanent errors not retried
- [ ] Existing `list_checkpoints()` retry preserved

---

## Phase 5: Observability (Day 5-6) - LOW RISK

### Task 5.1: Document Structured Log Events

**Create documentation for these log events:**

| Event | Level | Fields | Description |
|-------|-------|--------|-------------|
| `checkpoint_reconnect` | INFO | status | Connection re-established |
| `checkpoint_operation_failed` | WARNING | operation, attempt, max_retries, error_type, retryable | Operation failed |
| `checkpoint_retry_scheduled` | INFO | operation, attempt, delay_seconds | Retry pending |
| `checkpoint_fallback_activated` | WARNING | operation, reason | InMemorySaver engaged |
| `checkpoint_health_check_failed` | WARNING | - | Connection unhealthy |
| `checkpoint_final_update_failed` | WARNING | thread_id, error | End-of-stream update failed |

**Acceptance Criteria:**
- [ ] All events use consistent `extra={}` format
- [ ] No sensitive data in log messages
- [ ] Events are searchable in log aggregation

---

### Task 5.2: Add Health Check Enhancement

**File:** `backend/src/routes/health.py` (MODIFY if exists)

**Add checkpoint status to health check:**
```python
{
    "status": "healthy",
    "checkpoint": {
        "mode": "resilient" | "legacy",
        "using_fallback": false,
        "retry_count": 0,
        "fallback_count": 0
    }
}
```

**Acceptance Criteria:**
- [ ] Health endpoint reports checkpoint mode
- [ ] Fallback status visible in health response

---

## Validation Checklist

Before marking implementation complete:

- [ ] All unit tests pass (`make test`)
- [ ] Integration tests pass with test database
- [ ] Feature flag `CHECKPOINT_USE_RESILIENT=false` maintains existing behavior
- [ ] Feature flag `CHECKPOINT_USE_RESILIENT=true` enables new behavior
- [ ] Fallback only activates when `CHECKPOINT_ENABLE_FALLBACK=true`
- [ ] Logs show structured events during retry scenarios
- [ ] No connection strings appear in any log messages
- [ ] Documentation updated

---

## Rollback Plan

If issues discovered post-deployment:

1. Set `CHECKPOINT_USE_RESILIENT=false` in environment
2. Restart all TaskIQ workers
3. Restart FastAPI application
4. Verify error rates return to baseline

**Time to rollback:** < 5 minutes

---

## Environment Variables Summary

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_CONNECTION_STRING_SESSION` | (falls back to DB_URI) | Session-mode connection for checkpointing |
| `DB_KEEPALIVE_IDLE` | 60 | Seconds before first keepalive probe |
| `DB_KEEPALIVE_INTERVAL` | 15 | Seconds between probes |
| `DB_KEEPALIVE_COUNT` | 4 | Failed probes before connection dead |
| `CHECKPOINT_MAX_RETRIES` | 3 | Max retry attempts |
| `CHECKPOINT_RETRY_DELAY` | 1.0 | Initial retry delay (seconds) |
| `CHECKPOINT_MAX_DELAY` | 30.0 | Maximum retry delay cap |
| `CHECKPOINT_JITTER` | 0.1 | Randomization factor (0.0-1.0) |
| `CHECKPOINT_HEALTH_CHECK_INTERVAL` | 30 | Seconds between health checks |
| `CHECKPOINT_USE_RESILIENT` | false | Enable resilient checkpointer |
| `CHECKPOINT_ENABLE_FALLBACK` | false | Enable InMemorySaver fallback |

---

**Document Version:** 1.0
**Generated By:** Rummage Council Review
**Ready for Implementation:** YES
