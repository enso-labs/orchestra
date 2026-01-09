# Public Agents

## Summary

The intention of this is to allow users to expose these agents to external users but obfuscate the internals of that assistant from the end user. This would be allowing the regular query params to be passed AND the assistant_id which includes the details of the agent in the server.

## Research Findings

### Current Implementation

-   **Routes** (`backend/src/routes/v0/assistant.py`): CRUD operations for assistants - all require user authentication via `verify_credentials`
-   **Schema** (`backend/src/schemas/entities/llm.py`): `Assistant` model contains fields like `name`, `tools`, `system_prompt`, `instructions`, `mcp`, `a2a`, etc. `LLMRequest` accepts an optional `assistant_id` in its `Config` metadata
-   **Service** (`backend/src/services/assistant.py`): Uses a store (Postgres or InMemory) to persist assistants, namespaced by `(user_id, "assistants")` - meaning assistants are private to their owner
-   **LLM Service** (`backend/src/services/llm.py`): The `assistant()` method checks for `params.metadata.assistant_id` and loads the assistant config, but uses the current user's namespace
-   **LLM Routes** (`backend/src/routes/v0/llm.py`): Uses `get_optional_user` allowing unauthenticated access, but assistant lookup still requires user context

### Key Problem

Assistants are namespaced by `user_id` in the store. External users (unauthenticated or different user) cannot access another user's assistant because the namespace won't match. We need a mechanism to:

1. Mark assistants as "public"
2. Store/retrieve public assistants in a way that external users can access them by ID
3. Obfuscate sensitive internals (system_prompt, tools config) from the public response

---

## Phase 1: Backend Implementation - COMPLETE

### 1.1 Schema Updates

**File**: `backend/src/schemas/entities/llm.py`

-   [x] Add `public: bool = False` field to `Assistant` model
-   [x] Add `owner_id: Optional[str] = None` field to `Assistant` model (to track original owner)
-   [x] Add `published_at: Optional[datetime] = None` field to `Assistant` model
-   [x] Create `PublicAssistant` response model that exposes only safe fields (id, name, description, slug, model, owner_id, published_at, created_at, updated_at)

### 1.2 Service Layer Updates

**File**: `backend/src/services/assistant.py`

-   [x] Add method `get_public(assistant_id: str) -> Assistant | None` that searches public namespace
-   [x] Add method `publish(assistant_id: str) -> bool` to copy assistant to public namespace
-   [x] Add method `unpublish(assistant_id: str) -> bool` to remove from public namespace
-   [x] Add method `search_public(limit: int, offset: int)` to list public assistants with pagination
-   [x] Add helper `_is_valid_uuid(value: str)` for UUID validation (security)
-   [x] Update `_get_namespace(public: bool = False)` to support public namespace
-   [x] Update `update()` to sync changes to public namespace if assistant is public
-   [x] Update `delete()` to remove from public namespace if assistant was public

### 1.3 Route Updates

**File**: `backend/src/routes/v0/assistant.py`

-   [x] Add `POST /assistants/{assistant_id}/publish` endpoint to make an assistant public
-   [x] Add `DELETE /assistants/{assistant_id}/publish` endpoint to make an assistant private
-   [x] Add `GET /assistants/public/{assistant_id}` endpoint for external users to get minimal public info
-   [x] Add `GET /assistants/public` endpoint to list all public assistants with pagination

### 1.4 LLM Service Updates

**File**: `backend/src/services/llm.py`

-   [x] Update `assistant()` method to check public namespace if user namespace returns None
-   [x] Ensure public assistant lookup works for unauthenticated users
-   [x] Add logging when loading public assistant for anonymous user

### 1.5 Unit Tests

**File**: `backend/tests/unit/services/test_assistant_service.py` (NEW - 17 tests)

-   [x] Test `_is_valid_uuid()` helper returns correct results
-   [x] Test `get_public()` returns None for invalid UUID
-   [x] Test `get_public()` returns None when not found
-   [x] Test `publish()` sets owner_id and published_at correctly
-   [x] Test `publish()` fails for nonexistent assistant
-   [x] Test `publish()` is idempotent (can call multiple times)
-   [x] Test `unpublish()` removes from public namespace
-   [x] Test `update()` syncs to public namespace when public=True
-   [x] Test `delete()` removes from both namespaces
-   [x] Test `search_public()` respects pagination
-   [x] Test `PublicAssistant.from_assistant()` excludes sensitive fields

