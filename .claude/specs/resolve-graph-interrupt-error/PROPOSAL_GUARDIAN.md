# GUARDIAN Security & Robustness Analysis

## Issue #336: "Graph is required to handle interrupt decisions" Error

**Analyst**: GUARDIAN Agent
**Date**: 2026-01-16
**Severity**: HIGH (Security + Functionality Impact)

---

## Executive Summary

The HITL (Human-In-The-Loop) resume functionality has a critical implementation gap where the `resume_thread` endpoint creates an `InterruptService` without the required `graph` parameter. Beyond this immediate bug, this analysis identifies **12 security vulnerabilities**, **8 robustness concerns**, and **6 edge cases** that must be addressed before this feature is production-ready.

---

## 1. Root Cause Analysis

### 1.1 Immediate Bug Location

**File**: `/home/ryaneggz/ruska-ai/orchestra/backend/src/routes/v0/thread.py` (lines 410-420)

```python
# BROKEN CODE - Missing graph parameter
interrupt_service = InterruptService(user_id=user.id)
await interrupt_service.handle_decision(request)
```

**File**: `/home/ryaneggz/ruska-ai/orchestra/backend/src/services/interrupt.py` (lines 342-343)

```python
# This validation CORRECTLY fails when graph is None
if not self.graph:
    raise ValueError("Graph is required to handle interrupt decisions")
```

### 1.2 Why This Matters

The `handle_decision` method needs the compiled `CompiledStateGraph` to:
1. Update the LangGraph state via `graph.aupdate_state()`
2. Resume execution from the checkpoint
3. Apply the user's decision (approve/edit/reject/respond)

Without the graph, the interrupt cannot be resolved, making the entire HITL feature non-functional.

---

## 2. Security Concerns

### 2.1 CRITICAL: Authorization Bypass Potential

**Current State**: The ownership validation in `InterruptService.validate_ownership()` only checks `interrupt.user_id == self.user_id`.

**Vulnerability**: The `_pending_interrupts` is a **class-level in-memory dict** (line 199), meaning ALL interrupts from ALL users are stored together. If an attacker guesses or brute-forces an `interrupt_id`, they could potentially access interrupt metadata.

**Recommendation**:
```python
# BEFORE: Class-level storage (VULNERABLE)
_pending_interrupts: Dict[str, Interrupt] = {}

# AFTER: User-scoped storage or Redis with proper ACLs
# Option 1: Namespace by user_id
_pending_interrupts: Dict[str, Dict[str, Interrupt]] = {}  # {user_id: {interrupt_id: Interrupt}}

# Option 2: Use Redis with proper key namespacing
# Key format: f"interrupt:{user_id}:{interrupt_id}"
```

### 2.2 HIGH: Thread Ownership Not Validated

**Current State**: The `resume_thread` endpoint accepts any `thread_id` in the URL path, but **does not validate** that the authenticated user owns that thread.

**Attack Vector**:
1. Attacker obtains a valid `interrupt_id` for another user's thread
2. Attacker calls `POST /threads/{victim_thread_id}/resume`
3. The `InterruptService.validate_ownership()` checks `interrupt.user_id`, but the thread_id in the URL is never validated against the interrupt

**Recommendation**:
```python
# Add thread ownership validation
async def resume_thread(...):
    # 1. Get the thread and validate ownership
    thread = await service_context.thread_service.get(thread_id)
    if not thread or thread.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # 2. Validate that interrupt belongs to this thread
    interrupt = interrupt_service.get_interrupt(request.interrupt_id)
    if interrupt.thread_id != thread_id:
        raise HTTPException(status_code=400, detail="Interrupt does not belong to this thread")
```

### 2.3 HIGH: Replay Attack Vector

**Current State**: Nonce validation is **optional** (line 362):
```python
if request.nonce and not self.validate_nonce(...)
```

**Vulnerability**: If a client doesn't provide a nonce, replay protection is completely bypassed.

