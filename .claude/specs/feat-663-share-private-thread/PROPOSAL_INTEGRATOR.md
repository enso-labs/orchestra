# Implementation Proposal: Share Private Thread via Link (Issue #663)

## Agent: INTEGRATOR (APIs, Interfaces, System Boundaries)

---

## 1. Executive Summary

This proposal outlines a comprehensive API-first approach to implementing thread sharing functionality. The solution introduces a secure share token system that allows authenticated users to generate shareable links to their private threads, enabling anonymous users to view thread history (including files) and optionally continue conversations using cheaper models. The design follows existing patterns established by the public assistant feature while maintaining security boundaries.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**Backend:**
- Threads are stored in user-namespaced LangGraph stores: `(user_id, "threads")`
- Thread data includes: messages, files, todos, metadata
- Checkpoint data is stored separately and contains full conversation history
- Authentication uses JWT tokens or API keys via `verify_credentials`
- Public access pattern exists for assistants via `("public", "assistants")` namespace

**Frontend:**
- Existing share button at `/frontend/src/components/buttons/thread-share-button.tsx`
- Generates URL pattern: `${origin}/share/${threadId}` (not yet routed)
- ShareNav component exists with similar functionality
- No `/share/:threadId` route currently defined in AppRoutes.tsx
- Thread loading uses `useThread` hook which requires authentication

**Key Patterns:**
1. **Public namespace pattern**: AssistantService uses `("public", "assistants")` for public access
2. **Token-based access**: ApiTokenRepo uses `("system", "api_token_index")` for global lookups
3. **Optional auth**: `get_optional_user` allows unauthenticated access for certain endpoints

### 2.2 Proposed Architecture

```
+-------------------+       +------------------+       +-------------------+
|   Share Button    |  -->  |  /threads/{id}/  |  -->  | ShareToken stored |
|   (Frontend)      |       |    share (POST)  |       | in public ns      |
+-------------------+       +------------------+       +-------------------+
                                    |
                                    v
+-------------------+       +------------------+       +-------------------+
| /share/:token     |  <--  |  /shares/{token} |  <--  | Token lookup      |
| (Public Page)     |       |  (GET - no auth) |       | returns thread    |
+-------------------+       +------------------+       +-------------------+
                                    |
                                    v (optional)
+-------------------+       +------------------+
| Continue Chat     |  -->  | /shares/{token}/ |
| (Anon User)       |       |   stream (POST)  |
+-------------------+       +------------------+
```

### 2.3 Integration Points

| Component | Integration | Notes |
|-----------|-------------|-------|
| Backend Routes | New `/threads/{id}/share` and `/shares/{token}` endpoints | RESTful design |
| Frontend Services | New `shareService.ts` | API client methods |
| Frontend Routes | New `/share/:token` route | Public page |
| Thread Repo | Read access by share token | Cross-namespace lookup |
| Auth Utils | New `verify_share_token` helper | Optional auth with token |

---

## 3. Implementation Strategy

### 3.1 Backend API Endpoints

#### Phase 1: Share Token Management

**New File: `/backend/src/routes/v0/share.py`**

```python
# Endpoints:
POST /threads/{thread_id}/share  # Create share token (auth required)
DELETE /threads/{thread_id}/share  # Revoke share (auth required)
GET /shares/{share_token}  # Get shared thread (no auth)
POST /shares/{share_token}/stream  # Continue conversation (no auth, restricted model)
```

**New File: `/backend/src/schemas/entities/share.py`**

```python
class ShareToken(BaseEntity):
    token_hash: str  # SHA-256 hash of the token
    prefix: str  # First 8 chars for display (e.g., "shr_abc1...")
    thread_id: str
    owner_id: str
    expires_at: Optional[datetime]
    allow_follow_up: bool = True  # Allow anon follow-up conversations
    follow_up_model: Optional[str]  # Restricted model for anon users
    view_count: int = 0
    last_viewed_at: Optional[datetime]

class SharedThread(BaseModel):
    thread_id: str
    messages: list[dict]
    files: Optional[dict]
    title: Optional[str]
    shared_at: datetime
    allow_follow_up: bool
    follow_up_model: Optional[str]
```

**New File: `/backend/src/repos/share_repo.py`**

```python
class ShareRepo(BaseRepo):
    def __init__(self, user_id: str, store):
        super().__init__(user_id, store, "shares")
    
    async def create_share(self, thread_id: str, token_hash: str, ...) -> ShareToken
    async def get_by_token_global(self, token_hash: str) -> Optional[ShareToken]
    async def revoke_share(self, thread_id: str) -> bool
    async def increment_view_count(self, token_hash: str) -> None
```

#### Phase 2: Share Service Layer

