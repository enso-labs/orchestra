# PROPOSAL_CRAFTSMAN.md

## GitHub Issue #663: FEAT - Auth User Can Share Private Thread via Link to Anon Users

### AGENT_2: CRAFTSMAN Perspective
**Focus Areas:** Clean Code, Maintainability, SOLID Principles

---

## 1. Executive Summary

This proposal implements thread sharing following the existing public assistant pattern, introducing a `SharedThread` entity with snapshot semantics. The implementation prioritizes clean code organization, proper separation of concerns between repos/services/routes, and maintainable TypeScript/React patterns on the frontend.

---

## 2. Architectural Analysis

### 2.1 Code Organization Principles

**Backend Structure (following existing patterns):**
```
backend/src/
├── schemas/entities/share.py      # SharedThread, PublicSharedThread models
├── repos/shared_thread_repo.py    # Repository with namespace support
├── services/share_service.py      # Business logic (extend ThreadService)
└── routes/v0/thread.py            # Add share endpoints
```

**Frontend Structure:**
```
frontend/src/
├── lib/
│   ├── services/sharedThreadService.ts  # API client
│   └── entities/share.ts                # TypeScript interfaces
├── pages/share/SharedThreadPage.tsx     # Public page
└── components/buttons/thread-share-button.tsx  # Enhanced UI
```

### 2.2 SOLID Principles Applied

1. **Single Responsibility**: Separate ShareRepo from ThreadRepo
2. **Open/Closed**: Extend ThreadService, don't modify core thread logic
3. **Liskov Substitution**: PublicSharedThread is a safe projection of SharedThread
4. **Interface Segregation**: Distinct interfaces for create vs. view operations
5. **Dependency Inversion**: Services depend on repo abstractions

---

## 3. Implementation Strategy

### Phase 1: Backend Schema (Clean Model Design)

```python
# backend/src/schemas/entities/share.py

class SharedThread(BaseEntity):
    """Full shared thread with all metadata."""
    share_token: str
    thread_id: str
    owner_id: str
    title: Optional[str] = None
    messages: list[Union[BaseMessage, dict]] = Field(default_factory=list)
    files: Optional[Any] = None
    todos: Optional[Any] = None
    shared_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    allow_continuation: bool = True
    continuation_model: Optional[str] = None

class PublicSharedThread(BaseModel):
    """Safe projection for public access - excludes owner details."""
    share_token: str
    title: Optional[str]
    messages: list[dict]
    files: Optional[Any]
    shared_at: Optional[datetime]
    allow_continuation: bool
    continuation_model: Optional[str]
```

### Phase 2: Repository Layer

```python
# backend/src/repos/shared_thread_repo.py

class SharedThreadRepo(BaseRepo):
    """Repository for shared threads with dual namespace support."""

    def __init__(self, user_id: str, store: BaseStore):
        super().__init__(user_id=user_id, store=store, entity_type="shared_threads")

    def _get_public_namespace(self):
        return ("public", "shared_threads")

    async def share(self, shared_thread: SharedThread) -> bool:
        """Store in both user and public namespaces."""
        # User namespace for management
        await self.store.aput(
            namespace=self._get_namespace(),
            key=shared_thread.share_token,
            value=shared_thread.model_dump()
        )
        # Public namespace for access
        await self.store.aput(
            namespace=self._get_public_namespace(),
            key=shared_thread.share_token,
            value=shared_thread.model_dump()
        )
        return True

    async def get_public(self, share_token: str) -> Optional[SharedThread]:
        """Retrieve from public namespace."""
        item = await self.store.aget(self._get_public_namespace(), share_token)
        if item:
            return SharedThread(**item.value)
        return None

    async def unshare(self, share_token: str) -> bool:
        """Remove from both namespaces."""
        await self.store.adelete(self._get_namespace(), share_token)
        await self.store.adelete(self._get_public_namespace(), share_token)
        return True
```

### Phase 3: Service Layer

```python
# Extend backend/src/services/thread.py

async def share(self, thread_id: str, options: dict = None) -> SharedThread:
    """Create a shareable snapshot of a thread."""
    thread = await self.get(thread_id)
    if not thread:
        raise ValueError(f"Thread {thread_id} not found")

    share_token = str(uuid.uuid4())
    shared_thread = SharedThread(
        share_token=share_token,
        thread_id=thread_id,
        owner_id=self.user_id,
        title=thread.title,
        messages=thread.messages,
        files=thread.files,
        todos=thread.todos,
        shared_at=datetime.now(timezone.utc),
        allow_continuation=options.get("allow_continuation", True) if options else True,
    )

    await self.shared_thread_repo.share(shared_thread)
    return shared_thread
```

### Phase 4: Frontend Service

```typescript
// frontend/src/lib/services/sharedThreadService.ts

export interface ShareOptions {
  allow_continuation?: boolean;
  model?: string;
}

export interface SharedThread {
  share_token: string;
  title: string | null;
  messages: any[];
  files: any;
  shared_at: string;
  allow_continuation: boolean;
  continuation_model: string | null;
}

export async function shareThread(threadId: string, options: ShareOptions = {}) {
  const response = await apiClient.post(`/threads/${threadId}/share`, options);
  return response.data;
}

export async function getSharedThread(shareToken: string): Promise<SharedThread> {
  const response = await apiClient.get(`/threads/shared/${shareToken}`);
  return response.data.thread;
}
```

---

## 4. Design Decisions

| Decision | Alternative | Rationale |
|----------|-------------|-----------|
| Snapshot approach | Live thread reference | Immutable shares, stable content |
| Separate share token | Direct thread_id | Security, allows revocation |
| Public namespace | Query by owner_id | Direct lookup, better performance |
| Service extension | New service class | Cohesive thread operations |

---

## 5. Code Quality Guidelines

1. **Type Hints**: All functions must have complete type annotations
2. **Pydantic Models**: Use for all data validation
3. **Error Handling**: Explicit exceptions with helpful messages
4. **Naming**: `snake_case` for Python, `camelCase` for TypeScript
5. **Comments**: Only for non-obvious logic

---

## 6. Estimated Complexity

- **Scope**: Medium
- **Risk Level**: Low
- **Effort**: 3-5 days

### Priority Order
1. Backend Schema (0.5 day)
2. Backend Repository (0.5 day)
3. Backend Service (0.5 day)
4. Backend Routes (0.5 day)
5. Frontend Service (0.5 day)
6. Frontend ShareButton (1 day)
7. Frontend SharedThreadPage (1 day)
8. Testing & Polish (1 day)

---

### Critical Files for Implementation

1. `/backend/src/schemas/entities/store.py` - Add SharedThread models
2. `/backend/src/services/thread.py` - Extend with share methods
3. `/backend/src/routes/v0/thread.py` - Add public share endpoints
4. `/frontend/src/components/buttons/thread-share-button.tsx` - Modal with options
5. `/frontend/src/pages/agents/public.tsx` - Pattern reference for SharedThreadPage
