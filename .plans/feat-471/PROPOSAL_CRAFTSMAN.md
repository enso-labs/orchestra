# PROPOSAL: Public Agents Implementation - Clean Code Approach

## Executive Summary

This proposal outlines a clean, maintainable implementation for exposing assistants publicly while obfuscating internal configuration. The approach leverages the existing `PromptService` public namespace pattern, extends the `Assistant` model with visibility controls, and introduces a `PublicAssistant` response model for safe external exposure. The design adheres to SOLID principles by keeping responsibilities clearly separated and ensuring the existing private assistant functionality remains unchanged.

## 1. Architectural Analysis

### 1.1 Current State

The current assistant system is tightly coupled to user namespacing:

| Component | File | Current Behavior |
|-----------|------|------------------|
| **Assistant Model** | `/backend/src/schemas/entities/llm.py` | No visibility controls; contains sensitive fields (`system_prompt`, `instructions`, `tools`, `mcp`, `a2a`) |
| **AssistantService** | `/backend/src/services/assistant.py` | Namespaced by `(user_id, "assistants")` - strictly private |
| **Assistant Routes** | `/backend/src/routes/v0/assistant.py` | All routes require `verify_credentials` |
| **LLM Routes** | `/backend/src/routes/v0/llm.py` | Uses `get_optional_user` but assistant lookup still user-scoped |
| **LLMService.assistant()** | `/backend/src/services/llm.py` | Fetches from user's namespace only |

### 1.2 Proposed Changes

The solution introduces a **dual-namespace architecture** mirroring the existing `PromptService` pattern:

```
Private Namespace: (user_id, "assistants")       - Owner access only
Public Namespace:  ("public", "assistants")      - Discoverable by anyone
```

Key architectural additions:

1. **Model Layer**: Add `public: bool` and `owner_id: str` fields; create `PublicAssistant` safe projection
2. **Service Layer**: Introduce `get_public()`, `publish()`, `unpublish()` methods with public namespace operations
3. **Route Layer**: Add publish/unpublish endpoints and public discovery endpoint
4. **LLM Service**: Fallback to public namespace for unauthenticated assistant lookups

### 1.3 Integration Points

| Integration Point | Change Required |
|-------------------|-----------------|
| `ServiceContext` | None - already passes `user_id` to `AssistantService` |
| `LLMController` | None - uses `LLMService.assistant()` which will be updated |
| `init_config()` | None - `assistant_id` already flows through metadata |
| Store operations | Use existing `store.aput()`, `store.aget()`, `store.adelete()` patterns |

## 2. Implementation Strategy

### Phase 1: Schema Updates

**File: `/backend/src/schemas/entities/llm.py`**

Add visibility fields to `Assistant` model and create a safe projection model:

```python
class Assistant(BaseModel):
    id: Optional[str] = None
    name: str
    description: str = Field(default="Helpful AI Assistant.")
    model: Optional[str] = None
    system_prompt: Optional[str] = Field(default=None, exclude=True)  # Exclude from public
    instructions: Optional[str] = Field(default=None, exclude=True)   # Exclude from public
    tools: list[str]
    subagents: Optional[list[dict]] = []
    mcp: Optional[dict] = {}
    a2a: Optional[dict] = {}
    metadata: dict = {}
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    # NEW FIELDS
    public: bool = Field(default=False, description="Whether the assistant is publicly accessible")
    owner_id: Optional[str] = Field(default=None, description="The user ID of the assistant owner")

    @computed_field
    @property
    def slug(self) -> str:
        return slugify(self.name)


class PublicAssistant(BaseModel):
    """Safe projection of Assistant for public access - excludes sensitive configuration."""
    id: str
    name: str
    description: str
    slug: str
    owner_id: Optional[str] = None
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @classmethod
    def from_assistant(cls, assistant: Assistant) -> "PublicAssistant":
        return cls(
            id=assistant.id,
            name=assistant.name,
            description=assistant.description,
            slug=assistant.slug,
            owner_id=assistant.owner_id,
            updated_at=assistant.updated_at,
            created_at=assistant.created_at,
        )

    @field_serializer("created_at", "updated_at")
    def serialize_dt(self, dt: Optional[datetime], _):
        return dt.isoformat() if dt else None
```

### Phase 2: Service Layer Updates

**File: `/backend/src/services/assistant.py`**

Extend `AssistantService` with public namespace operations following the `PromptService` pattern:

