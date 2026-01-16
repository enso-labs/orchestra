# HITL Implementation Proposal: Security, Error Handling, and Testing

## Agent 3: THE GUARDIAN - Security & Reliability Analysis

---

## 1. Executive Summary

This proposal presents a security-first implementation strategy for Human-In-The-Loop (HITL) support, focusing on robust authorization controls, comprehensive input validation, graceful failure handling, and extensive test coverage. The design leverages Orchestra's existing `add_human_in_the_loop()` wrapper and `NodeInterrupt` patterns while introducing new safeguards against replay attacks, unauthorized approvals, and malformed edited arguments.

---

## 2. Security Analysis

### 2.1 Threat Model for HITL

| Threat | Severity | Mitigation Strategy |
|--------|----------|---------------------|
| **Unauthorized Approval** | Critical | Thread-level ownership validation via `user_id` + `thread_id` binding |
| **Replay Attack** | High | One-time-use nonces with `interrupt_id` tied to specific checkpoint |
| **Argument Injection** | High | Re-validate edited args against `args_schema` before execution |
| **Stale Approval** | Medium | TTL-based expiration on pending interrupts |
| **Session Hijacking** | High | JWT validation + session binding |
| **Denial of Service** | Medium | Rate limiting on interrupt creation |

### 2.2 Authorization Requirements

#### A. User-Level Authorization (Existing)
- JWT token validation with expiration checking
- API key authentication via `x-api-key` header
- User existence verification

#### B. Thread-Level Isolation
- Path namespacing: `("threads", user_id, thread_id)`
- Implicit thread ownership verification

#### C. Interrupt-Level Authorization (New)

```python
@dataclass
class InterruptAuthorizationContext:
    user_id: str
    thread_id: str
    interrupt_id: str
    checkpoint_id: str
    nonce: str  # One-time use token
    expires_at: datetime
    tool_name: str
    original_args_hash: str  # SHA256 for integrity
```

### 2.3 Data Validation Requirements

**Current Vulnerability - Unvalidated Edited Args:**
```python
# CURRENT (Vulnerable)
elif response["type"] == "edit":
    tool_input = response["args"]["args"]  # NO VALIDATION!
    tool_response = tool.invoke(tool_input, config)
```

**Required Fix:**
```python
# SECURE VERSION
elif response["type"] == "edit":
    edited_args = response["args"]["args"]
    if tool.args_schema:
        try:
            validated_args = tool.args_schema(**edited_args).model_dump()
        except ValidationError as e:
            raise InterruptValidationError(f"Failed validation: {e.errors()}")
    tool_response = tool.invoke(validated_args, config)
```

---

## 3. Error Handling Strategy

### 3.1 Failure Scenarios and Recovery

| Scenario | Detection | Recovery | User Feedback |
|----------|-----------|----------|---------------|
| Timeout on Pending Approval | TTL expiration | Auto-reject | SSE: `interrupt_timeout` |
| Invalid Edited Args | Pydantic validation | Reject edit, request re-submission | SSE: `validation_error` |
| Checkpoint Not Found | `aget_state()` returns None | Graceful termination | HTTP 404 |
| Database Connection Loss | Retry decorator | 3 retries with backoff | SSE: `error, recoverable: true` |
| Concurrent Approval Conflict | Optimistic locking | First wins, second rejected | HTTP 409 Conflict |

### 3.2 HITL-Specific Error Events

```python
HITL_ERROR_TYPES = {
    "interrupt_pending": {"code": "HITL_001", "recoverable": True},
    "interrupt_timeout": {"code": "HITL_002", "recoverable": False},
    "validation_error": {"code": "HITL_003", "recoverable": True},
    "authorization_denied": {"code": "HITL_004", "recoverable": False},
    "concurrent_conflict": {"code": "HITL_005", "recoverable": True},
}
```

---

## 4. Testing Plan

### 4.1 Unit Test Coverage

#### `tests/unit/utils/test_hitl_tools.py`
- `test_accept_response_invokes_tool()`
- `test_edit_response_validates_schema()`
- `test_edit_response_rejects_invalid_args()`
- `test_reject_response_returns_feedback()`
- `test_unsupported_response_type_raises()`

#### `tests/unit/services/test_hitl_authorization.py`
- `test_user_can_approve_own_thread()`
- `test_user_cannot_approve_other_thread()`
- `test_expired_interrupt_rejected()`
- `test_nonce_prevents_replay()`
- `test_interrupt_id_format_validation()`

### 4.2 Integration Test Scenarios

#### `tests/integration/test_hitl_flow.py`
- `test_full_approval_flow()` - Complete SSE→Decision→Resume cycle
- `test_edit_flow_with_validation()` - Modified args validation
- `test_reject_flow()` - Rejection reason returned to LLM
- `test_timeout_handling()` - Auto-rejection after TTL

### 4.3 Edge Case Identification

| Edge Case | Test Location | Expected Behavior |
|-----------|---------------|-------------------|
| Multiple concurrent interrupts | `test_hitl_flow.py` | Queue, process sequentially |
| Approval during database outage | `test_hitl_flow.py` | Retry, then graceful failure |
| Browser refresh during interrupt | `frontend/tests` | Restore state from checkpoint |
| Large edited arguments (>10KB) | Unit tests | Reject with size limit error |
| Rapid approve/reject toggling | `test_hitl_flow.py` | Debounce, accept first |

---

## 5. Risk Assessment

### 5.1 Security Vulnerabilities

| Vulnerability | Current State | Mitigation |
|--------------|---------------|------------|
| Unvalidated edited args | **VULNERABLE** | Schema re-validation |
| Missing thread ownership check | Partial | Add explicit user_id verification |
| No replay protection | **VULNERABLE** | Implement nonce system |
| TTL bypass | Not implemented | Enforce server-side TTL |

### 5.2 Reliability Risks

| Risk | Probability | Mitigation |
|------|-------------|------------|
| Checkpoint corruption during interrupt | Low | Transaction-based updates |
| Stream disconnection losing state | Medium | Persist interrupt to store |
| Memory exhaustion from pending interrupts | Low | Queue size limits, TTL cleanup |
| Race condition in concurrent approvals | Medium | Optimistic locking |

---

## 6. Complexity Assessment

**Overall Scope: Large** (security requirements add significant scope)
**Overall Risk Level: Medium-High**

### Priority Order
1. **Phase 1: Security Foundations** - Authorization context, nonce system, arg validation
2. **Phase 2: Backend Infrastructure** - HITL service, endpoints, TTL/cleanup
3. **Phase 3: Frontend Integration** - Modal, client-side validation
4. **Phase 4: Testing & Hardening** - Full test suite, security audit
