# ELITE COUNCIL REVIEW: Public Agents Feature

## Overview

**Feature Under Review:** Public Agents - Allow users to expose their assistants to external users while obfuscating internals

**Proposals Reviewed:**
1. `PROPOSAL_ARCHITECT.md` - System design and architectural patterns focus
2. `PROPOSAL_CRAFTSMAN.md` - Clean code and maintainability focus
3. `PROPOSAL_GUARDIAN.md` - Security, error handling, and testing focus

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | Council Verdict |
|--------|-----------|-----------|----------|-----------------|
| **Architecture** | Dual namespace pattern following PromptService | Same dual namespace approach | Same + explicit namespace prefixes | **CONSENSUS: Dual namespace** |
| **Model Fields** | `public`, `owner_id` | `public`, `owner_id` | `public`, `owner_id`, `published_at` | **ADOPT: Include `published_at`** |
| **PublicAssistant** | Basic safe projection | `from_assistant()` classmethod | `from_assistant()` + configurable model exposure | **ADOPT: Guardian's approach** |
| **Service Methods** | `get_public`, `publish`, `unpublish` | Same + `search_public` | Same + UUID validation helper | **ADOPT: All methods + validation** |
| **Routes** | 3 endpoints (publish, unpublish, get) | 4 endpoints (+list public) | 4 endpoints + input validation | **ADOPT: 4 endpoints with validation** |
| **Error Handling** | Basic HTTPException | ValueError distinction | UUID validation + uniform error messages | **ADOPT: Guardian's approach** |
| **Sync on Update** | Explicit re-publish | Auto-sync if public | Auto-sync if public | **ADOPT: Auto-sync** |
| **Testing** | Unit + integration outline | Detailed test examples | Security-focused tests | **ADOPT: Comprehensive from all** |
| **Risk Assessment** | High-level risks | Edge case table | Security threat matrix | **ADOPT: Guardian's depth** |

---

## 2. Consensus Points

All three proposals agree on these fundamental design decisions:

### 2.1 Dual Namespace Architecture
```
Private: (user_id, "assistants")     - Owner access only
Public:  ("public", "assistants")    - Anyone can access
```

**Rationale:** Follows the established `PromptService` pattern, provides clean separation of concerns, and enables efficient queries without cross-namespace filtering.

### 2.2 PublicAssistant Response Model
A separate Pydantic model that explicitly includes only safe fields:
- `id`, `name`, `description`, `slug`
- `owner_id` (for attribution)
- Timestamps (`created_at`, `updated_at`, `published_at`)

**Rationale:** Prevents accidental exposure of sensitive fields like `system_prompt`, `tools`, `mcp`, `a2a`.

### 2.3 Service Layer Methods
- `get_public(assistant_id)` - Retrieve from public namespace
- `publish(assistant_id)` - Copy to public namespace, set flags
- `unpublish(assistant_id)` - Remove from public namespace
- `search_public(limit, offset)` - List all public assistants

### 2.4 Route Structure
- `POST /assistants/{id}/publish` - Authenticated, owner only
- `DELETE /assistants/{id}/publish` - Authenticated, owner only
- `GET /assistants/public/{id}` - No auth required
- `GET /assistants/public` - No auth required, paginated

### 2.5 LLM Service Fallback
Check user namespace first, then fall back to public namespace for `assistant_id` lookup.

---

## 3. Divergence Analysis

### 3.1 `published_at` Field

| Proposal | Recommendation |
|----------|----------------|
| ARCHITECT | Not included |
| CRAFTSMAN | Not included |
| GUARDIAN | Include `published_at: Optional[datetime]` |

**Council Decision:** **INCLUDE `published_at`**

**Rationale:** Provides audit trail, enables "recently published" sorting, and supports future analytics. Minimal overhead, high value.

### 3.2 Auto-Sync vs. Explicit Re-publish