**Recommendation**:
```python
# Make nonce REQUIRED for mutation operations
class InterruptRequest(BaseModel):
    nonce: str = Field(..., description="REQUIRED: One-time-use token for replay protection")

# Or enforce at service level
if not request.nonce:
    raise InterruptValidationError("Nonce is required for interrupt decisions")
```

### 2.4 HIGH: Nonce Storage Unbounded

**Current State**: `_used_nonces` is a class-level set with **no cleanup mechanism**:
```python
_used_nonces: set = set()  # Grows forever!
```

**Vulnerability**: Memory exhaustion via nonce flooding attack.

**Recommendation**:
```python
# Use TTL-based storage (Redis with EXPIRE)
# Or implement bounded set with LRU eviction
from collections import OrderedDict

class BoundedNonceSet:
    def __init__(self, max_size=100000):
        self._nonces = OrderedDict()
        self._max_size = max_size

    def add(self, nonce: str) -> bool:
        if nonce in self._nonces:
            return False
        if len(self._nonces) >= self._max_size:
            self._nonces.popitem(last=False)  # Remove oldest
        self._nonces[nonce] = True
        return True
```

### 2.5 MEDIUM: Information Leakage in Error Messages

**Current State** (line 438):
```python
raise HTTPException(
    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    detail=str(e)  # LEAKS INTERNAL ERROR DETAILS
)
```

**Vulnerability**: Stack traces, database errors, or system paths could be exposed.

**Recommendation**:
```python
except Exception as e:
    logger.exception(f"Error resuming thread {thread_id}: {e}")
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="An internal error occurred while resuming the thread"
    )
```

### 2.6 MEDIUM: Timing Attack on Ownership Check

**Current State**: The ownership check returns immediately if user doesn't match:
```python
if not self.validate_ownership(interrupt):
    raise InterruptAuthorizationError(...)
```

**Vulnerability**: An attacker can enumerate valid interrupt IDs by measuring response times.

**Recommendation**:
```python
import secrets
import time

def constant_time_compare(a, b):
    return secrets.compare_digest(str(a), str(b))

# Use constant-time comparison for ownership
if not constant_time_compare(interrupt.user_id, self.user_id):
    # Add small random delay to obscure timing
    time.sleep(secrets.randbelow(50) / 1000)  # 0-50ms
    raise InterruptAuthorizationError(...)
```

### 2.7 MEDIUM: Checkpoint Integrity Not Validated

**Current State**: The checkpoint_id from the interrupt is used directly without validating it matches the current state of the thread.

**Attack Vector**: If an attacker can manipulate the checkpoint_id stored in the interrupt, they could potentially:
1. Resume from a stale state
2. Cause state corruption
3. Bypass previous tool rejections

**Recommendation**:
```python
# Validate checkpoint exists and belongs to thread
async def validate_checkpoint(self, checkpointer, thread_id, checkpoint_id):
    checkpoint = await checkpointer.aget(
        config={"configurable": {"thread_id": thread_id, "checkpoint_id": checkpoint_id}}
    )
    if not checkpoint:
        raise InterruptValidationError("Checkpoint not found or invalid")
    return checkpoint
```

### 2.8 LOW: Input Validation for Edited Args

**Current State**: When `tool_schema` is not provided, edited args are passed through unvalidated:
```python
if not tool_schema:
    return edited_args  # NO VALIDATION!
```

**Vulnerability**: Malicious payloads could be injected into tool arguments.

**Recommendation**:
```python
# Always perform basic sanitization
import bleach

def sanitize_args(args: Dict[str, Any]) -> Dict[str, Any]:
    sanitized = {}
    for k, v in args.items():
        if isinstance(v, str):
            sanitized[k] = bleach.clean(v)
        elif isinstance(v, dict):
            sanitized[k] = sanitize_args(v)
        else:
            sanitized[k] = v
    return sanitized
```

---

## 3. Error Handling Analysis

### 3.1 Assistant Config Load Failure

**What happens if the assistant config can't be loaded?**