### 1.6 Integration Tests

**File**: `backend/tests/integration/test_public_assistants.py` (NEW - 7 tests)

-   [x] Test full publish lifecycle (create -> publish -> access -> unpublish)
-   [x] Test sensitive data not exposed in public response
-   [x] Test listing public assistants with pagination
-   [x] Test invalid UUID returns 400 error
-   [x] Test unpublished assistant not accessible publicly
-   [x] Test publish requires authentication
-   [x] Test publish requires ownership

### 1.7 Test Infrastructure Fixes

**Files**: `backend/tests/unit/repos/test_tool_repo.py`, `backend/tests/unit/services/test_tool_service.py`

-   [x] Fixed pre-existing test failures by mocking `TOOL_LIBRARY` with `TEST_TOOLS`
-   [x] Used `patch.start()`/`stop()` pattern in `setUp()`/`tearDown()` for proper async test compatibility

---

## Test Results

```
================== 33 passed, 2 skipped, 3 warnings in 2.88s ===================
```

All tests pass including:
- 17 unit tests for AssistantService public methods
- 7 integration tests for public assistant endpoints
- 2 tool tests (previously failing, now fixed)

---

## Security Verification

-   [x] `system_prompt` never exposed in public responses
-   [x] `instructions` never exposed in public responses
-   [x] `tools` never exposed in public responses
-   [x] `mcp` never exposed in public responses
-   [x] `a2a` never exposed in public responses
-   [x] UUID validation prevents namespace injection attacks
-   [x] Publish/unpublish require authentication
-   [x] Owner verification before publish operations

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/src/schemas/entities/llm.py` | +45 lines (Assistant fields + PublicAssistant model) |
| `backend/src/services/assistant.py` | +115 lines (public namespace methods) |
| `backend/src/routes/v0/assistant.py` | +95 lines (4 new endpoints) |
| `backend/src/services/llm.py` | +18 lines (fallback logic) |
| `backend/tests/unit/services/test_assistant_service.py` | New file (260 lines, 17 tests) |
| `backend/tests/integration/test_public_assistants.py` | New file (170 lines, 7 tests) |
| `backend/tests/unit/repos/test_tool_repo.py` | Fixed TOOL_LIBRARY mocking |
| `backend/tests/unit/services/test_tool_service.py` | Fixed TOOL_LIBRARY mocking |

---

## Phase 2: Frontend Implementation - COMPLETE

### 2.1 Assistant Management UI

-   [x] Add "Public" toggle switch in assistant create/edit form
-   [x] Display public/private status badge on assistant cards
-   [x] Add share button for public assistants that copies shareable link/ID

### 2.2 Public Assistant Access

-   [x] Create route `/a/{assistant_id}` for public agent chat
-   [x] Implement minimal UI for public agent interaction (no login required)
-   [x] Show only agent name/description, hide internal configuration

### 2.3 Discovery (Optional/Future)

-   [ ] Public agent gallery/browse page
-   [ ] Search/filter public agents

---

## Frontend Files Modified

| File | Changes |
|------|---------|
| `frontend/src/lib/services/agentService.ts` | Added `public`, `owner_id`, `published_at` fields to Agent type; Added `publish()`, `unpublish()`, `getPublic()`, `listPublic()` methods |
| `frontend/src/components/forms/agents/agent-create-form.tsx` | Added public toggle switch with Globe/Lock icons; Integrated publish/unpublish API calls |
| `frontend/src/pages/agents/index.tsx` | Added public/private badges; Added share button for public agents |
| `frontend/src/pages/agents/public.tsx` | New file - Public agent chat page using NoAuthLayout |
| `frontend/src/routes/AppRoutes.tsx` | Added `/a/:agentId` public route |

---

## Acceptance Criteria

### Phase 1 (Backend) - COMPLETE

-   [x] `Assistant` model includes `public`, `owner_id`, `published_at` fields
-   [x] Public assistants accessible via `assistant_id` without authentication
-   [x] Private assistant internals not exposed in public endpoints
-   [x] All new/updated functions have corresponding unit tests
-   [x] Existing functionality unchanged for private assistants

### Phase 2 (Frontend) - COMPLETE

-   [x] Users can toggle assistant visibility (public/private)
-   [x] Public assistants shareable via link
-   [x] External users can interact with public agents without login
-   [x] UI does not expose internal agent configuration to external users
