# PROPOSAL: Public Agents Feature - Security-Focused Design

## 1. Executive Summary

This proposal outlines the security-hardened implementation of public agents functionality for Orchestra, enabling users to share assistants externally while protecting sensitive internal configurations. The design prioritizes defense-in-depth authorization, explicit data exposure controls, comprehensive error handling, and robust test coverage to prevent data leakage, unauthorized access, and abuse scenarios.

## 2. Architectural Analysis

### 2.1 Current State

**Authentication Pattern** (`backend/src/utils/auth.py`):
- `verify_credentials`: Requires valid JWT or API key; raises `HTTPException(401)` on failure
- `get_optional_user`: Allows unauthenticated access for free models; returns `None` for anonymous users
- Both functions attach user context to `request.state`

**Assistant Data Model** (`backend/src/schemas/entities/llm.py`):
```python
class Assistant(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    model: Optional[str] = None
    system_prompt: Optional[str]      # SENSITIVE - must not expose
    instructions: Optional[str]       # SENSITIVE - must not expose
    tools: list[str]                  # SENSITIVE - internal tool names
    subagents: Optional[list[dict]]   # SENSITIVE - agent composition
    mcp: Optional[dict]               # SENSITIVE - MCP server configs
    a2a: Optional[dict]               # SENSITIVE - A2A connections
    metadata: dict                    # May contain sensitive config
    slug: str                         # Computed, safe to expose
```

**Storage Architecture** (`backend/src/services/assistant.py`):
- Namespace: `(user_id, "assistants")` - strictly user-scoped
- Uses LangGraph store abstraction (Postgres or InMemory)
- No cross-namespace queries exist currently

**Existing Public Pattern** (`backend/src/services/prompt/__init__.py`):
- Uses `("public", "prompts", prompt_id)` namespace for public items
- `toggle_public()` copies/removes from public namespace
- Good reference pattern but lacks owner tracking

### 2.2 Security Vulnerabilities in Naive Implementation

| Vulnerability | Risk | Mitigation |
|--------------|------|------------|
| Namespace injection | Medium | Validate `assistant_id` format before namespace construction |
| IDOR via public endpoint | High | Always verify `owner_id` matches authenticated user for mutations |
| Sensitive data exposure | Critical | Use separate response model; never return full `Assistant` object publicly |
| Race condition on publish/unpublish | Low | Use atomic operations; accept eventual consistency |
| Rate limiting bypass | Medium | Apply stricter limits to public endpoints |
| Enumeration attacks | Medium | Do not differentiate "not found" vs "not public" errors |

### 2.3 Proposed Architecture

```
                   ┌─────────────────────────────────────────┐
                   │           PUBLIC NAMESPACE              │
                   │  ("public", "assistants", assistant_id) │
                   │                                         │
                   │  Stores: PublicAssistantRecord          │
                   │    - id, name, description, slug        │
                   │    - owner_id (for back-reference)      │
                   │    - model (optional, if allowed)       │
                   │    - published_at                       │
                   └───────────────┬─────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────────┐   ┌──────────────────┐   ┌──────────────────────┐
│ Private Namespace │   │ LLMService       │   │ Public Routes        │
│ (user_id,         │   │                  │   │                      │
│  "assistants")    │   │ 1. Check user NS │   │ GET /assistants/     │
│                   │   │ 2. Fallback to   │   │   public/{id}        │
│ Full Assistant    │◄──│    public NS     │   │                      │
│ with all fields   │   │ 3. Merge configs │   │ Returns only safe    │
└───────────────────┘   └──────────────────┘   │ PublicAssistant      │
                                               └──────────────────────┘
```

## 3. Implementation Strategy

### 3.1 Schema Updates

**File: `backend/src/schemas/entities/llm.py`**

Add new fields to `Assistant`:
```python
class Assistant(BaseModel):
    # ... existing fields ...
    public: bool = Field(default=False, description="Whether assistant is publicly accessible")
    owner_id: Optional[str] = Field(default=None, description="Original owner's user ID")
    published_at: Optional[datetime] = Field(default=None, description="When assistant was made public")
```