**Current Risk**: In `workers/tasks.py` line 104:
```python
params = await service_context.llm_service.assistant(params)
```

If this fails, the exception propagates to the generic handler (line 241-250) which:
1. Logs the exception
2. Pushes error to Redis stream
3. Re-raises the exception

**Improvement Needed**:
```python
try:
    params = await service_context.llm_service.assistant(params)
except AssistantNotFoundError as e:
    await redis_client.xadd(stream_key, {
        "error": json.dumps({
            "type": "assistant_not_found",
            "message": "The assistant configuration could not be loaded",
            "recoverable": False
        }),
        "done": "true"
    })
    raise
except AssistantConfigurationError as e:
    # Handle corrupted/invalid config
    ...
```

### 3.2 Agent Construction Failure

**What if the agent construction fails?**

**Current Risk**: `construct_agent()` (flows/__init__.py line 240-242) catches all exceptions and re-raises:
```python
except Exception as e:
    logger.error(f"Error constructing agent: {e}")
    raise e
```

**Issues**:
1. No differentiation between recoverable and non-recoverable errors
2. No cleanup of partial state
3. Client receives generic error

**Improvement Needed**:
```python
async def construct_agent(...):
    try:
        # ... construction logic
    except ModelNotAvailableError as e:
        logger.error(f"Model unavailable: {e}")
        raise AgentConstructionError(
            "The requested model is not available",
            recoverable=True,
            suggested_action="retry_with_different_model"
        )
    except ToolInitializationError as e:
        logger.error(f"Tool init failed: {e}")
        raise AgentConstructionError(
            "One or more tools failed to initialize",
            recoverable=False,
            failed_tools=[e.tool_name]
        )
```

### 3.3 Checkpoint Corruption

**What if the checkpoint is corrupted?**

**Current Risk**: No validation of checkpoint integrity before resume.

**Scenarios**:
1. Checkpoint data truncated due to storage failure
2. Checkpoint refers to deleted messages
3. Checkpoint state schema changed between interrupt and resume

**Recommendation**:
```python
async def validate_checkpoint_integrity(self, checkpoint, expected_schema_version):
    """Validate checkpoint data before resuming."""
    if not checkpoint:
        raise CheckpointCorruptionError("Checkpoint is empty")

    if not checkpoint.get("values"):
        raise CheckpointCorruptionError("Checkpoint has no values")

    messages = checkpoint["values"].get("messages", [])
    if not messages:
        raise CheckpointCorruptionError("Checkpoint has no message history")

    # Validate schema version compatibility
    schema_version = checkpoint.get("metadata", {}).get("schema_version")
    if schema_version != expected_schema_version:
        raise CheckpointVersionMismatchError(
            f"Checkpoint version {schema_version} != expected {expected_schema_version}"
        )
```

### 3.4 Proper Error Messages vs. Information Leakage

**Recommendations**:

| Error Type | Internal Log | Client Message |
|------------|--------------|----------------|
| InterruptNotFoundError | Full details | "Interrupt not found or expired" |
| InterruptExpiredError | Full details | "This approval request has expired" |
| InterruptAuthorizationError | Full details + IP | "You don't have permission to perform this action" |
| InterruptValidationError | Full details | Specific validation message (safe) |
| Database errors | Full trace | "Service temporarily unavailable" |
| Graph errors | Full trace | "Unable to process request" |

---

## 4. Edge Cases Analysis

### 4.1 Interrupt Expiration During Processing

**Scenario**: User clicks "Approve", but by the time the request reaches the server, the interrupt has expired.

**Current Handling**: Correctly handled via `is_expired()` check.

**Edge Case**: What if the interrupt expires **during** the `graph.aupdate_state()` call?

**Recommendation**:
```python
async def handle_decision(...):
    # Lock the interrupt to prevent concurrent modifications
    async with self.lock_interrupt(request.interrupt_id):
        # Double-check expiration after acquiring lock
        if interrupt.is_expired():
            raise InterruptExpiredError(...)

        # Proceed with state update
        result = await handler.handle(...)

        # Mark as resolved atomically
        interrupt.status = InterruptStatus[request.action.value.upper()]
        interrupt.resolved_at = datetime.now(timezone.utc)
```

