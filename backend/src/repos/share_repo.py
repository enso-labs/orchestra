"""Repository for share tokens with global index lookup.

Follows the pattern established by ApiTokenRepo:
- User namespace for full share data: (user_id, "shares")
- System namespace for global token lookup: ("system", "share_index")
"""

import hashlib
import secrets
from typing import Optional, List, Any
from datetime import datetime, timezone
from src.repos.base_repo import BaseRepo
from src.schemas.entities.share import ShareToken
from src.utils.logger import logger


class ShareRepo(BaseRepo):
    """Repository for share token operations."""

    SYSTEM_INDEX = ("system", "share_index")

    def __init__(self, user_id: str, store):
        super().__init__(user_id, store, "shares")

    @staticmethod
    def generate_token() -> tuple[str, str, str]:
        """Generate a secure share token.

        Returns:
            tuple: (full_token, token_hash, prefix)
        """
        raw = secrets.token_urlsafe(32)
        token = f"shr_{raw}"
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        prefix = token[:12] + "..."
        return token, token_hash, prefix

    def _format(self, item: Any) -> ShareToken:
        """Override base format to return ShareToken."""
        return ShareToken.model_validate(item.value)

    async def create(self, share: ShareToken) -> ShareToken:
        """Create share in user namespace and system index.

        Args:
            share: ShareToken with token_hash already set

        Returns:
            The created ShareToken
        """
        # Store in user namespace (full data)
        await self._set(share.id, share)

        # Store in system index (for global lookup by token hash)
        await self.store.aput(
            namespace=self.SYSTEM_INDEX,
            key=share.token_hash,
            value={"share_id": share.id, "owner_id": share.owner_id},
        )

        logger.info(f"Created share {share.token_prefix} for thread {share.thread_id}")
        return share

    async def get_by_token(self, token: str) -> Optional[ShareToken]:
        """Global lookup by plaintext token (hashes then finds).

        Args:
            token: Full plaintext share token (shr_xxx...)

        Returns:
            ShareToken if found and valid, None otherwise
        """
        # Validate token format
        if not token.startswith("shr_"):
            return None

        token_hash = hashlib.sha256(token.encode()).hexdigest()

        # Look up in system index
        index_item = await self.store.aget(self.SYSTEM_INDEX, token_hash)
        if not index_item:
            return None

        owner_id = index_item.value["owner_id"]
        share_id = index_item.value["share_id"]

        # Fetch full share from owner's namespace
        item = await self.store.aget((owner_id, "shares"), share_id)
        if not item:
            return None

        share = self._format(item)

        # Return None if share is invalid (expired or revoked)
        if not share.is_valid:
            return None

        return share

    async def get(self, share_id: str) -> Optional[ShareToken]:
        """Get share by ID from current user's namespace."""
        item = await self._get(share_id)
        if item:
            return self._format(item)
        return None

    async def revoke(self, share_id: str) -> bool:
        """Soft delete: mark as revoked, remove from index.

        Args:
            share_id: ID of share to revoke

        Returns:
            True if revoked successfully, False if not found
        """
        share = await self.get(share_id)
        if not share:
            return False

        # Mark as revoked
        share.revoked_at = datetime.now(timezone.utc)
        await self._set(share_id, share)

        # Remove from global index
        await self.store.adelete(self.SYSTEM_INDEX, share.token_hash)

        logger.info(f"Revoked share {share.token_prefix}")
        return True

    async def list_shares(self) -> List[ShareToken]:
        """List all shares for the current user."""
        items = await self.store.asearch(self._get_namespace(), limit=100)
        return [self._format(item) for item in items]

    async def list_by_thread(self, thread_id: str) -> List[ShareToken]:
        """List all shares for a specific thread."""
        items = await self.store.asearch(
            self._get_namespace(),
            filter={"thread_id": thread_id},
            limit=100,
        )
        return [self._format(item) for item in items]

    async def increment_view_count(self, share_id: str, owner_id: str) -> None:
        """Increment view count for a share (async, non-blocking)."""
        try:
            item = await self.store.aget((owner_id, "shares"), share_id)
            if item:
                share = self._format(item)
                share.view_count += 1
                await self.store.aput(
                    namespace=(owner_id, "shares"),
                    key=share_id,
                    value=share.model_dump(exclude_none=True),
                )
        except Exception as e:
            logger.warning(f"Failed to increment view count for share {share_id}: {e}")
