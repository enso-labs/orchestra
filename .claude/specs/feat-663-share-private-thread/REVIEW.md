# REVIEW.md - Elite Council Synthesis

## GitHub Issue #663: FEAT - Auth User Can Share Private Thread via Link to Anon Users

**Council Session Date:** 2026-01-14
**Proposals Reviewed:** ARCHITECT, CRAFTSMAN, GUARDIAN, OPTIMIZER, INTEGRATOR

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | OPTIMIZER | INTEGRATOR |
|--------|-----------|-----------|----------|-----------|------------|
| **Architecture** | Dual namespace (user + public), ShareLink entity | Snapshot semantics with SharedThread, extends ThreadService | Hash-based token lookup, dual storage with index | Global namespace with TTL, custom cache | Dual storage with global index (system namespace) |
| **Maintainability** | Clean separation, new repo/service | SOLID principles, proper layering | Strong validation, explicit error handling | Async patterns, cache optimization | API-first, clear resource modeling |
| **Security** | Cryptographic tokens (shr_prefix) | Separate tokens from thread IDs | Hash storage, never plaintext, rate limits | Rate limits, model restriction | Token revocation, ownership checks |
| **Performance** | Standard caching | N/A (not addressed) | N/A (security focus) | 5-min cache, pagination, async counters | Global index for O(1) lookups |
| **Risk Level** | Low-Medium | Low | Medium (security-critical) | Medium | Low-Medium |
| **Completeness** | Core features + follow-up | Core + clean code | Core + comprehensive testing | Core + performance optimizations | Full API contract + data flows |
| **Effort Estimate** | 3-5 days | 3-5 days | 6-8 days | 7-9 days | 4-5 days |

---

## 2. Consensus Points

All proposals agree on the following foundational decisions:

### 2.1 Token-Based Access (Unanimous)
- Use cryptographically secure, opaque share tokens (NOT direct thread IDs)
- Tokens should be unguessable (256 bits of entropy via `secrets.token_urlsafe(32)`)
- Prefix tokens with `shr_` for type identification
- Support token revocation without affecting the underlying thread

### 2.2 Dual Namespace Storage Pattern (Unanimous)
- Store share data in user namespace for management: `(owner_id, "shares")`
- Store lookup index in system namespace: `("system", "share_index")`
- This pattern mirrors the existing `ApiTokenRepo` implementation

### 2.3 Public Access Without Authentication (Unanimous)
- GET endpoint for shared threads requires NO authentication
- Follow the existing public assistant pattern (`/a/:agentId`)
- Use `NoAuthLayout` for frontend public pages

### 2.4 Optional Follow-Up Chat with Cost Controls (Unanimous)
- Allow thread owners to enable/disable anonymous follow-ups
- Restrict anonymous users to low-cost models (e.g., `get_default_low_cost_model()`)
- Apply rate limiting to anonymous follow-up requests

### 2.5 File Inclusion (Unanimous)
- Shared threads MUST include associated files in state
- Files stored in thread metadata should be accessible via share

---

## 3. Divergence Analysis

### 3.1 Storage Approach: Snapshot vs Reference

| Proposal | Approach | Rationale |
|----------|----------|-----------|
| **CRAFTSMAN** | Snapshot (copy messages at share time) | Immutable shares, stable content |
| **Others** | Reference (lookup thread on access) | Always current, no duplication |

**Council Decision: REFERENCE (Dynamic Lookup)**

Rationale:
- Storage efficiency - no message duplication
- Simplicity - single source of truth
- Existing patterns - public assistants use reference model
- Trade-off accepted: Thread deletion invalidates share (handled via 404)

### 3.2 Token Hash Storage

| Proposal | Approach |
|----------|----------|
| **GUARDIAN** | Store ONLY hash, never plaintext |
| **Others** | Store full token or mixed approach |

**Council Decision: HASH-BASED LOOKUP (Guardian Pattern)**

Rationale:
- Follows security best practice (API key pattern in `ApiTokenRepo`)
- Token returned only once at creation
- Hash used for all subsequent lookups
- Prefix stored for display purposes

### 3.3 Route Structure

| Proposal | Routes |
|----------|--------|
| **ARCHITECT** | `/share` (new router) |
| **CRAFTSMAN** | `/threads/{id}/share` (extend thread router) |
| **INTEGRATOR** | `/threads/{id}/share` + `/shares/{token}` (split) |

**Council Decision: SPLIT ROUTES (Integrator Pattern)**