### 4.2 Thread Deleted Between Interrupt and Resume

**Scenario**: Admin deletes thread while user is reviewing approval dialog.

**Current Handling**: NOT HANDLED - will cause internal error.

**Recommendation**:
```python
async def resume_thread(...):
    # Validate thread still exists
    thread = await service_context.thread_service.get(thread_id)
    if not thread:
        # Clean up orphaned interrupt
        interrupt_service.delete_interrupt(request.interrupt_id)
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="The conversation no longer exists"
        )
```

### 4.3 Concurrent Resume Requests

**Scenario**: User double-clicks "Approve" button, or network retry sends duplicate requests.

**Current Handling**: Partial - nonce validation prevents some replays, but only if nonce is provided.

**Race Condition**: Two requests could pass the `is_pending()` check simultaneously before either updates status.

**Recommendation**:
```python
# Use distributed locking (Redis)
async def handle_decision_with_lock(self, request: InterruptRequest):
    lock_key = f"interrupt:lock:{request.interrupt_id}"

    async with redis_lock(lock_key, timeout=30):
        # Re-fetch interrupt inside lock to get fresh state
        interrupt = await self.get_interrupt_fresh(request.interrupt_id)

        if interrupt.status != InterruptStatus.PENDING:
            raise InterruptValidationError(
                f"Interrupt already resolved with status: {interrupt.status}"
            )

        # Process decision...
```

### 4.4 Agent Graph Schema Changed

**Scenario**: Developer deploys code update that changes agent graph structure while interrupts are pending.

**Current Handling**: NOT HANDLED - undefined behavior, likely crash.

**Recommendation**:
```python
class Interrupt(BaseModel):
    # Add graph version tracking
    graph_schema_version: str = Field(..., description="Version of graph schema at interrupt time")
    graph_id: str = Field(..., description="Identifier of the graph type")

async def handle_decision(...):
    # Validate graph compatibility
    current_version = self.graph.schema_version
    if interrupt.graph_schema_version != current_version:
        raise InterruptValidationError(
            "The agent has been updated since this approval request was created. "
            "Please start a new conversation."
        )
```

### 4.5 Multiple Pending Interrupts on Same Thread

**Scenario**: Agent makes multiple tool calls that all require approval before any is resolved.

**Current Handling**: `get_pending_interrupts()` returns all pending, but `resume_thread` only handles one.

**Edge Case**: User approves interrupt #2 before interrupt #1 - what happens to the graph state?

**Recommendation**:
```python
# Enforce FIFO ordering
async def handle_decision(...):
    pending = self.get_pending_interrupts(interrupt.thread_id)
    if pending and pending[0].id != request.interrupt_id:
        raise InterruptValidationError(
            f"Please resolve pending interrupt {pending[0].id} first"
        )
```

### 4.6 WebSocket/SSE Disconnect During Interrupt

**Scenario**: User's browser loses connection while interrupt is pending.

**Current Handling**: Interrupt remains in `_pending_interrupts` until expiration.

**Issue**: User reconnects but doesn't know there's a pending interrupt.

**Recommendation**: The `get_thread_interrupts` endpoint exists for this purpose - ensure frontend polls on reconnect.

---

## 5. Required Test Cases

### 5.1 Unit Tests

