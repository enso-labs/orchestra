# Implementation Tasks: Public Agents Feature

## Pre-Implementation

- [x] Verify development environment setup
  - Files: N/A
  - Acceptance: `make dev` runs successfully
- [x] Create feature branch (if not already on one)
  - Files: N/A
  - Acceptance: `git status` shows `feat/471-public-agents` branch
- [x] Review REVIEW.md council decisions
  - Files: `.plans/feat-471/REVIEW.md`
  - Acceptance: Understand unified implementation plan

---

## Core Implementation

### 1. Schema Updates

- [x] Add `public`, `owner_id`, `published_at` fields to `Assistant` model
  - Files: `backend/src/schemas/entities/llm.py`
  - Acceptance: Fields exist with correct types and defaults

- [x] Create `PublicAssistant` response model with safe fields only
  - Files: `backend/src/schemas/entities/llm.py`
  - Acceptance: Model includes `id`, `name`, `description`, `slug`, `model`, `owner_id`, `published_at`, `created_at`, `updated_at`; Has `from_assistant()` classmethod

- [x] Add datetime serializer to `PublicAssistant`
  - Files: `backend/src/schemas/entities/llm.py`
  - Acceptance: `published_at` serializes to ISO format

### 2. Service Layer Updates

- [x] Add `_get_namespace(public: bool = False)` method to `AssistantService`
  - Files: `backend/src/services/assistant.py`
  - Acceptance: Returns `("public", "assistants")` when `public=True`, else `(user_id, "assistants")`

- [x] Add `_is_valid_uuid(value: str)` static helper method
  - Files: `backend/src/services/assistant.py`
  - Acceptance: Returns `True` for valid UUIDs, `False` otherwise

- [x] Add `get_public(assistant_id: str)` method
  - Files: `backend/src/services/assistant.py`
  - Acceptance: Returns `Assistant` from public namespace or `None`; Validates UUID format

- [x] Add `publish(assistant_id: str)` method
  - Files: `backend/src/services/assistant.py`
  - Acceptance: Copies to public namespace; Sets `public=True`, `owner_id`, `published_at`; Returns `True` on success

- [x] Add `unpublish(assistant_id: str)` method
  - Files: `backend/src/services/assistant.py`
  - Acceptance: Removes from public namespace; Sets `public=False`, clears `published_at`; Returns `True` on success

- [x] Add `search_public(limit: int, offset: int)` method
  - Files: `backend/src/services/assistant.py`
  - Acceptance: Returns list of public `Assistant` objects with pagination

- [x] Update `update()` method to sync to public namespace if public
  - Files: `backend/src/services/assistant.py`
  - Acceptance: When `data["public"]=True`, also updates public namespace copy

### 3. Route Updates

- [x] Add `POST /assistants/{assistant_id}/publish` endpoint
  - Files: `backend/src/routes/v0/assistant.py`
  - Acceptance: Requires auth; Validates UUID; Returns `{"assistant_id": ..., "public": True}`

- [x] Add `DELETE /assistants/{assistant_id}/publish` endpoint
  - Files: `backend/src/routes/v0/assistant.py`
  - Acceptance: Requires auth; Validates UUID; Returns `{"assistant_id": ..., "public": False}`

- [x] Add `GET /assistants/public/{assistant_id}` endpoint
  - Files: `backend/src/routes/v0/assistant.py`
  - Acceptance: No auth required; Validates UUID; Returns `PublicAssistant`; 404 for not found

- [x] Add `GET /assistants/public` endpoint
  - Files: `backend/src/routes/v0/assistant.py`
  - Acceptance: No auth required; Returns paginated list of `PublicAssistant`

- [x] Add required imports (`Query`, `uuid`, `PublicAssistant`)
  - Files: `backend/src/routes/v0/assistant.py`
  - Acceptance: No import errors

### 4. LLM Service Updates

- [x] Update `assistant()` method to fallback to public namespace
  - Files: `backend/src/services/llm.py`
  - Acceptance: If user namespace returns None, calls `get_public()`; Logs when loading public assistant

- [x] Add `get_public()` method call in `LLMService`
  - Files: `backend/src/services/llm.py`
  - Acceptance: Uses `self.assistant_service.get_public()` for fallback

---

## Testing

### 5. Unit Tests

- [x] Create test file `test_assistant_service.py`
  - Files: `backend/tests/unit/services/test_assistant_service.py`
  - Acceptance: File exists with proper imports and fixtures

- [x] Test `get_public` returns None for invalid UUID
  - Files: `backend/tests/unit/services/test_assistant_service.py`
  - Acceptance: Test passes

- [x] Test `get_public` returns None when not found
  - Files: `backend/tests/unit/services/test_assistant_service.py`
  - Acceptance: Test passes

- [x] Test `publish` sets owner_id and published_at
  - Files: `backend/tests/unit/services/test_assistant_service.py`
  - Acceptance: Test passes

- [x] Test `publish` fails for nonexistent assistant
  - Files: `backend/tests/unit/services/test_assistant_service.py`
  - Acceptance: Test passes

