# Council Review: Synthesis of Agent Proposals

**Issue:** #336 - "Graph is required to handle interrupt decisions"
**Date:** 2026-01-16
**Reviewers:** ARCHITECT, CRAFTSMAN, GUARDIAN

---

## Executive Summary

All three agents agree on the root cause and core solution. The `resume_thread` endpoint in `src/routes/v0/thread.py` must reconstruct the agent graph before passing it to `InterruptService`. This mirrors the existing pattern in `workers/tasks.py` and `utils/stream.py`.

---

## Consensus Points

### 1. Root Cause (Unanimous)
The `resume_thread` endpoint creates `InterruptService(user_id=user.id)` without the required `graph` parameter. The service's `handle_decision()` method correctly validates this at line 342-343 in `interrupt.py`.

### 2. Solution Approach (Unanimous)
Reconstruct the agent graph in `resume_thread` using:
- `construct_agent()` from `src/flows/__init__.py`
- Following the pattern in `workers/tasks.py` lines 80-132

### 3. Key Steps (Agreed)
1. Get thread data to extract `assistant_id`
2. Load assistant configuration
3. Build `LLMRequest` from assistant config
4. Initialize `ToolRuntime`, `Backend`
5. Call `construct_agent()` to get compiled graph
6. Pass `graph=agent.graph` to `InterruptService`
7. Call `handle_decision()`

---

## Divergent Perspectives

| Topic | ARCHITECT | CRAFTSMAN | GUARDIAN |
|-------|-----------|-----------|----------|
| **Focus** | System architecture & data flow | Concrete implementation code | Security & edge cases |
| **Scope** | Full architectural options | Single file changes | 12 security issues + rollback |
| **Graph caching** | Proposed as optimization | Not addressed | Version tracking for safety |
| **Error handling** | Edge cases listed | Basic HTTP exceptions | Comprehensive error taxonomy |
| **Testing** | Success criteria checklist | Manual curl examples | Full test suite specification |

---

## Synthesized Implementation Plan

### Phase 1: Core Fix (P0)
**Combines**: CRAFTSMAN's concrete code + GUARDIAN's ownership validation

1. Add required imports to `thread.py`
2. Rewrite `resume_thread` to reconstruct graph
3. Add thread ownership validation
4. Validate interrupt belongs to thread

### Phase 2: Security Hardening (P1)
**From**: GUARDIAN's security analysis

1. Make nonce required (not optional)
2. Add distributed locking for concurrent requests
3. Sanitize error messages to prevent info leakage

### Phase 3: Robustness (P2)
**Combines**: ARCHITECT's architecture + GUARDIAN's edge cases

1. Add checkpoint integrity validation
2. Handle assistant/thread deletion edge cases
3. Add graph version tracking

---

## Files to Modify

| File | Changes | Source |
|------|---------|--------|
| `src/routes/v0/thread.py` | Major rewrite of `resume_thread` | CRAFTSMAN |
| `src/services/interrupt.py` | Minor: require nonce, fix ownership | GUARDIAN |

---

## Accepted Implementation

Based on the council review, we accept **CRAFTSMAN's implementation** with these additions from **GUARDIAN**:

1. **Thread ownership validation** (lines 717-719 in GUARDIAN)
2. **Interrupt-thread relationship validation** (lines 728-729 in GUARDIAN)
3. **Error message sanitization** (no `str(e)` exposure)

The ARCHITECT's graph caching optimization is deferred to a follow-up task.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Graph construction latency | Medium | Low | Acceptable for now; cache later |
| Assistant deleted during interrupt | Low | Medium | 404 error with cleanup |
| Concurrent resume requests | Medium | High | Future: add distributed locking |
| Checkpoint corruption | Low | High | Future: add integrity checks |

---

## Success Criteria

1. [ ] User can click "Approve" without 500 error
2. [ ] User can edit tool arguments and resume
3. [ ] User can reject tool calls
4. [ ] Unauthorized users cannot resume others' threads
5. [ ] Tests pass

---

## Next Steps

1. Generate TASKS.md with specific implementation steps
2. Execute implementation in `thread.py`
3. Run tests
4. Manual validation with curl

---

*Council Review Complete*