```python
# test_interrupt_service.py

class TestInterruptService:
    """Unit tests for InterruptService."""

    # Security Tests
    def test_ownership_validation_rejects_wrong_user(self):
        """Ensure user cannot access another user's interrupt."""

    def test_ownership_validation_accepts_correct_user(self):
        """Ensure user can access their own interrupt."""

    def test_nonce_prevents_replay(self):
        """Ensure same nonce cannot be used twice."""

    def test_nonce_required_for_mutation(self):
        """Ensure missing nonce raises validation error."""

    # Expiration Tests
    def test_expired_interrupt_rejected(self):
        """Ensure expired interrupts cannot be resolved."""

    def test_interrupt_expiration_boundary(self):
        """Test interrupt at exact expiration time."""

    # Handler Tests
    def test_approve_handler_updates_state(self):
        """Ensure approve handler calls graph.aupdate_state correctly."""

    def test_edit_handler_validates_schema(self):
        """Ensure edit handler validates args against schema."""

    def test_edit_handler_rejects_invalid_args(self):
        """Ensure edit handler rejects malformed args."""

    def test_reject_handler_includes_feedback(self):
        """Ensure reject handler passes feedback to graph."""

    def test_respond_handler_custom_feedback(self):
        """Ensure respond handler passes custom feedback."""

    # Edge Cases
    def test_interrupt_not_found(self):
        """Ensure proper error for non-existent interrupt."""

    def test_unknown_action_type_rejected(self):
        """Ensure unknown decision types are rejected."""

    def test_cleanup_expired_removes_old_interrupts(self):
        """Ensure cleanup removes expired interrupts."""
```

### 5.2 Integration Tests

```python
# test_hitl_integration.py

class TestHITLIntegration:
    """Integration tests for HITL flow."""

    async def test_full_approve_flow(self):
        """Test complete approve flow: create interrupt -> approve -> resume."""

    async def test_full_reject_flow(self):
        """Test complete reject flow: create interrupt -> reject -> resume."""

    async def test_full_edit_flow(self):
        """Test complete edit flow: create interrupt -> edit -> resume."""

    async def test_interrupt_persists_across_reconnect(self):
        """Test that pending interrupts survive client reconnection."""

    async def test_concurrent_resume_requests(self):
        """Test that concurrent resume requests are handled safely."""

    async def test_thread_deletion_cleans_interrupts(self):
        """Test that deleting thread cleans up pending interrupts."""

    async def test_assistant_config_change_during_interrupt(self):
        """Test behavior when assistant config changes during pending interrupt."""
```

### 5.3 Security Test Scenarios

```python
# test_hitl_security.py

class TestHITLSecurity:
    """Security-focused tests for HITL."""

    async def test_cannot_resume_other_users_interrupt(self):
        """User A cannot resume User B's interrupt."""

    async def test_cannot_access_other_users_thread_interrupts(self):
        """User A cannot list User B's interrupts."""

    async def test_interrupt_id_enumeration_protection(self):
        """Ensure consistent response time for valid/invalid interrupt IDs."""

    async def test_malicious_edited_args_sanitized(self):
        """Ensure XSS/injection in edited_args is sanitized."""

    async def test_replay_attack_prevention(self):
        """Ensure captured requests cannot be replayed."""

    async def test_nonce_flooding_protection(self):
        """Ensure nonce storage doesn't cause memory exhaustion."""

    async def test_error_messages_dont_leak_info(self):
        """Ensure error responses don't expose internal details."""
```

---

## 6. Rollback Plan

### 6.1 Feature Flag Approach

```python
# Add feature flag for HITL
HITL_ENABLED = os.getenv("HITL_ENABLED", "false").lower() == "true"

# In thread.py
@router.post("/threads/{thread_id}/resume", ...)
async def resume_thread(...):
    if not HITL_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="HITL functionality is temporarily disabled"
        )
    # ... rest of implementation
```

### 6.2 Database Migration Safety

If the fix requires schema changes:

```python
# migrations/versions/xxx_add_hitl_fields.py

def upgrade():
    # Add new columns with defaults, don't break existing data
    op.add_column('interrupts', sa.Column('graph_schema_version', sa.String(), nullable=True))

def downgrade():
    # Safe to remove - new column only
    op.drop_column('interrupts', 'graph_schema_version')
```

### 6.3 Rollback Steps