```
POST   /api/v0/threads/{thread_id}/share   # Auth required - create share
DELETE /api/v0/threads/{thread_id}/share   # Auth required - revoke share
GET    /api/v0/shares/{token}              # No auth - view shared thread
POST   /api/v0/shares/{token}/stream       # No auth (rate limited) - follow-up
```

### 3.4 Cache Strategy

**Council Decision: IMPLEMENT CACHING (Optimizer Pattern)**

```python
@cache(expire=300, key_builder=share_cache_key_builder)
```

---

## 4. Unified Implementation Plan

### 4.1 Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SHARE TOKEN SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐ │
│  │ ShareToken      │────▶│ ShareRepo        │────▶│ System Namespace  │ │
│  │ Entity          │     │ (dual storage)   │     │ (token index)     │ │
│  │ - token_hash    │     │                  │     │                   │ │
│  │ - thread_id     │     │ User Namespace   │     │ ("system",        │ │
│  │ - owner_id      │     │ (full data)      │     │  "share_index")   │ │
│  │ - allow_follow  │     │                  │     │                   │ │
│  │ - model         │     │ (user_id,        │     │                   │ │
│  │ - expires_at    │     │  "shares")       │     │                   │ │
│  └─────────────────┘     └──────────────────┘     └───────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Implementation Sequence

#### Phase 1: Backend Data Layer (Day 1)
- `backend/src/schemas/entities/share.py` - ShareToken, CreateShareRequest, ShareResponse entities
- `backend/src/repos/share_repo.py` - Repository with global index lookup

#### Phase 2: Backend Service Layer (Day 1-2)
- `backend/src/services/share.py` - ShareService with create, get, revoke methods

#### Phase 3: Backend Routes (Day 2)
- `backend/src/routes/v0/share.py` - API routes with caching and rate limiting
- Register in `backend/src/routes/v0/__init__.py`

#### Phase 4: Frontend Implementation (Day 3-4)
- `frontend/src/lib/services/shareService.ts` - API client
- `frontend/src/pages/share/SharedThreadPage.tsx` - Public share view page
- Update `frontend/src/routes/AppRoutes.tsx` - Add `/share/:token` route
- Update `frontend/src/components/buttons/thread-share-button.tsx` - Dialog with options

#### Phase 5: Testing and Polish (Day 4-5)
- Unit tests for repo, service, routes
- Frontend tests for service and page

### 4.3 Non-Negotiable Requirements

1. **Cryptographic tokens** - Must use `secrets.token_urlsafe(32)`
2. **Hash-based storage** - Never store plaintext tokens
3. **Ownership verification** - Only thread owner can create/revoke shares
4. **Rate limiting** - Public endpoints must be rate limited (10/hour)
5. **Model restriction** - Anonymous follow-ups MUST use low-cost models
6. **File inclusion** - Shared threads MUST include files in state

---

## 5. Risk Consolidation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Token brute-force | Low | 256-bit entropy makes infeasible |
| Share link leakage | Medium | Revocation support, optional expiration |
| Unauthorized follow-ups | Medium | Model restriction, rate limits |
| Cache stampede | Low | 5-minute cache with staggered TTLs |
| Orphaned shares | Low | Validate thread exists on access |

---

## 6. Final Verdict

### Recommendation: **GO**

### Confidence Level: **High**

### Rationale

1. **Well-Defined Patterns** - Existing codebase provides clear patterns (`ApiTokenRepo`, `AssistantService.publish`, `PublicAgentPage`)
2. **Unanimous Agreement** - All proposals converge on core architecture decisions
3. **Manageable Scope** - 4-5 day implementation with clear phases
4. **Low Technical Risk** - No database migrations, leverages existing LangGraph store
5. **Business Value** - Enables viral sharing, low-cost anonymous engagement encourages sign-ups

### Conditions for Success

1. Follow hash-based token pattern from `ApiTokenRepo`
2. Implement rate limiting on all public endpoints
3. Enforce model restriction for anonymous follow-ups
4. Include comprehensive unit tests (especially security scenarios)
5. Cache shared thread lookups with appropriate TTL

---

## Critical Files for Implementation

1. `/backend/src/repos/api_token_repo.py` - Pattern for global token index
2. `/backend/src/services/assistant.py` - Pattern for publish/unpublish
3. `/backend/src/routes/v0/thread.py` - Existing thread routes
4. `/frontend/src/pages/agents/public.tsx` - Pattern for public access page
5. `/backend/src/constants/llm.py` - Low-cost model configuration