**New File: `/backend/src/services/share.py`**

```python
class ShareService:
    async def create_share(self, thread_id: str, options: ShareOptions) -> ShareToken
    async def get_shared_thread(self, token: str) -> SharedThread
    async def revoke_share(self, thread_id: str) -> bool
    async def continue_conversation(self, token: str, input: LLMInput) -> AsyncGenerator
```

### 3.2 Frontend Implementation

#### Phase 1: Share Service and Types

**New File: `/frontend/src/lib/services/shareService.ts`**

```typescript
export interface ShareToken {
  token: string;  // Full token (only returned on create)
  prefix: string;
  thread_id: string;
  expires_at?: string;
  allow_follow_up: boolean;
  share_url: string;
}

export interface SharedThread {
  thread_id: string;
  messages: Message[];
  files?: Record<string, FileData>;
  title?: string;
  shared_at: string;
  allow_follow_up: boolean;
  follow_up_model?: string;
}

export const shareService = {
  createShare: (threadId: string, options?: ShareOptions) => Promise<ShareToken>,
  getSharedThread: (token: string) => Promise<SharedThread>,
  revokeShare: (threadId: string) => Promise<void>,
  streamFollowUp: (token: string, payload: StreamPayload) => SSE,
};
```

**New File: `/frontend/src/lib/entities/share.ts`**

```typescript
export interface ShareOptions {
  expires_in_hours?: number;
  allow_follow_up?: boolean;
}
```

#### Phase 2: Public Share Page

**New File: `/frontend/src/pages/share/SharedThreadPage.tsx`**

Key features:
1. Fetches thread via share token (no auth required)
2. Displays conversation history with files
3. Shows "Continue Conversation" option if `allow_follow_up` is true
4. Uses restricted model for follow-up (e.g., `gpt-4.1-nano`)
5. Includes CTA to sign up for full access

**Route Addition in `/frontend/src/routes/AppRoutes.tsx`:**

```tsx
<Route path="/share/:token" element={<SharedThreadPage />} />
```

#### Phase 3: Enhanced Share Button

**Update: `/frontend/src/components/buttons/thread-share-button.tsx`**

```tsx
// Change from generating URL directly to calling API
const handleShare = async () => {
  const { token, share_url } = await shareService.createShare(threadId);
  navigator.clipboard.writeText(share_url);
  toast.success('Share link copied to clipboard');
};
```

### 3.3 Data Flow

```
1. CREATE SHARE:
   User -> ShareButton -> POST /threads/{id}/share
                       -> ShareService.create_share()
                       -> ShareRepo.create_share()
                       -> Store: ("user_id", "shares") + ("system", "share_index")
                       -> Return ShareToken with URL

2. VIEW SHARE:
   Anon -> /share/:token -> GET /shares/{token}
                         -> ShareRepo.get_by_token_global()
                         -> ThreadRepo.get() (cross-namespace with owner_id)
                         -> CheckpointService.list_checkpoints()
                         -> Return SharedThread

3. FOLLOW-UP (Optional):
   Anon -> SharedThreadPage -> POST /shares/{token}/stream
                            -> Validate token, enforce model restriction
                            -> LLMController.llm_stream() with free model
                            -> Return SSE stream
```

---

## 4. Design Decisions

### 4.1 Token-Based vs Thread ID Access

**Decision: Use opaque share tokens instead of direct thread IDs**

Rationale:
- Security: Thread IDs are UUIDs that could be guessed/enumerated
- Revocability: Share tokens can be revoked without affecting the thread
- Analytics: Can track views, expiration, etc. on the token level
- Flexibility: Multiple tokens per thread with different permissions

Alternatives considered:
- Direct thread ID with `is_public` flag: Simpler but less flexible
- JWT-based share links: More complex, harder to revoke

### 4.2 Storage Strategy

**Decision: Dual storage with global index**

- User namespace: `(owner_id, "shares")` -> Full ShareToken data
- Global index: `("system", "share_index")` -> `{token_hash: {owner_id, thread_id}}`

This mirrors the ApiTokenRepo pattern and enables:
- Fast O(1) token lookups without knowing the owner
- User-scoped management (list my shares, revoke my shares)
- Clean data isolation

### 4.3 Follow-Up Model Restriction

**Decision: Allow anonymous follow-ups with restricted models**

Implementation:
- Default follow-up model: `get_default_low_cost_model()` (e.g., `gpt-5-nano`, `gemini-3-flash-preview`)
- Owner can customize when creating share
- Model validation in share endpoint, not in `get_optional_user`

This encourages engagement while controlling costs.

### 4.4 API Design Choices

**REST Resource Modeling:**

