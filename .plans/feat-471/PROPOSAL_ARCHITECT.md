# PROPOSAL: Public Agents Feature - Architectural Design

## Executive Summary

This proposal outlines the implementation of "Public Agents" functionality that allows users to expose their assistants to external users while obfuscating sensitive internals. The design leverages the existing namespace pattern from `PromptService` (which already implements public/private functionality) and introduces a separate public namespace `("public", "assistants", assistant_id)` for efficient lookups without requiring user authentication.

## Architectural Analysis

### Current State

**Data Flow for Assistants:**
1. User creates assistant via `POST /assistants` (requires auth)
2. Assistant stored in LangGraph store at namespace `(user_id, "assistants")`
3. LLM invocation via `/llm/invoke` or `/llm/stream` with `assistant_id` in metadata
4. `LLMService.assistant()` loads assistant from user's namespace
5. **Problem**: Unauthenticated users cannot access assistants because they have no `user_id` to construct the namespace

**Existing Public Pattern (PromptService):**
```python
def _get_namespace(self, prompt_id: str = "", public: bool = False):
    if public:
        return ("public", STORE_KEY, prompt_id)  # Global public namespace
    return (self.user_id, STORE_KEY, prompt_id)  # User-scoped namespace
```

This pattern provides:
- Dual storage: items exist in both user namespace (for owner management) and public namespace (for external access)
- `toggle_public()` method to publish/unpublish
- Clear separation of concerns

### Proposed Changes

**1. Namespace Strategy:**
- Private assistants: `(user_id, "assistants")` with key = `assistant_id`
- Public assistants: `("public", "assistants")` with key = `assistant_id`

**2. Data Model Updates:**
- Add `public: bool = False` to Assistant model
- Add `owner_id: Optional[str] = None` to track original owner for audit
- Create `PublicAssistant` Pydantic model exposing only safe fields

**3. Service Layer:**
- Add `_get_public_namespace()` helper method
- Add `get_public(assistant_id)` for external lookup
- Add `publish(assistant_id)` / `unpublish(assistant_id)` methods
- Update `update()` to sync changes to public namespace if `public=True`

**4. Route Layer:**
- `POST /assistants/{id}/publish` - Authenticated owner publishes
- `DELETE /assistants/{id}/publish` - Authenticated owner unpublishes
- `GET /assistants/public/{id}` - Public endpoint returns `PublicAssistant`

**5. LLM Service Integration:**
- Modify `LLMService.assistant()` to fall back to public namespace lookup
- Allow unauthenticated users to invoke public assistants

### Integration Points

| Component | File | Change Required |
|-----------|------|-----------------|
| Schema | `backend/src/schemas/entities/llm.py` | Add `public`, `owner_id` fields; create `PublicAssistant` |
| Service | `backend/src/services/assistant.py` | Add public namespace methods |
| Routes | `backend/src/routes/v0/assistant.py` | Add publish/unpublish/public-get endpoints |
| LLM Service | `backend/src/services/llm.py` | Add fallback to public namespace |
| Context | `backend/src/contexts/service.py` | No changes needed |

## Implementation Strategy

### Step 1: Schema Updates (`backend/src/schemas/entities/llm.py`)

```python
class Assistant(BaseModel):
    # ... existing fields ...
    public: bool = False
    owner_id: Optional[str] = None

class PublicAssistant(BaseModel):
    """Safe response model for public assistant endpoints."""
    id: str
    name: str
    description: str
    slug: str
    owner_id: Optional[str] = None
```

**Rationale**: The `owner_id` field tracks who created the assistant for audit purposes. The `PublicAssistant` model ensures sensitive fields like `system_prompt`, `tools`, `mcp`, `a2a` are never exposed.

### Step 2: Service Layer (`backend/src/services/assistant.py`)

Add methods following the `PromptService` pattern:

```python
STORE_KEY = "assistants"

class AssistantService:
    def _get_namespace(self):
        return (self.user_id, STORE_KEY)

    def _get_public_namespace(self):
        return ("public", STORE_KEY)

    async def get_public(self, assistant_id: str) -> Optional[Assistant]:
        """Retrieve a public assistant by ID from the public namespace."""
        result = await self.store.aget(self._get_public_namespace(), assistant_id)
        if result:
            return self._format_assistant([result])[0]
        return None

    async def publish(self, assistant_id: str) -> bool:
        """Copy assistant to public namespace and set public=True."""
        assistant = await self.get(assistant_id)
        if not assistant:
            return False

        assistant.public = True
        assistant.owner_id = self.user_id

        # Store in public namespace
        await self.store.aput(
            namespace=self._get_public_namespace(),
            key=assistant_id,
            value=assistant.model_dump()
        )

        # Update in user namespace
        await self.update(assistant_id, assistant.model_dump())
        return True

    async def unpublish(self, assistant_id: str) -> bool:
        """Remove assistant from public namespace and set public=False."""
        assistant = await self.get(assistant_id)
        if not assistant:
            return False

        # Remove from public namespace
        await self.store.adelete(self._get_public_namespace(), assistant_id)

        # Update in user namespace
        assistant.public = False
        await self.update(assistant_id, assistant.model_dump())
        return True
```

**Rationale**: Following the proven pattern from `PromptService.toggle_public()` ensures consistency. The dual-storage approach means:
- Owner can always manage their assistant via their namespace
- External users can access via the public namespace without needing `user_id`

### Step 3: Route Updates (`backend/src/routes/v0/assistant.py`)