| Proposal | Recommendation |
|----------|----------------|
| ARCHITECT | Explicit re-publish (simpler, clearer intent) |
| CRAFTSMAN | Auto-sync in `update()` if `public=True` |
| GUARDIAN | Auto-sync in `update()` if `public=True` |

**Council Decision:** **AUTO-SYNC**

**Rationale:** Better user experience - changes to public assistants should be immediately visible. The CRAFTSMAN implementation is clean and follows DRY principles.

### 3.3 UUID Validation

| Proposal | Recommendation |
|----------|----------------|
| ARCHITECT | Not explicit |
| CRAFTSMAN | Not explicit |
| GUARDIAN | Explicit `_is_valid_uuid()` helper + route validation |

**Council Decision:** **INCLUDE UUID VALIDATION**

**Rationale:** Defense in depth. Prevents namespace injection and provides clear error messages (400 vs 500).

### 3.4 Error Message Strategy

| Proposal | Recommendation |
|----------|----------------|
| ARCHITECT | Specific error messages |
| CRAFTSMAN | Specific error messages |
| GUARDIAN | Uniform "not found" to prevent enumeration |

**Council Decision:** **UNIFORM "NOT FOUND" FOR PUBLIC ENDPOINTS ONLY**

**Rationale:** Public endpoints should not differentiate between "doesn't exist" and "exists but not public" to prevent enumeration attacks. Authenticated endpoints can provide more specific errors.

### 3.5 Model Field Exposure

| Proposal | Recommendation |
|----------|----------------|
| ARCHITECT | Include in PublicAssistant |
| CRAFTSMAN | Include in PublicAssistant |
| GUARDIAN | Configurable via `_should_expose_model()` |

**Council Decision:** **SIMPLE INCLUDE**

**Rationale:** Model name is not sensitive information. Adding configurability adds complexity without clear benefit. Keep it simple.

---

## 4. Unified Implementation Plan

### Phase 1: Schema Updates
**File:** `backend/src/schemas/entities/llm.py`

1. Add fields to `Assistant` model:
   ```python
   public: bool = Field(default=False)
   owner_id: Optional[str] = Field(default=None)
   published_at: Optional[datetime] = Field(default=None)
   ```

2. Create `PublicAssistant` model:
   ```python
   class PublicAssistant(BaseModel):
       id: str
       name: str
       description: str
       slug: str
       model: Optional[str] = None
       owner_id: Optional[str] = None
       published_at: Optional[datetime] = None
       updated_at: Optional[datetime] = None
       created_at: Optional[datetime] = None

       @classmethod
       def from_assistant(cls, assistant: Assistant) -> "PublicAssistant":
           return cls(
               id=assistant.id,
               name=assistant.name,
               description=assistant.description,
               slug=assistant.slug,
               model=assistant.model,
               owner_id=assistant.owner_id,
               published_at=assistant.published_at,
               updated_at=assistant.updated_at,
               created_at=assistant.created_at,
           )

       @field_serializer("created_at", "updated_at", "published_at")
       def serialize_dt(self, dt: Optional[datetime], _):
           return dt.isoformat() if dt else None
   ```

### Phase 2: Service Layer Updates
**File:** `backend/src/services/assistant.py`

1. Add `_get_namespace(public: bool = False)` method
2. Add `get_public(assistant_id: str)` method with UUID validation
3. Add `publish(assistant_id: str)` method
4. Add `unpublish(assistant_id: str)` method
5. Add `search_public(limit: int, offset: int)` method
6. Update `update()` to sync to public namespace if `public=True`
7. Add `_is_valid_uuid(value: str)` helper

### Phase 3: Route Updates
**File:** `backend/src/routes/v0/assistant.py`

1. Add `POST /{assistant_id}/publish` - requires auth
2. Add `DELETE /{assistant_id}/publish` - requires auth
3. Add `GET /public/{assistant_id}` - no auth
4. Add `GET /public` - no auth, paginated
5. Add UUID validation at route level for public endpoints