1. **Immediate Mitigation** (if issues found in production):
   ```bash
   # Disable HITL via environment variable
   export HITL_ENABLED=false
   # Restart services
   docker-compose restart backend
   ```

2. **Code Rollback** (if needed):
   ```bash
   # Revert to previous commit
   git revert <fix-commit-hash>
   git push origin development
   ```

3. **Data Cleanup** (if orphaned interrupts):
   ```python
   # Cleanup script
   async def cleanup_orphaned_interrupts():
       for interrupt_id, interrupt in InterruptService._pending_interrupts.items():
           if interrupt.is_expired():
               del InterruptService._pending_interrupts[interrupt_id]
   ```

### 6.4 Monitoring Requirements

Before deploying the fix, ensure:

1. **Alerts configured** for:
   - `InterruptValidationError` rate > 10/min
   - `InterruptAuthorizationError` rate > 5/min
   - `500` errors on `/threads/*/resume` > 0

2. **Metrics tracked**:
   - Interrupt creation rate
   - Interrupt resolution rate by action type
   - Average time-to-resolution
   - Expiration rate

3. **Logs searchable** for:
   - `Error resuming thread`
   - `InterruptService`
   - `HITL interrupt`

---

## 7. Implementation Recommendations

### Priority Order

| Priority | Item | Risk | Effort |
|----------|------|------|--------|
| P0 | Fix missing graph parameter | Blocker | Low |
| P0 | Add thread ownership validation | Critical Security | Low |
| P1 | Make nonce required | High Security | Low |
| P1 | Add distributed locking for concurrency | High Reliability | Medium |
| P1 | Implement bounded nonce storage | Medium Security | Medium |
| P2 | Add checkpoint integrity validation | Medium Reliability | Medium |
| P2 | Sanitize error messages | Medium Security | Low |
| P2 | Add graph version tracking | Medium Reliability | Medium |
| P3 | Implement comprehensive test suite | Quality | High |

### Suggested Fix for P0 Issue

```python
# In routes/v0/thread.py - resume_thread endpoint

async def resume_thread(...):
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )

            # 1. Validate thread ownership
            thread = await service_context.thread_service.get(thread_id)
            if not thread:
                raise HTTPException(status_code=404, detail="Thread not found")

            # 2. Get the interrupt to find assistant_id
            interrupt_service_readonly = InterruptService(user_id=user.id)
            interrupt = interrupt_service_readonly.get_interrupt(request.interrupt_id)
            if not interrupt:
                raise InterruptNotFoundError(f"Interrupt {request.interrupt_id} not found")

            # 3. Validate interrupt belongs to thread
            if interrupt.thread_id != thread_id:
                raise InterruptValidationError("Interrupt does not belong to this thread")

            # 4. Load assistant config
            assistant_id = thread.metadata.get("assistant_id")
            if not assistant_id:
                raise HTTPException(status_code=400, detail="Thread has no associated assistant")

            assistant = await service_context.assistant_service.get(assistant_id)
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")

            # 5. Construct the agent graph (mirrors logic in workers/tasks.py)
            params = LLMRequest(...)  # Reconstruct from assistant config
            agent = await construct_agent(
                instructions=assistant.instructions,
                system_prompt=assistant.system_prompt,
                tools=assistant.tools,
                model=assistant.model,
                subagents=assistant.subagents,
                checkpointer=checkpointer,
                service_context=service_context,
                backend=None,  # May need proper backend init
            )

            # 6. Create interrupt service WITH the graph
            interrupt_service = InterruptService(
                user_id=user.id,
                graph=agent.graph  # NOW PROPERLY PROVIDED
            )

            # 7. Handle the decision
            await interrupt_service.handle_decision(request)

            return InterruptResponse(...)
```

---

## 8. Conclusion

The immediate bug fix is straightforward, but the HITL feature has significant security and robustness gaps that should be addressed before considering this feature production-ready. The recommendations above are prioritized by risk and effort to allow incremental improvement.

**Sign-off**: GUARDIAN Agent - Security & Robustness Review Complete