```python
from src.schemas.entities.llm import PublicAssistant

@router.post("/{assistant_id}/publish", name="Publish Assistant")
async def publish_assistant(
    assistant_id: str = Path(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    success = await service_context.assistant_service.publish(assistant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Assistant not found")
    return {"assistant_id": assistant_id, "public": True}


@router.delete("/{assistant_id}/publish", name="Unpublish Assistant")
async def unpublish_assistant(
    assistant_id: str = Path(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    success = await service_context.assistant_service.unpublish(assistant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Assistant not found")
    return {"assistant_id": assistant_id, "public": False}


@router.get("/public/{assistant_id}", name="Get Public Assistant", response_model=PublicAssistant)
async def get_public_assistant(
    assistant_id: str = Path(...),
    store: AsyncPostgresStore = Depends(get_store),
):
    """Get a public assistant's info (no auth required)."""
    service = AssistantService(user_id=None, store=store)
    assistant = await service.get_public(assistant_id)
    if not assistant:
        raise HTTPException(status_code=404, detail="Public assistant not found")
    return PublicAssistant(
        id=assistant.id,
        name=assistant.name,
        description=assistant.description,
        slug=assistant.slug,
        owner_id=assistant.owner_id,
    )
```

**Rationale**:
- `/public/{id}` has no auth dependency - anyone can access
- Publish/unpublish require owner authentication
- Response model enforces field obfuscation

### Step 4: LLM Service Update (`backend/src/services/llm.py`)

```python
async def assistant(self, params: LLMRequest) -> LLMRequest:
    params.metadata.thread_id = params.metadata.thread_id or str(uuid4())
    params.input.to_langchain_messages()

    if not params.system_prompt:
        params.system_prompt = DEFAULT_SYSTEM_PROMPT

    if params.metadata.assistant_id:
        # Try user's namespace first (if user_id exists)
        assistant: Assistant = None
        if self.user_id:
            assistant = await self.assistant_service.get(params.metadata.assistant_id)

        # Fall back to public namespace
        if not assistant:
            assistant = await self.assistant_service.get_public(params.metadata.assistant_id)

        if assistant:
            assistant.system_prompt = self.default_system_prompt(assistant)
            assistant.tools = await self.init_tools(
                assistant.tools, assistant.a2a, assistant.mcp
            )
            return assistant.to_llm_request(
                input=params.input,
                model=params.model,
                metadata=params.metadata,
            )
        # If assistant_id provided but not found, continue with default params

    params.system_prompt = self.default_system_prompt(params)
    params.tools = await self.init_tools(params.tools, params.a2a, params.mcp)
    return params
```

**Rationale**: The fallback pattern ensures:
- Authenticated users first check their own namespace (in case they own a private copy)
- Then check public namespace for shared assistants
- Unauthenticated users skip straight to public namespace lookup

## Design Decisions

### Decision 1: Dual Storage vs. Filter-based Lookup

**Options:**
- A) Dual storage (store in both user and public namespace)
- B) Single storage with `public=True` flag, filter all searches

**Chosen: Option A (Dual Storage)**

**Rationale:**
- Matches existing `PromptService` pattern - proven and consistent
- More efficient lookups - no need to scan all namespaces
- Clear ownership boundary - user namespace is authoritative
- Simpler authorization - public namespace inherently has no auth checks

### Decision 2: Separate PublicAssistant Model vs. Field Exclusion

**Options:**
- A) Create separate `PublicAssistant` Pydantic model
- B) Use `response_model_exclude` in route decorator

**Chosen: Option A (Separate Model)**

**Rationale:**
- Explicit API contract - OpenAPI schema clearly shows public fields
- Compile-time safety - cannot accidentally expose sensitive fields
- Easier to extend - can add public-specific fields later
- Self-documenting code

### Decision 3: Sync on Update vs. Lazy Sync

**Options:**
- A) Automatically sync public namespace when assistant updated
- B) Require explicit re-publish after changes

**Chosen: Option B (Explicit Re-publish) initially, then A as enhancement**

**Rationale:**
- Simpler initial implementation
- Clear user intent - owner consciously publishes updates
- Can add auto-sync as Phase 2 enhancement
- Avoids accidental exposure of draft changes

## Risk Assessment

### Potential Pitfalls

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Public namespace collision | Low | High | Use UUIDs as keys (already standard) |
| Stale public copy | Medium | Low | Document that updates require re-publish; add auto-sync later |
| Sensitive data leakage | Medium | High | Strict `PublicAssistant` model; code review |
| Performance at scale | Low | Medium | LangGraph store is optimized; add caching if needed |

### Edge Cases

1. **Deleted owner account**: Public assistant remains accessible (orphaned). Consider adding `owner_id` validation or cleanup job.

2. **Simultaneous publish/update**: Race condition could leave inconsistent state. Consider atomic operations or optimistic locking.

3. **Public assistant with private tools**: Tools referenced by name may not be accessible to external users. Need to validate tool availability.

4. **MCP/A2A servers on public assistants**: External users cannot access owner's private MCP servers. Should validate or warn on publish.

### Testing Strategy

**Unit Tests:**
- `test_assistant_service_get_public`: Verify public namespace lookup
- `test_assistant_service_publish`: Verify dual-write to both namespaces
- `test_assistant_service_unpublish`: Verify removal from public namespace
- `test_public_assistant_excludes_sensitive_fields`: Verify model filtering

**Integration Tests:**
- `test_llm_invoke_public_assistant_unauthenticated`: Full flow without auth
- `test_llm_invoke_public_assistant_authenticated`: Verify authenticated user can also use public assistants
- `test_publish_requires_owner`: Verify non-owners cannot publish others' assistants

## Estimated Complexity

**Scope**: Medium - touches 4-5 files with isolated changes

**Risk Level**: Low-Medium - follows established patterns

**Priority Order:**
1. Schema changes (blocking dependency)
2. Service layer methods (core logic)
3. Route endpoints (API surface)
4. LLM service integration (enables usage)
5. Tests (validation)