### Phase 4: LLM Service Updates
**File:** `backend/src/services/llm.py`

1. Update `assistant()` method to:
   - First check user namespace (if user_id exists)
   - Fall back to public namespace via `get_public()`
   - Log when loading public assistant

### Phase 5: Unit Tests
**File:** `backend/tests/unit/services/test_assistant_service.py`

1. `test_get_public_returns_none_for_invalid_uuid`
2. `test_get_public_returns_none_when_not_found`
3. `test_publish_sets_owner_id_and_published_at`
4. `test_publish_fails_for_nonexistent_assistant`
5. `test_publish_idempotent_if_already_public`
6. `test_unpublish_removes_from_public_namespace`
7. `test_unpublish_idempotent_if_already_private`
8. `test_update_syncs_to_public_if_public`
9. `test_public_assistant_excludes_sensitive_fields`

### Phase 6: Integration Tests
**File:** `backend/tests/integration/test_public_assistants.py`

1. `test_public_assistant_lifecycle` - create -> publish -> access -> unpublish
2. `test_public_assistant_does_not_expose_sensitive_data`
3. `test_llm_invoke_with_public_assistant_unauthenticated`
4. `test_invalid_uuid_returns_400`
5. `test_cannot_access_unpublished_assistant_publicly`

---

## 5. Risk Consolidation

### Critical Risks (Must Mitigate)

| Risk | Mitigation |
|------|------------|
| Sensitive data exposure | `PublicAssistant` model with explicit field whitelist |
| Unauthorized publish | `verify_credentials` + namespace ownership check |
| Namespace injection | UUID validation before namespace construction |

### Medium Risks (Should Mitigate)

| Risk | Mitigation |
|------|------------|
| Enumeration attacks | Uniform "not found" error for public endpoints |
| Stale public data | Auto-sync on update |
| Rate limiting bypass | Apply rate limits to public endpoints |

### Low Risks (Acceptable)

| Risk | Mitigation |
|------|------------|
| Orphaned public assistants | Future cleanup job based on `owner_id` |
| Race conditions | Atomic store operations; eventual consistency acceptable |

---

## 6. Final Verdict

### Recommendation: **GO**

**Confidence Level:** **HIGH**

**Rationale:**
1. Design follows established patterns (PromptService)
2. All proposals converged on the same architecture
3. Changes are additive with minimal risk to existing functionality
4. Clear test strategy covers security concerns
5. No database schema changes required (uses existing LangGraph store)

### Required Conditions:
- [ ] All unit tests pass before merging
- [ ] Integration tests verify sensitive data never exposed
- [ ] Code review focuses on `PublicAssistant` model completeness
- [ ] Rate limiting applied to public endpoints

### Implementation Priority:
1. Schema changes (foundation)
2. Service layer (core logic)
3. Unit tests (verify service)
4. Routes (expose API)
5. LLM service update (enable usage)
6. Integration tests (verify e2e)

### Estimated Effort:
- **Schema:** ~30 min
- **Service:** ~2 hours
- **Routes:** ~1 hour
- **LLM Service:** ~30 min
- **Unit Tests:** ~2 hours
- **Integration Tests:** ~2 hours
- **Total:** ~8 hours

---

## Appendix: Files to Modify

| File | Changes |
|------|---------|
| `backend/src/schemas/entities/llm.py` | Add `public`, `owner_id`, `published_at` to Assistant; Create `PublicAssistant` model |
| `backend/src/services/assistant.py` | Add `get_public()`, `publish()`, `unpublish()`, `search_public()`, `_is_valid_uuid()`; Update `update()` |
| `backend/src/routes/v0/assistant.py` | Add 4 new endpoints with appropriate auth |
| `backend/src/services/llm.py` | Update `assistant()` with public namespace fallback |
| `backend/tests/unit/services/test_assistant_service.py` | New file with 9+ test cases |
| `backend/tests/integration/test_public_assistants.py` | New file with 5+ test cases |