Create new response models for public access:
```python
class PublicAssistant(BaseModel):
    """Safe subset of Assistant fields for public exposure."""
    id: str
    name: str
    description: str
    slug: str
    model: Optional[str] = None  # Only expose if explicitly allowed
    owner_id: str
    published_at: Optional[datetime] = None

    @classmethod
    def from_assistant(cls, assistant: Assistant) -> "PublicAssistant":
        """Create PublicAssistant from full Assistant, stripping sensitive fields."""
        return cls(
            id=assistant.id,
            name=assistant.name,
            description=assistant.description,
            slug=assistant.slug,
            model=assistant.model if cls._should_expose_model(assistant) else None,
            owner_id=assistant.owner_id,
            published_at=assistant.published_at,
        )

    @staticmethod
    def _should_expose_model(assistant: Assistant) -> bool:
        """Determine if model should be exposed based on configuration."""
        return True  # Or make configurable

class PublicAssistantList(BaseModel):
    """Response model for listing public assistants."""
    assistants: list[PublicAssistant]
    total: int
    limit: int
    offset: int
```

### 3.2 Service Layer Updates

**File: `backend/src/services/assistant.py`**

```python
class AssistantService:
    PUBLIC_NAMESPACE_PREFIX = "public"

    def _get_public_namespace(self, assistant_id: str = None) -> tuple:
        """Get namespace for public assistants."""
        if assistant_id:
            return (self.PUBLIC_NAMESPACE_PREFIX, self._get_store_key(), assistant_id)
        return (self.PUBLIC_NAMESPACE_PREFIX, self._get_store_key())

    async def get_public(self, assistant_id: str) -> Optional[Assistant]:
        """
        Retrieve a public assistant by ID.

        Security: This returns the full Assistant for internal use.
        Routes must convert to PublicAssistant before returning to clients.
        """
        if not self._is_valid_uuid(assistant_id):
            return None

        try:
            item = await self.store.aget(
                self._get_public_namespace(assistant_id),
                assistant_id
            )
            if item:
                return self._format_assistant([item])[0]
            return None
        except Exception as e:
            logger.exception(f"Error retrieving public assistant {assistant_id}: {e}")
            return None

    async def publish(self, assistant_id: str) -> bool:
        """
        Publish an assistant to the public namespace.

        Security: Caller must verify ownership before calling.
        Returns False if assistant not found in user's namespace.
        """
        # First, get from user's private namespace
        assistant = await self.get(assistant_id)
        if not assistant:
            logger.warning(f"Publish failed: assistant {assistant_id} not found for user {self.user_id}")
            return False

        # Already public check
        if assistant.public:
            return True

        # Update assistant metadata
        assistant.public = True
        assistant.owner_id = self.user_id
        assistant.published_at = datetime.now(timezone.utc)

        try:
            # Store in public namespace
            await self.store.aput(
                namespace=self._get_public_namespace(assistant_id),
                key=assistant_id,
                value=assistant.model_dump(),
            )

            # Update private copy with public flag
            await self.update(assistant_id, assistant.model_dump())

            logger.info(f"Published assistant {assistant_id} by user {self.user_id}")
            return True
        except Exception as e:
            logger.exception(f"Error publishing assistant {assistant_id}: {e}")
            return False

    async def unpublish(self, assistant_id: str) -> bool:
        """
        Remove an assistant from the public namespace.

        Security: Caller must verify ownership before calling.
        """
        assistant = await self.get(assistant_id)
        if not assistant:
            return False

        if not assistant.public:
            return True  # Already private

        try:
            # Remove from public namespace
            await self.store.adelete(
                self._get_public_namespace(assistant_id),
                assistant_id
            )

            # Update private copy
            assistant.public = False
            assistant.published_at = None
            await self.update(assistant_id, assistant.model_dump())

            logger.info(f"Unpublished assistant {assistant_id} by user {self.user_id}")
            return True
        except Exception as e:
            logger.exception(f"Error unpublishing assistant {assistant_id}: {e}")
            return False

    async def search_public(self, limit: int = 100, offset: int = 0) -> list[Assistant]:
        """
        Search all public assistants.

        Security: Results must be converted to PublicAssistant by routes.
        """
        try:
            items = await self.store.asearch(
                self._get_public_namespace(),
                limit=limit,
            )
            return self._format_assistant(list(items)[offset:offset + limit])
        except Exception as e:
            logger.exception(f"Error searching public assistants: {e}")
            return []

    @staticmethod
    def _is_valid_uuid(value: str) -> bool:
        """Validate string is a proper UUID to prevent injection."""
        try:
            uuid.UUID(value, version=4)
            return True
        except (ValueError, AttributeError):
            return False
```

### 3.3 Route Updates

**File: `backend/src/routes/v0/assistant.py`**

