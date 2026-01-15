# PROPOSAL_GUARDIAN.md

## GitHub Issue #663: FEAT - Auth User Can Share Private Thread via Link to Anon Users

### AGENT_3: GUARDIAN Perspective
**Focus Areas:** Security, Error Handling, Edge Cases, Testing

---

## 1. Executive Summary

This proposal implements secure thread sharing with a token-based access system that prevents enumeration attacks, supports revocation, and enforces cost controls for anonymous users. The design prioritizes security at every layer while maintaining a smooth user experience through proper error handling.

---

## 2. Security Architecture

### 2.1 Token Design

```python
# Secure token generation
import secrets
import hashlib

def generate_share_token() -> tuple[str, str]:
    """Generate a secure share token and its hash."""
    raw_token = secrets.token_urlsafe(32)  # 256 bits of entropy
    token = f"shr_{raw_token}"
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    return token, token_hash
```

**Security Properties:**
- 256 bits of entropy makes brute-force infeasible
- `shr_` prefix clearly identifies token type
- Hash stored, not plaintext (follows API key pattern)

### 2.2 Access Control Matrix

| Endpoint | Auth Required | Owner Only | Rate Limited |
|----------|---------------|------------|--------------|
| POST /share | Yes | Yes (thread owner) | No |
| GET /share/{token} | No | No | Yes |
| DELETE /share/{token} | Yes | Yes (share owner) | No |
| POST /share/{token}/chat | No | No | Yes (10/hour) |

---

## 3. Implementation Strategy

### Phase 1: Secure Token Schema

```python
# backend/src/schemas/entities/share.py

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, field_validator

class ThreadShare(BaseModel):
    """Secure share token with validation."""
    id: str
    token_hash: str  # Never store plaintext
    token_prefix: str  # First 8 chars for display
    thread_id: str
    owner_id: str
    allow_follow_up: bool = True
    follow_up_model: Optional[str] = None
    expires_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    access_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def is_valid(self) -> bool:
        """Check if share is currently valid."""
        if self.revoked_at:
            return False
        if self.expires_at and self.expires_at < datetime.now(timezone.utc):
            return False
        return True

class CreateShareRequest(BaseModel):
    """Validated share creation request."""
    thread_id: str
    allow_follow_up: bool = True
    expires_in_days: Optional[int] = Field(default=7, ge=1, le=365)

    @field_validator('thread_id')
    @classmethod
    def validate_thread_id(cls, v: str) -> str:
        """Ensure thread_id is a valid UUID format."""
        import uuid
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError('Invalid thread_id format')
        return v
```

### Phase 2: Repository with Security Controls

```python
# backend/src/repos/share_repo.py

class ShareRepo(BaseRepo):
    """Repository with security-focused operations."""

    PUBLIC_NAMESPACE = ("public", "share_index")

    async def create(self, share: ThreadShare, token: str) -> ThreadShare:
        """Create share with dual-storage for secure lookup."""
        # Store full data in owner namespace
        await self.store.aput(
            namespace=self._get_namespace(),
            key=share.id,
            value=share.model_dump()
        )

        # Store minimal lookup data in public index
        await self.store.aput(
            namespace=self.PUBLIC_NAMESPACE,
            key=share.token_hash,
            value={
                "id": share.id,
                "owner_id": share.owner_id,
                "thread_id": share.thread_id,
            }
        )

        return share

    async def get_by_token(self, token: str) -> Optional[ThreadShare]:
        """Secure token lookup via hash."""
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        # Lookup in public index
        index_item = await self.store.aget(self.PUBLIC_NAMESPACE, token_hash)
        if not index_item:
            return None

        # Fetch full share from owner namespace
        owner_id = index_item.value["owner_id"]
        share_id = index_item.value["id"]

        self.user_id = owner_id  # Temporarily switch namespace
        share_item = await self.store.aget(self._get_namespace(), share_id)

        if not share_item:
            return None

        return ThreadShare(**share_item.value)

    async def revoke(self, share_id: str) -> bool:
        """Soft delete - mark as revoked, remove from public index."""
        share_item = await self._get(share_id)
        if not share_item:
            return False

        share = ThreadShare(**share_item.value)
        share.revoked_at = datetime.now(timezone.utc)

        # Update in owner namespace
        await self.store.aput(
            namespace=self._get_namespace(),
            key=share_id,
            value=share.model_dump()
        )

        # Remove from public index
        await self.store.adelete(self.PUBLIC_NAMESPACE, share.token_hash)

        return True
```

### Phase 3: API Routes with Security

