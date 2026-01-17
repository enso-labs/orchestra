---
task: Implement Human-in-the-Loop API Routes for DeepAgents
test_command: "make test"
---

# Task: Human-in-the-Loop API Routes

Implement API endpoints to enable human-in-the-loop workflows in Orchestra's deepagent system. This allows humans to approve, edit, or reject tool calls before execution.

## Requirements

1. Create Pydantic schemas in `backend/src/schemas/entities/hitl.py`
2. Extend `CheckpointService` with interrupt detection and resume methods
3. Add two new endpoints to `backend/src/routes/v0/thread.py`
4. Write comprehensive unit tests
5. Validate with curl commands

## Success Criteria

### Phase 1: Schemas
1. [ ] `hitl.py` contains `DecisionType` enum (ACCEPT, EDIT, RESPONSE, REJECT)
2. [ ] `HumanDecision` model validates decision_type and required fields per type
3. [ ] `InterruptInfo` model captures tool_name, tool_args, description, config
4. [ ] `InterruptListResponse` model with thread_id, has_interrupts, interrupts list
5. [ ] `ResumeRequest` model accepts list of decisions
6. [ ] `ResumeResponse` model returns success, thread_id, message, checkpoint_id
7. [ ] Schemas exported from `backend/src/schemas/entities/__init__.py`

### Phase 2: Service Layer
8. [ ] `CheckpointService.get_interrupts(thread_id)` returns interrupt data from StateSnapshot
9. [ ] `CheckpointService.resume_with_decision(thread_id, decisions)` uses `Command(resume=...)`
10. [ ] Service methods handle missing graph gracefully (return empty/raise ValueError)

### Phase 3: API Routes
11. [ ] `GET /threads/{thread_id}/interrupts` endpoint returns `InterruptListResponse`
12. [ ] `POST /threads/{thread_id}/resume` endpoint accepts `ResumeRequest`, returns `ResumeResponse`
13. [ ] Both endpoints require authentication via `verify_credentials`
14. [ ] Resume validates decision types against interrupt's allowed_actions config
15. [ ] Resume returns 400/409 when no interrupt pending
16. [ ] Endpoints appear in OpenAPI docs at `/docs` with HITL tag

### Phase 4: Unit Tests
17. [ ] Schema tests validate all decision types and edge cases
18. [ ] Service tests mock graph state and verify correct behavior
19. [ ] Route tests verify HTTP status codes and response formats
20. [ ] All tests pass with `make test`

### Phase 5: curl Validation
21. [ ] Create thread, invoke with `human_assistance` tool, triggers interrupt
22. [ ] `GET /interrupts` returns `has_interrupts: true` with interrupt details
23. [ ] `POST /resume` with accept decision returns success
24. [ ] `GET /interrupts` after resume returns `has_interrupts: false`
25. [ ] Error cases return appropriate status codes (400, 401, 404, 409)

## Example curl Commands

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "test1234"}' \
  | jq -r '.access_token')

# Check for interrupts
curl -s -X GET "http://localhost:8000/api/threads/$THREAD_ID/interrupts" \
  -H "Authorization: Bearer $TOKEN" | jq

# Resume with accept
curl -s -X POST "http://localhost:8000/api/threads/$THREAD_ID/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"decisions": [{"decision_type": "accept"}]}' | jq

# Resume with edit
curl -s -X POST "http://localhost:8000/api/threads/$THREAD_ID/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"decisions": [{"decision_type": "edit", "edited_args": {"query": "modified"}}]}' | jq

# Resume with response
curl -s -X POST "http://localhost:8000/api/threads/$THREAD_ID/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"decisions": [{"decision_type": "response", "response_content": "User feedback here"}]}' | jq
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/src/schemas/entities/hitl.py` | CREATE |
| `backend/src/schemas/entities/__init__.py` | MODIFY |
| `backend/src/services/checkpoint.py` | MODIFY |
| `backend/src/routes/v0/thread.py` | MODIFY |
| `backend/tests/unit/schemas/test_hitl_schemas.py` | CREATE |
| `backend/tests/unit/services/test_checkpoint_hitl.py` | CREATE |
| `backend/tests/unit/routes/test_thread_hitl.py` | CREATE |

## Reference Documents

- **REVIEW.md**: Council decisions and unified architecture
- **TASKS.md**: Detailed 42-task implementation checklist
- **PROPOSAL_*.md**: Individual agent proposals with code examples

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run `make test` after changes to verify unit tests pass
4. Run `make format` to ensure code style compliance
5. Commit your changes frequently with descriptive messages
6. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
7. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