```python
from src.schemas.entities.llm import PublicAssistant, PublicAssistantList

# --- Public Routes (no auth required) ---

@router.get(
    "/public/{assistant_id}",
    name="Get Public Assistant",
    operation_id="ruska_get_public_assistant",
    response_model=dict,
)
async def get_public_assistant(
    assistant_id: str = Path(..., description="The ID of the public assistant"),
    store: AsyncPostgresStore = Depends(get_store),
):
    """
    Retrieve a public assistant's safe information.

    Security: Returns only non-sensitive fields (name, description, slug).
    Does not differentiate between "not found" and "not public" to prevent enumeration.
    """
    # Input validation
    try:
        uuid.UUID(assistant_id, version=4)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assistant ID format"
        )

    service = AssistantService(user_id=None, store=store)
    assistant = await service.get_public(assistant_id)

    if not assistant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Public assistant not found"
        )

    # Convert to safe response model
    return {"assistant": PublicAssistant.from_assistant(assistant).model_dump()}


@router.get(
    "/public",
    name="List Public Assistants",
    operation_id="ruska_list_public_assistants",
)
async def list_public_assistants(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    store: AsyncPostgresStore = Depends(get_store),
):
    """List all public assistants with pagination."""
    service = AssistantService(user_id=None, store=store)
    assistants = await service.search_public(limit=limit, offset=offset)

    public_list = [PublicAssistant.from_assistant(a) for a in assistants]
    return {
        "assistants": [a.model_dump() for a in public_list],
        "limit": limit,
        "offset": offset,
    }


# --- Authenticated Routes ---

@router.post(
    "/{assistant_id}/publish",
    name="Publish Assistant",
    operation_id="ruska_publish_assistant",
)
async def publish_assistant(
    assistant_id: str = Path(..., description="The ID of the assistant to publish"),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """
    Make an assistant publicly accessible.

    Security: Only the owner can publish their assistant.
    """
    try:
        uuid.UUID(assistant_id, version=4)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assistant ID format"
        )

    service_context = ServiceContext(user_id=user.id, store=store)

    # Verify ownership by checking user's namespace
    assistant = await service_context.assistant_service.get(assistant_id)
    if not assistant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assistant not found"
        )

    success = await service_context.assistant_service.publish(assistant_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to publish assistant"
        )

    return {"assistant_id": assistant_id, "public": True}


@router.delete(
    "/{assistant_id}/publish",
    name="Unpublish Assistant",
    operation_id="ruska_unpublish_assistant",
)
async def unpublish_assistant(
    assistant_id: str = Path(..., description="The ID of the assistant to unpublish"),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """
    Make an assistant private again.

    Security: Only the owner can unpublish their assistant.
    """
    try:
        uuid.UUID(assistant_id, version=4)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assistant ID format"
        )

    service_context = ServiceContext(user_id=user.id, store=store)

    # Verify ownership
    assistant = await service_context.assistant_service.get(assistant_id)
    if not assistant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assistant not found"
        )

    success = await service_context.assistant_service.unpublish(assistant_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unpublish assistant"
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

### 3.4 LLM Service Updates

**File: `backend/src/services/llm.py`**

```python
async def assistant(
    self,
    params: LLMRequest,
) -> LLMRequest:
    params.metadata.thread_id = params.metadata.thread_id or str(uuid4())
    params.input.to_langchain_messages()

    if not params.system_prompt:
        params.system_prompt = DEFAULT_SYSTEM_PROMPT

    if params.metadata.assistant_id:
        # Try user's private namespace first
        assistant: Optional[Assistant] = await self.assistant_service.get(
            params.metadata.assistant_id
        )

        # Fall back to public namespace if not found and user_id is None/different
        if not assistant:
            assistant = await self.assistant_service.get_public(
                params.metadata.assistant_id
            )

            if assistant:
                logger.info(
                    f"Loading public assistant {params.metadata.assistant_id} "
                    f"for user {self.user_id or 'anonymous'}"
                )

        if not assistant:
            logger.warning(f"Assistant {params.metadata.assistant_id} not found")
            raise ValueError(f"Assistant not found: {params.metadata.assistant_id}")

        assistant.system_prompt = self.default_system_prompt(assistant)
        assistant.tools = await self.init_tools(
            assistant.tools, assistant.a2a, assistant.mcp
        )
        return assistant.to_llm_request(
            input=params.input,
            model=params.model,
            metadata=params.metadata,
        )

    params.system_prompt = self.default_system_prompt(params)
    params.tools = await self.init_tools(params.tools, params.a2a, params.mcp)
    return params