```python
# backend/src/routes/v0/share.py

from fastapi import APIRouter, HTTPException, Depends, status, Path
from src.utils.rate_limit import limiter

router = APIRouter(tags=["Share"], prefix="/shares")

ANON_RATE_LIMIT = "10/hour"

@router.post("")
async def create_share(
    request: CreateShareRequest,
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """Create share link. Only owner can share their threads."""
    service = ShareService(user_id=user.id, store=store)

    # Verify ownership
    thread = await service.thread_service.get(request.thread_id)
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found or access denied"
        )

    share = await service.create_share(request)
    return ShareResponse(
        token=share.token,  # Only time plaintext token is returned
        share_url=f"/share/{share.token_prefix}...",
        expires_at=share.expires_at,
    )

@router.get("/{token}")
@limiter.limit(ANON_RATE_LIMIT)
async def get_shared_thread(
    token: str = Path(..., description="Share token"),
    store: AsyncPostgresStore = Depends(get_store),
):
    """Access shared thread. No auth required but rate limited."""
    # Validate token format
    if not token.startswith("shr_"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token format"
        )

    service = ShareService(user_id=None, store=store)
    result = await service.get_shared_thread(token)

    if not result:
        # Don't reveal whether token exists vs expired vs revoked
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found or has expired"
        )

    public_thread, share = result
    return {
        "thread": public_thread.model_dump(),
        "share": {
            "allow_follow_up": share.allow_follow_up,
            "follow_up_model": share.follow_up_model,
        }
    }

@router.delete("/{token}")
async def revoke_share(
    token: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """Revoke share. Only owner can revoke."""
    service = ShareService(user_id=user.id, store=store)
    success = await service.revoke_share(token)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found or access denied"
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

---

## 4. Error Handling Strategy

| Error | Response Code | User Message |
|-------|---------------|--------------|
| Token not found | 404 | "Share not found or has expired" |
| Token expired | 404 | Same (don't reveal which) |
| Token revoked | 404 | Same (don't reveal which) |
| Invalid format | 400 | "Invalid token format" |
| Rate limited | 429 | "Too many requests" |
| Server error | 500 | "Failed to load" |

---

## 5. Testing Strategy

### Unit Tests

```python
# backend/tests/unit/services/test_share_service.py

class TestShareServiceSecurity(unittest.IsolatedAsyncioTestCase):

    async def test_share_token_does_not_expose_thread_id(self):
        """Token format should not reveal thread_id."""
        share = await self.service.create_share(request)
        self.assertTrue(share.token.startswith("shr_"))
        self.assertNotIn(self.thread_id, share.token)

    async def test_cannot_create_share_for_other_user_thread(self):
        """User cannot share a thread they don't own."""
        other_service = ShareService(user_id="other", store=self.store)
        share = await other_service.create_share(CreateShareRequest(
            thread_id=self.my_thread_id
        ))
        self.assertIsNone(share)

    async def test_expired_share_returns_none(self):
        """Expired shares should not be accessible."""
        share = await self.service.create_share(request)
        share.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        await self.store.aput(...)

        result = await self.service.get_shared_thread(share.token)
        self.assertIsNone(result)

    async def test_revoked_share_returns_none(self):
        """Revoked shares should not be accessible."""
        share = await self.service.create_share(request)
        await self.service.revoke_share(share.token)

        result = await self.service.get_shared_thread(share.token)
        self.assertIsNone(result)

    async def test_public_thread_excludes_owner_id(self):
        """PublicThread should not include owner_id."""
        share = await self.service.create_share(request)
        result = await self.service.get_shared_thread(share.token)

        thread_dict = result[0].model_dump()
        self.assertNotIn("owner_id", thread_dict)
```

---

## 6. Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Thread deleted after share | Check thread exists on access, return 404 |
| Owner deletes account | Cascade delete shares |
| Multiple shares same thread | Each has independent lifecycle |
| Large thread payload | Paginate messages, lazy-load files |
| Concurrent revocation | Idempotent revoke operation |

---

## 7. Estimated Complexity

- **Scope**: Medium
- **Risk Level**: Medium (security-critical)
- **Effort**: 6-8 days (including security testing)

### Priority Order
1. Token schema with validation
2. Repository with hash-based lookup
3. Service with ownership checks
4. Routes with rate limiting
5. Security-focused unit tests
6. Integration tests
7. Frontend with error handling

---

### Critical Files for Implementation

1. `/backend/src/schemas/entities/share.py` - Secure token schema with validation
2. `/backend/src/repos/share_repo.py` - Hash-based token lookup
3. `/backend/src/routes/v0/share.py` - Rate-limited routes
4. `/backend/tests/unit/services/test_share_service.py` - Security tests
5. `/backend/src/utils/auth.py` - Reference for token patterns