```python
STORE_KEY = "assistants"

class AssistantService:
    def __init__(self, user_id: str = None, store: BaseStore = get_store_in_memory()):
        self.user_id = user_id
        self.store: BaseStore = store

    def _get_store_key(self):
        return STORE_KEY

    def _get_namespace(self, public: bool = False):
        """Get namespace tuple for store operations."""
        if public:
            return ("public", self._get_store_key())
        return (self.user_id, self._get_store_key())

    async def get_public(self, assistant_id: str) -> Optional[Assistant]:
        """Retrieve an assistant from the public namespace."""
        try:
            assistant_raw = await self.store.aget(
                self._get_namespace(public=True),
                assistant_id
            )
            if assistant_raw:
                return self._format_assistant([assistant_raw])[0]
            return None
        except Exception as e:
            logger.exception(f"Error getting public assistant {assistant_id}: {e}")
            return None

    async def publish(self, assistant_id: str) -> bool:
        """Copy assistant to public namespace and mark as public."""
        try:
            # Get from user's namespace
            assistant = await self.get(assistant_id)
            if not assistant:
                raise ValueError(f"Assistant {assistant_id} not found")

            # Update assistant data
            assistant_data = assistant.model_dump()
            assistant_data["public"] = True
            assistant_data["owner_id"] = self.user_id

            # Save to user namespace (update public flag)
            await self.update(assistant_id, assistant_data)

            # Save to public namespace
            await self.store.aput(
                namespace=self._get_namespace(public=True),
                key=assistant_id,
                value=assistant_data,
            )
            return True
        except Exception as e:
            logger.exception(f"Error publishing assistant {assistant_id}: {e}")
            return False

    async def unpublish(self, assistant_id: str) -> bool:
        """Remove assistant from public namespace and mark as private."""
        try:
            # Get from user's namespace
            assistant = await self.get(assistant_id)
            if not assistant:
                raise ValueError(f"Assistant {assistant_id} not found")

            # Update assistant data
            assistant_data = assistant.model_dump()
            assistant_data["public"] = False

            # Save to user namespace (update public flag)
            await self.update(assistant_id, assistant_data)

            # Remove from public namespace
            await self.store.adelete(
                self._get_namespace(public=True),
                assistant_id
            )
            return True
        except Exception as e:
            logger.exception(f"Error unpublishing assistant {assistant_id}: {e}")
            return False

    async def update(self, assistant_id: str, data: dict):
        """Update assistant and sync to public namespace if public."""
        try:
            await self.store.aput(
                namespace=self._get_namespace(),
                key=assistant_id,
                value=data
            )

            # Sync to public namespace if assistant is public
            if data.get("public", False):
                await self.store.aput(
                    namespace=self._get_namespace(public=True),
                    key=assistant_id,
                    value=data,
                )
            return True
        except Exception as e:
            logger.exception(f"Error updating assistant {assistant_id}: {e}")
            return False

    async def search_public(self, limit: int = 100) -> list[Assistant]:
        """Search public assistants."""
        try:
            if isinstance(self.store, InMemoryStore):
                items = await self.store.asearch(
                    self._get_namespace(public=True),
                    limit=limit
                )
            else:
                async with self.store as store:
                    items = await store.asearch(
                        self._get_namespace(public=True),
                        limit=limit
                    )
            return self._format_assistant(items)
        except Exception as e:
            logger.error(f"Error searching public assistants: {e}")
            return []

    # ... existing methods remain unchanged
```

### Phase 3: Route Layer Updates

**File: `/backend/src/routes/v0/assistant.py`**

Add publish/unpublish and public discovery endpoints:

```python
from src.schemas.entities.llm import PublicAssistant

# Existing routes remain unchanged...

################################################################################
### Publish/Unpublish Assistant
################################################################################
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
    """Make an assistant publicly accessible."""
    try:
        service_context = ServiceContext(user_id=user.id, store=store)
        success = await service_context.assistant_service.publish(assistant_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to publish assistant",
            )
        return {"assistant_id": assistant_id, "public": True}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception(f"Error publishing assistant: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


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
    """Remove public access from an assistant."""
    try:
        service_context = ServiceContext(user_id=user.id, store=store)
        success = await service_context.assistant_service.unpublish(assistant_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to unpublish assistant",
            )
        return {"assistant_id": assistant_id, "public": False}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception(f"Error unpublishing assistant: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


################################################################################
### Public Assistant Discovery
################################################################################
@router.get(
    "/public/{assistant_id}",
    name="Get Public Assistant",
    operation_id="ruska_get_public_assistant",
    response_model=PublicAssistant,
)
async def get_public_assistant(
    assistant_id: str = Path(..., description="The ID of the public assistant"),
    store: AsyncPostgresStore = Depends(get_store),
):
    """Get public assistant info (limited fields) - no authentication required."""
    from src.services.assistant import AssistantService

    service = AssistantService(user_id=None, store=store)
    assistant = await service.get_public(assistant_id)

    if not assistant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Public assistant not found",
        )

    return PublicAssistant.from_assistant(assistant)


@router.get(
    "/public",
    name="List Public Assistants",
    operation_id="ruska_list_public_assistants",
)
async def list_public_assistants(
    limit: int = Query(default=50, le=200),
    store: AsyncPostgresStore = Depends(get_store),
):
    """List all public assistants - no authentication required."""
    from src.services.assistant import AssistantService

    service = AssistantService(user_id=None, store=store)
    assistants = await service.search_public(limit=limit)

    return {
        "assistants": [
            PublicAssistant.from_assistant(a).model_dump()
            for a in assistants
        ]
    }
```