```

## 4. Design Decisions

### 4.1 Trade-offs Analysis

| Decision | Pros | Cons | Rationale |
|----------|------|------|-----------|
| Separate public namespace | Clean separation; easy to query all public | Data duplication; sync required | Follows existing prompt pattern; enables fast public queries |
| Store `owner_id` in public record | Enables back-reference for updates | Slight redundancy | Required for sync operations and audit trail |
| Single "not found" error for public | Prevents enumeration attacks | Less debugging info | Security best practice |
| UUID validation at route level | Prevents injection early | Repeated code | Defense in depth |
| `PublicAssistant` response model | Explicit field whitelist | Must maintain sync | Prevents accidental exposure |

### 4.2 Why Not Just Filter on Query?

The alternative approach of adding a `WHERE public = true` filter was rejected because:
1. Cross-namespace queries are not naturally supported by LangGraph store
2. Would require modifying store abstraction layer
3. Separate namespace provides clearer security boundary
4. Enables future features like public assistant search/discovery

### 4.3 Model Exposure Decision

The `model` field can be exposed because:
- It's not a security secret (users select from available models)
- Knowing the model helps users understand assistant capabilities
- Can be made configurable via assistant metadata if needed

## 5. Risk Assessment

### 5.1 Security Pitfalls

| Risk | Severity | Mitigation |
|------|----------|------------|
| System prompt exposure | CRITICAL | `PublicAssistant` model excludes all sensitive fields |
| Tool configuration leak | HIGH | Only tool names exposed if model allows; no configs |
| MCP/A2A server details | HIGH | Never exposed in public responses |
| Cross-user namespace access | CRITICAL | Service methods validate user_id before operations |
| Rate limit bypass via public endpoints | MEDIUM | Apply `@limiter.limit("100/day")` to public routes |
| Denial of service via search | MEDIUM | Enforce pagination limits (max 100) |

### 5.2 Edge Cases

1. **User deletes account while having public assistants**
   - Action: Migration to remove orphaned public assistants
   - Or: Store owner_id allows cleanup queries

2. **Public assistant references private tools**
   - Behavior: Tool initialization will fail
   - Mitigation: Validate tool availability during publish

3. **Race condition: publish + delete simultaneously**
   - Result: Public namespace may have stale data
   - Mitigation: Acceptable; cleanup job can handle

4. **Invalid UUID in path parameter**
   - Behavior: Return 400 Bad Request (not 500)
   - Mitigation: Explicit UUID validation before service calls

5. **Public assistant with no model specified**
   - Behavior: Uses default model
   - Mitigation: Enforce model requirement during publish

### 5.3 Testing Requirements

**Unit Tests:**
- Test `get_public` returns None for invalid UUID
- Test `publish` sets owner_id correctly
- Test `publish` fails for non-existent assistant
- Test `unpublish` removes from public namespace
- Test `PublicAssistant.from_assistant` excludes sensitive fields

**Integration Tests:**
- Test full publish/access/unpublish lifecycle
- Test sensitive data never exposed in responses
- Test cannot publish others' assistants
- Test invalid UUID returns 400

**Security Tests:**
- Verify system_prompt never in public responses
- Verify tools, mcp, a2a never exposed
- Verify rate limiting on public endpoints

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Component | Files Modified | New Files | Complexity |
|-----------|---------------|-----------|------------|
| Schema updates | 1 | 0 | Low |
| AssistantService | 1 | 0 | Medium |
| Assistant routes | 1 | 0 | Medium |
| LLMService | 1 | 0 | Low |
| Unit tests | 0 | 1 | Medium |
| Integration tests | 0 | 1 | Medium |

### 6.2 Risk Level

| Risk Category | Level | Notes |
|--------------|-------|-------|
| Breaking changes | Low | New endpoints only; existing unchanged |
| Data migration | Low | No schema migration needed (LangGraph store) |
| Security exposure | Medium | Requires careful testing |
| Performance impact | Low | Additional namespace lookup is minimal |

### 6.3 Implementation Priority Order

1. **Schema updates** - Foundation for all other changes
2. **AssistantService methods** - Core logic
3. **Route handlers** - API exposure
4. **LLMService updates** - Enable public assistant usage
5. **Unit tests** - Verify service logic
6. **Integration tests** - Verify end-to-end flow
7. **Documentation** - API docs and security notes
