# PROPOSAL_OPTIMIZER.md

## GitHub Issue #663: FEAT - Auth User Can Share Private Thread via Link to Anon Users

### AGENT_4: OPTIMIZER Perspective
**Focus Areas:** Performance, Efficiency, Resource Management

---

## 1. Executive Summary

This proposal outlines an efficient implementation for thread sharing that leverages cryptographic share tokens for secure anonymous access, implements intelligent caching at multiple layers to minimize database queries, and enforces low-cost model restrictions for anonymous users to optimize LLM spend while encouraging sign-ups.

---

## 2. Performance Analysis

### 2.1 Current Caching Infrastructure

- `fastapi_cache2` with `InMemoryBackend`
- User-scoped cache key builder prevents cross-user data leakage
- Cache TTLs: 15s (threads), 30s (assistants, schedules, tools)
- Thread retrieval uses `@cache(expire=15)` decorator

### 2.2 Model Cost Structure

```python
# backend/src/constants/llm.py
def get_default_low_cost_model():
    """Get default low-cost chat model."""
    if GOOGLE_API_KEY:
        return ChatModels.GOOGLE_GEMINI_3_FLASH_PREVIEW.value
    if OPENAI_API_KEY:
        return ChatModels.OPENAI_GPT_5_NANO.value
    # ... fallbacks to cheaper models
```

---

## 3. Implementation Strategy

### Phase 1: Optimized Token Storage

```python
# backend/src/repos/share_token_repo.py

class ShareTokenRepo:
    NAMESPACE = ("shared", "tokens")  # Global namespace

    async def create(self, token: ShareToken) -> ShareToken:
        """Create share token with TTL matching expires_at."""
        ttl = None
        if token.expires_at:
            ttl = int((token.expires_at - datetime.utcnow()).total_seconds())
        await self.store.aput(self.NAMESPACE, token.id, token.model_dump(), ttl=ttl)
        return token

    async def get(self, token_id: str) -> Optional[ShareToken]:
        """Get share token with automatic expiration check."""
        item = await self.store.aget(self.NAMESPACE, token_id)
        if not item:
            return None
        share = ShareToken(**item.value)
        if share.expires_at and share.expires_at < datetime.utcnow():
            await self.delete(token_id)
            return None
        return share
```

### Phase 2: Caching Strategy for Shared Threads

```python
# Custom cache key builder for shared threads (global, not user-scoped)
def share_cache_key_builder(func, namespace="", request=None, response=None, args=(), kwargs={}):
    """Cache key by share_token only (no user isolation needed)."""
    token = kwargs.get("token", "")
    return f"share:{func.__name__}:{token}"

@router.get("/share/{token}")
@cache(expire=300, key_builder=share_cache_key_builder)  # 5-minute cache
async def get_shared_thread(
    token: str = Path(...),
    store: AsyncPostgresStore = Depends(get_store),
):
    """Retrieve shared thread with caching for frequently accessed shares."""
    share_repo = ShareTokenRepo(store)
    share_token = await share_repo.get(token)

    if not share_token:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    # Increment access counter (async, non-blocking)
    asyncio.create_task(share_repo.increment_access(token))

    # Fetch thread using owner's namespace
    async with get_checkpoint_db() as checkpointer:
        service_context = ServiceContext(
            user_id=share_token.owner_id,
            store=store,
            checkpointer=checkpointer
        )
        thread = await service_context.thread_service.get(share_token.thread_id)

        # Fetch only latest checkpoint (limit=1 for efficiency)
        checkpoints = await service_context.checkpoint_service.list_checkpoints(
            thread_id=share_token.thread_id,
            limit=1
        )

        return {
            "thread": {
                "id": thread.id,
                "title": thread.title,
                "messages": checkpoints[0]["values"]["messages"] if checkpoints else [],
                "files": thread.files,
            },
            "share_config": {
                "allow_continuation": share_token.allow_continuation,
                "continuation_model": share_token.continuation_model,
            }
        }
```

### Phase 3: Message Pagination for Large Threads

```python
@router.get("/share/{token}")
@cache(expire=300, key_builder=share_cache_key_builder)
async def get_shared_thread(
    token: str = Path(...),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=10, le=100),  # Limit payload size
    store: AsyncPostgresStore = Depends(get_store),
):
    # ... validation ...

    # Paginate messages for large threads
    all_messages = checkpoints[0]["values"]["messages"] if checkpoints else []
    total_messages = len(all_messages)

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_messages = all_messages[start_idx:end_idx]

    return {
        "thread": {
            "messages": paginated_messages,
            # ...
        },
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_messages": total_messages,
            "total_pages": (total_messages + page_size - 1) // page_size,
        },
    }
```

### Phase 4: Cost-Optimized Anonymous Follow-ups

```python
# backend/src/utils/auth.py

async def get_user_or_share_token(
    request: Request,
    params: LLMRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_async_db),
) -> Tuple[Optional[User], Optional[ShareToken]]:
    """Get user OR validate share token for anonymous continuation."""

    # Check for share_token in metadata
    share_token_id = params.metadata and params.metadata.share_token
    if share_token_id:
        store = getattr(request.app.state, "store", None)
        if store:
            share_repo = ShareTokenRepo(store)
            share_token = await share_repo.get(share_token_id)

            if share_token and share_token.allow_continuation:
                # FORCE model to low-cost option
                params.model = share_token.continuation_model or get_default_low_cost_model()
                return (None, share_token)

    # Fall back to existing user auth
    user = await get_optional_user(request, params, credentials, db)
    return (user, None)
```

---

## 4. Performance Optimizations

| Optimization | Impact | Implementation |
|--------------|--------|----------------|
| 5-minute cache for shared threads | Reduces DB load for popular shares | Custom cache key builder |
| TTL-based token expiration | Automatic cleanup | Store TTL parameter |
| Message pagination | Smaller payloads | Query parameters |
| Async access counting | Non-blocking | asyncio.create_task |
| Single checkpoint fetch | Faster response | limit=1 |

---

## 5. Cost Management

### Anonymous User Restrictions

```python
# Enforce cheap models for anonymous follow-ups
params.model = share_token.continuation_model or get_default_low_cost_model()

# Rate limiting: 10 requests/hour per IP
@limiter.limit("10/hour")
async def share_follow_up(...):
    pass
```

### Model Hierarchy (lowest cost first)
1. `google:gemini-3-flash-preview` - Free tier
2. `openai:gpt-5-nano` - Lowest OpenAI cost
3. `anthropic:claude-3-5-haiku` - Fast, cheap

---

## 6. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cache stampede | High DB load | Cache locks, staggered TTLs |
| Large file payloads | Memory issues | File size limits, lazy loading |
| Abuse via follow-ups | Cost explosion | Rate limits, model restriction |

---

## 7. Estimated Complexity

- **Scope**: Medium
- **Risk Level**: Medium
- **Effort**: 7-9 days (including performance testing)

### Priority Order
1. Token infrastructure with TTL
2. Caching layer with custom key builder
3. Share routes with pagination
4. Anonymous continuation with model enforcement
5. Frontend share page
6. Load testing and optimization

---

### Critical Files for Implementation

1. `/backend/src/routes/v0/thread.py` - Add share routes with caching
2. `/backend/src/utils/auth.py` - Share token authentication
3. `/backend/src/constants/llm.py` - Model cost hierarchy
4. `/frontend/src/routes/AppRoutes.tsx` - Add share route
5. `/frontend/src/pages/agents/public.tsx` - Pattern for public page