### Phase 4: LLM Service Updates

**File: `/backend/src/services/llm.py`**

Update the `assistant()` method to check public namespace as a fallback:

```python
async def assistant(
    self,
    params: LLMRequest,
) -> LLMRequest:
    params.metadata.thread_id = params.metadata.thread_id or str(uuid4())
    params.input.to_langchain_messages()

    ## Protection if not defined
    if not params.system_prompt:
        params.system_prompt = DEFAULT_SYSTEM_PROMPT

    ## Auto Assign Assistant if ID is provided
    if params.metadata.assistant_id:
        # Try user's namespace first
        assistant: Assistant = await self.assistant_service.get(
            params.metadata.assistant_id
        )

        # Fallback to public namespace if not found in user namespace
        if not assistant:
            assistant = await self.assistant_service.get_public(
                params.metadata.assistant_id
            )

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
        else:
            logger.warning(
                f"Assistant {params.metadata.assistant_id} not found in user or public namespace"
            )

    ### Collect all tools
    params.system_prompt = self.default_system_prompt(params)
    params.tools = await self.init_tools(params.tools, params.a2a, params.mcp)
    return params
```

## 3. Design Decisions

### 3.1 Dual Namespace vs. Database Flag

**Decision**: Use dual namespace (mirroring `PromptService` pattern) rather than a simple database flag.

**Rationale**:
- **Consistency**: Follows the established pattern in `PromptService` which has been battle-tested
- **Query Efficiency**: Separate namespaces allow efficient queries without filtering
- **Access Control**: Clear separation prevents accidental exposure of private data
- **Simplicity**: Uses existing store API without requiring new query operations

**Trade-off**: Some data duplication between namespaces, but this is acceptable given the benefits and is already established practice.

### 3.2 PublicAssistant Response Model

**Decision**: Create a separate `PublicAssistant` Pydantic model rather than using field exclusions.

**Rationale**:
- **Explicit Contract**: Clear API contract for what external users receive
- **Type Safety**: Strong typing prevents accidental field leakage
- **Documentation**: OpenAPI schema accurately reflects public endpoint responses
- **Single Responsibility**: Separation of concerns between internal and external representations

### 3.3 Fallback Lookup in LLMService

**Decision**: Check user namespace first, then fallback to public namespace.

**Rationale**:
- **Owner Priority**: Owners can still use their own assistants privately
- **Minimal Change**: Existing flow for authenticated users unchanged
- **Graceful Degradation**: Unauthenticated users seamlessly access public assistants

### 3.4 owner_id Tracking

**Decision**: Store `owner_id` in the assistant data rather than deriving from namespace.

**Rationale**:
- **Auditability**: Clear ownership trail for public assistants
- **Future Features**: Enables attribution, analytics, and potential monetization
- **Self-Contained**: Public namespace entries are self-describing

## 4. Risk Assessment

### 4.1 Security Risks

| Risk | Mitigation |
|------|------------|
| Sensitive data leakage | `PublicAssistant` model explicitly excludes sensitive fields; never serialize full `Assistant` to public endpoints |
| Unauthorized publish | `publish`/`unpublish` endpoints require `verify_credentials` |
| Namespace collision | UUID-based assistant IDs prevent collisions |
| Owner spoofing | `owner_id` set server-side from authenticated user context |

### 4.2 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Publish non-existent assistant | Return 404 with "Assistant not found" |
| Unpublish already private assistant | Idempotent - return success |
| Delete published assistant | Need to also delete from public namespace (add to `delete()` method) |
| Update while public | Sync changes to both namespaces |
| Race conditions | Store operations are atomic per key |

### 4.3 Testing Considerations

- Unit tests should cover all service methods independently
- Integration tests should verify the full flow (create -> publish -> access -> unpublish)
- Security tests should verify sensitive fields never appear in public responses
- Performance tests for public assistant discovery at scale

## 5. Estimated Complexity

### 5.1 Scope

| Component | Files Changed | New Files | LOC Estimate |
|-----------|---------------|-----------|--------------|
| Schema | 1 | 0 | ~50 |
| Service | 1 | 0 | ~100 |
| Routes | 1 | 0 | ~80 |
| LLM Service | 1 | 0 | ~20 |
| Unit Tests | 0 | 1 | ~150 |
| Integration Tests | 0 | 1 | ~100 |
| **Total** | **4** | **2** | **~500** |

### 5.2 Risk Level

**Low to Medium**

- The pattern is well-established in `PromptService`
- No database schema changes required (uses existing store)
- Changes are additive with minimal impact on existing functionality
- Clear test strategy to verify correctness

### 5.3 Priority Order

1. **Schema Updates** - Foundation for all other changes
2. **Service Layer** - Core business logic
3. **Unit Tests** - Verify service logic in isolation
4. **Route Layer** - Expose functionality via API
5. **LLM Service Updates** - Enable public assistant usage in LLM flow
6. **Integration Tests** - End-to-end verification
