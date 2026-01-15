# PROPOSAL_ARCHITECT.md

## GitHub Issue #663: FEAT - Auth User Can Share Private Thread via Link to Anon Users

### AGENT_1: ARCHITECT Perspective
**Focus Areas:** System Design, Scalability, Architectural Patterns

---

## 1. Executive Summary

This proposal implements a secure share token system that enables authenticated users to share private threads with anonymous users. The architecture leverages cryptographic tokens for secure access, follows the existing public assistant pattern for data isolation, and supports optional follow-up conversations on cheaper models to encourage sign-ups.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**Thread Storage:**
- Threads stored in user-namespaced LangGraph stores: `(user_id, "threads")`
- Thread data includes: messages, files, todos, metadata
- Checkpoint data stored separately with full conversation history

**Authentication:**
- `verify_credentials`: Requires full auth
- `get_optional_user_from_token`: Returns None if no valid token
- `get_optional_user`: For public assistant access

**Public Pattern:**
- Public assistants use `("public", "assistants")` namespace
- Route `/a/:agentId` demonstrates public access pattern

### 2.2 Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Share Token System                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐     ┌────────────────┐     ┌──────────────┐│
│  │  ShareLink     │────▶│  ShareLinkRepo │────▶│   Public     ││
│  │  Entity        │     │  (dual storage)│     │   Namespace  ││
│  └────────────────┘     └────────────────┘     └──────────────┘│
│         │                      │                      │         │
│         ▼                      ▼                      ▼         │
│  ┌────────────────┐     ┌────────────────┐     ┌──────────────┐│
│  │ Share Service  │────▶│  Thread Access │────▶│  Checkpoint  ││
│  │ (create/revoke)│     │  (owner ns)    │     │  Data        ││
│  └────────────────┘     └────────────────┘     └──────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Data Model

```python
class ShareLink(BaseEntity):
    share_token: str              # Cryptographic token (shr_xxx)
    thread_id: str                # Reference to original thread
    owner_id: str                 # User who created the share
    title: Optional[str]          # Cached title for display
    allow_follow_up: bool = True  # Allow anonymous chat
    follow_up_model: Optional[str] # Restricted model for anon
    status: str = "active"        # active, revoked
    expires_at: Optional[datetime]
    view_count: int = 0
    created_at: datetime
```

---

## 3. Implementation Strategy

### Phase 1: Backend Data Layer

**New Files:**
- `backend/src/schemas/entities/share.py` - ShareLink entity
- `backend/src/repos/share_link_repo.py` - Repository with dual namespace storage
- `backend/src/services/share_link.py` - Business logic service

**Key Patterns:**
- Store in both user namespace `(owner_id, "share_links")` and public `("public", "share_links")`
- Use `secrets.token_urlsafe(32)` with `shr_` prefix for tokens

### Phase 2: Backend API Routes

**New File:** `backend/src/routes/v0/share.py`

```python
POST /share              # Create share link (auth required)
GET /share/{token}       # Get shared thread (no auth)
DELETE /share/{token}    # Revoke share (auth required)
GET /share               # List user's shares (auth required)
```

### Phase 3: Frontend Implementation

**New Files:**
- `frontend/src/lib/services/shareService.ts` - API client
- `frontend/src/pages/share/SharedThreadPage.tsx` - Public view page

**Updated Files:**
- `frontend/src/routes/AppRoutes.tsx` - Add `/share/:shareToken` route
- `frontend/src/components/buttons/thread-share-button.tsx` - Dialog with options

---

## 4. Design Decisions

| Decision | Alternative | Rationale |
|----------|-------------|-----------|
| Cryptographic tokens | Direct thread ID | Security: unguessable, revocable |
| Public namespace | Permission table | Simpler, follows assistant pattern |
| Optional follow-up | Always read-only | Owner control, encourages sign-ups |
| Free model restriction | Full model access | Cost control, business alignment |

---

## 5. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token leakage | Anyone can view | Long tokens, expiration |
| Abuse via follow-ups | Cost overrun | Rate limits, model restriction |
| Orphaned tokens | 404 on valid tokens | Validate thread on access |

---

## 6. Estimated Complexity

- **Scope**: Medium
- **Risk Level**: Low-Medium
- **Effort**: 3-5 days

### Priority Order
1. ShareLink entity + repository
2. Share routes (create, get)
3. Frontend share page
4. Share button enhancement
5. Follow-up chat support
6. Management features (list, revoke)

---

### Critical Files for Implementation

1. `/backend/src/schemas/entities/share.py` - ShareLink entity
2. `/backend/src/repos/share_link_repo.py` - Dual namespace repository
3. `/backend/src/routes/v0/share.py` - API routes
4. `/frontend/src/pages/share/SharedThreadPage.tsx` - Public view page
5. `/frontend/src/components/buttons/thread-share-button.tsx` - Enhanced share UI