```
/threads/{thread_id}/share     # Share management (owner context)
/shares/{token}                # Public access (token context)
```

Rationale:
- Clear separation between owner operations and public access
- `/shares/{token}` is a standalone resource that doesn't require thread_id in URL
- Follows REST best practices for sub-resource management

---

## 5. Risk Assessment

### 5.1 Security Risks

| Risk | Mitigation |
|------|------------|
| Token enumeration | Use cryptographically secure tokens (secrets.token_urlsafe(32)) |
| Unauthorized thread access | Verify ownership before share creation |
| PII exposure in shared threads | Consider adding content filtering option |
| Share link leakage | Support token revocation, optional expiration |

### 5.2 Performance Risks

| Risk | Mitigation |
|------|------------|
| Global index contention | Use hash-based keys for distribution |
| Large thread loading | Paginate messages, lazy-load files |
| Anon follow-up abuse | Rate limiting on `/shares/{token}/stream` |

### 5.3 Edge Cases

1. **Thread deleted after share created**: Return 404, clean up orphan shares
2. **Owner deletes account**: Cascade delete shares
3. **Expired share accessed**: Return 410 Gone with message
4. **Large files in thread**: Consider size limits or streaming

### 5.4 Testing Considerations

```python
# Backend tests to add
tests/unit/services/test_share_service.py
tests/unit/repos/test_share_repo.py
tests/integration/test_share_flow.py

# Test scenarios
- Create share for owned thread (success)
- Create share for non-owned thread (403)
- Access valid share token (success)
- Access expired share token (410)
- Access revoked share token (404)
- Follow-up with restricted model (success)
- Follow-up with premium model (403)
```

---

## 6. Estimated Complexity

| Aspect | Assessment |
|--------|------------|
| **Scope** | Medium |
| **Risk Level** | Low-Medium |
| **Backend Changes** | 4 new files, 2 modified |
| **Frontend Changes** | 3 new files, 3 modified |
| **Database/Store** | No schema migration needed |

### 6.1 Implementation Priority Order

1. **Phase 1 - Core Backend** (Day 1-2)
   - ShareToken schema
   - ShareRepo with global index
   - ShareService
   - POST/DELETE `/threads/{id}/share`
   - GET `/shares/{token}`

2. **Phase 2 - Frontend Integration** (Day 2-3)
   - shareService.ts
   - SharedThreadPage.tsx
   - Route configuration
   - Update share button

3. **Phase 3 - Follow-Up Feature** (Day 3-4)
   - POST `/shares/{token}/stream` endpoint
   - Model restriction logic
   - Frontend chat continuation UI

4. **Phase 4 - Polish** (Day 4-5)
   - Share management UI (list, revoke)
   - Analytics (view count)
   - Expiration handling
   - Tests

---

## Critical Files for Implementation

### Critical Files for Implementation
List 3-5 files most critical for implementing this plan:
- `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-663/backend/src/repos/api_token_repo.py` - Pattern to follow for global token index implementation
- `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-663/backend/src/routes/v0/thread.py` - Thread routes to add share endpoints alongside
- `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-663/frontend/src/pages/agents/public.tsx` - Pattern for public access page (NoAuthLayout + data fetching)
- `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-663/backend/src/services/assistant.py` - Pattern for publish/unpublish and public namespace management
- `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-663/frontend/src/hooks/useThread.ts` - Thread loading logic to adapt for share context

---

## Appendix: API Contract Specification

### POST /api/v0/threads/{thread_id}/share

**Request:**
```json
{
  "expires_in_hours": 168,
  "allow_follow_up": true,
  "follow_up_model": "openai:gpt-4.1-nano"
}
```

**Response (201 Created):**
```json
{
  "token": "shr_AbCdEfGhIjKlMnOpQrStUvWxYz123456",
  "prefix": "shr_AbCd...",
  "thread_id": "uuid",
  "share_url": "https://chat.ruska.ai/share/shr_AbCdEfGhIjKlMnOpQrStUvWxYz123456",
  "expires_at": "2025-01-21T12:00:00Z",
  "allow_follow_up": true
}
```

### GET /api/v0/shares/{share_token}

**Response (200 OK):**
```json
{
  "thread_id": "uuid",
  "title": "Discussion about AI",
  "messages": [...],
  "files": {...},
  "shared_at": "2025-01-14T12:00:00Z",
  "allow_follow_up": true,
  "follow_up_model": "openai:gpt-4.1-nano"
}
```

### POST /api/v0/shares/{share_token}/stream

**Request:**
```json
{
  "input": {
    "messages": [{"role": "user", "content": "Follow-up question"}]
  }
}
```

**Response:** SSE stream (same format as `/llm/stream`)