- [x] Test `publish` is idempotent if already public
  - Files: `backend/tests/unit/services/test_assistant_service.py`
  - Acceptance: Test passes

- [x] Test `unpublish` removes from public namespace
  - Files: `backend/tests/unit/services/test_assistant_service.py`
  - Acceptance: Test passes

- [x] Test `update` syncs to public if public flag is True
  - Files: `backend/tests/unit/services/test_assistant_service.py`
  - Acceptance: Test passes

- [x] Test `PublicAssistant` excludes sensitive fields
  - Files: `backend/tests/unit/services/test_assistant_service.py`
  - Acceptance: Test verifies `system_prompt`, `instructions`, `tools`, `mcp`, `a2a` not present

### 6. Integration Tests

- [x] Create test file `test_public_assistants.py`
  - Files: `backend/tests/integration/test_public_assistants.py`
  - Acceptance: File exists with proper imports

- [x] Test full publish lifecycle (create -> publish -> access -> unpublish)
  - Files: `backend/tests/integration/test_public_assistants.py`
  - Acceptance: Test defined (requires running DB to execute)

- [x] Test sensitive data not exposed in public response
  - Files: `backend/tests/integration/test_public_assistants.py`
  - Acceptance: Test defined (requires running DB to execute)

- [x] Test LLM invoke with public assistant_id (unauthenticated)
  - Files: `backend/tests/integration/test_public_assistants.py`
  - Acceptance: Test defined (requires running DB to execute)

- [x] Test invalid UUID returns 400
  - Files: `backend/tests/integration/test_public_assistants.py`
  - Acceptance: Test defined (requires running DB to execute)

---

## Verification

- [x] Run all unit tests
  - Command: `uv run --env-file ~/.env/orchestra/.env.backend pytest tests/unit/services/test_assistant_service.py -v`
  - Acceptance: **17 tests passed**

- [x] Run linting/formatting
  - Command: `cd backend && make format`
  - Acceptance: No errors (2 files reformatted)

- [ ] Manual API testing via Swagger UI
  - URL: `http://localhost:8080/docs`
  - Acceptance: All 4 new endpoints visible and functional
  - Note: Requires running server

- [x] Self-review against REVIEW.md checklist
  - Files: `.plans/feat-471/REVIEW.md`
  - Acceptance: All consensus points implemented

- [ ] Ready for PR
  - Acceptance: Code committed, tests passing, branch up to date

---

## Completion Signature

- **Total Tasks:** 35
- **Completed:** 33
- **Pending:** 2 (manual testing, PR creation)
- **Estimated Effort:** ~8 hours
- **Actual Effort:** Implementation complete

---

## Progress Log

### 2026-01-08
- [x] Phase 0: Built initial context from codebase
- [x] Phase 1: Generated 3 elite agent proposals (ARCHITECT, CRAFTSMAN, GUARDIAN)
- [x] Phase 2: Council review synthesized into REVIEW.md
- [x] Phase 3: Task contract generated in TASKS.md
- [x] Phase 4: Elite builder executed all implementation tasks
  - Schema: Added `public`, `owner_id`, `published_at` to Assistant; Created PublicAssistant model
  - Service: Implemented `get_public()`, `publish()`, `unpublish()`, `search_public()`; Updated `update()` for auto-sync
  - Routes: Added 4 new endpoints (`/public`, `/public/{id}`, `/{id}/publish`)
  - LLM Service: Updated `assistant()` with public namespace fallback
- [x] Phase 5: Validation
  - Unit tests: **17/17 passed**
  - Integration tests: 7 tests defined, require running server/DB

## Validation Results

### Unit Test Results
```
======================== 17 passed, 2 warnings in 0.08s ========================
```

All unit tests pass, verifying:
- UUID validation helper works correctly
- `get_public()` returns None for invalid/nonexistent assistants
- `publish()` sets owner_id and published_at correctly
- `publish()` is idempotent
- `unpublish()` removes from public namespace correctly
- `update()` syncs to public namespace when public=True
- `delete()` removes from both namespaces
- `search_public()` respects pagination
- `PublicAssistant.from_assistant()` excludes all sensitive fields

### Files Modified
| File | Changes |
|------|---------|
| `backend/src/schemas/entities/llm.py` | +45 lines (Assistant fields + PublicAssistant model) |
| `backend/src/services/assistant.py` | +115 lines (public namespace methods) |
| `backend/src/routes/v0/assistant.py` | +95 lines (4 new endpoints) |
| `backend/src/services/llm.py` | +18 lines (fallback logic) |
| `backend/tests/unit/services/test_assistant_service.py` | New file (260 lines, 17 tests) |
| `backend/tests/integration/test_public_assistants.py` | New file (170 lines, 7 tests) |

### Security Verification
- [x] `system_prompt` never exposed in public responses
- [x] `instructions` never exposed in public responses
- [x] `tools` never exposed in public responses
- [x] `mcp` never exposed in public responses
- [x] `a2a` never exposed in public responses
- [x] UUID validation prevents namespace injection
- [x] Publish/unpublish require authentication
- [x] Owner verification before publish operations
