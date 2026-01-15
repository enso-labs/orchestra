"""Service for managing share tokens and accessing shared threads."""

import uuid
import asyncio
from typing import Optional, Tuple
from datetime import datetime, timezone, timedelta
from langgraph.store.base import BaseStore
from langgraph.checkpoint.base import BaseCheckpointSaver

from src.repos.share_repo import ShareRepo
from src.schemas.entities.share import (
    ShareToken,
    CreateShareRequest,
    SharedThreadResponse,
)
from src.constants.llm import get_default_low_cost_model
from src.utils.logger import logger


class ShareService:
    """Service for creating, retrieving, and managing share links."""

    def __init__(
        self,
        user_id: Optional[str],
        store: BaseStore,
        checkpointer: Optional[BaseCheckpointSaver] = None,
    ):
        self.user_id = user_id
        self.store = store
        self.checkpointer = checkpointer
        self.repo = ShareRepo(user_id, store) if user_id else None

    async def create_share(
        self, thread_id: str, request: CreateShareRequest
    ) -> Tuple[str, ShareToken]:
        """Create a share link for a thread owned by the current user.

        Args:
            thread_id: ID of the thread to share
            request: Share creation options

        Returns:
            Tuple of (full_token, ShareToken)

        Raises:
            ValueError: If thread not found or user doesn't own it
        """
        if not self.user_id or not self.repo:
            raise ValueError("User authentication required")

        # Import here to avoid circular imports
        from src.services.thread import ThreadService

        thread_service = ThreadService(
            user_id=self.user_id,
            store=self.store,
        )

        # Verify thread exists and belongs to user
        thread = await thread_service.get(thread_id)
        if not thread:
            raise ValueError("Thread not found")

        # Generate token
        token, token_hash, prefix = ShareRepo.generate_token()

        # Calculate expiration
        expires_at = None
        if request.expires_in_hours:
            expires_at = datetime.now(timezone.utc) + timedelta(
                hours=request.expires_in_hours
            )

        # Determine follow-up model
        follow_up_model = request.follow_up_model
        if request.allow_follow_up and not follow_up_model:
            follow_up_model = get_default_low_cost_model()

        # Create share token
        share = ShareToken(
            id=str(uuid.uuid4()),
            token_hash=token_hash,
            token_prefix=prefix,
            thread_id=thread_id,
            owner_id=self.user_id,
            allow_follow_up=request.allow_follow_up,
            follow_up_model=follow_up_model,
            expires_at=expires_at,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        await self.repo.create(share)
        return token, share

    async def get_shared_thread(
        self, token: str
    ) -> Optional[Tuple[SharedThreadResponse, ShareToken]]:
        """Retrieve a shared thread by token (no auth required).

        Args:
            token: Full plaintext share token

        Returns:
            Tuple of (SharedThreadResponse, ShareToken) if found, None otherwise
        """
        # Create a temporary repo for global lookup
        temp_repo = ShareRepo(user_id="system", store=self.store)
        share = await temp_repo.get_by_token(token)

        if not share:
            return None

        # Import here to avoid circular imports
        from src.services.thread import ThreadService
        from src.services.checkpoint import CheckpointService

        # Get thread using owner's context
        thread_service = ThreadService(
            user_id=share.owner_id,
            store=self.store,
        )
        thread = await thread_service.get(share.thread_id)

        if not thread:
            logger.warning(
                f"Thread {share.thread_id} not found for share {share.token_prefix}"
            )
            return None

        # Get messages from checkpoint
        messages = []
        if self.checkpointer:
            checkpoint_service = CheckpointService(
                user_id=share.owner_id,
                checkpointer=self.checkpointer,
            )
            try:
                checkpoints = await checkpoint_service.list_checkpoints(
                    thread_id=share.thread_id,
                    limit=1,
                )
                if checkpoints:
                    messages = checkpoints[0].get("values", {}).get("messages", [])
            except Exception as e:
                logger.warning(f"Failed to get checkpoints for share: {e}")
                # Fall back to thread messages
                messages = thread.messages if hasattr(thread, "messages") else []
        else:
            messages = thread.messages if hasattr(thread, "messages") else []

        # Increment view count asynchronously (fire and forget)
        asyncio.create_task(temp_repo.increment_view_count(share.id, share.owner_id))

        # Build response
        shared_response = SharedThreadResponse(
            thread_id=share.thread_id,
            title=thread.title if hasattr(thread, "title") else None,
            messages=messages,
            files=thread.files if hasattr(thread, "files") else None,
            todos=thread.todos if hasattr(thread, "todos") else None,
            shared_at=share.created_at,
            allow_follow_up=share.allow_follow_up,
            follow_up_model=share.follow_up_model,
        )

        return shared_response, share

    async def revoke_share(self, thread_id: str) -> bool:
        """Revoke the share link for a thread.

        Args:
            thread_id: ID of the thread whose share to revoke

        Returns:
            True if revoked, False if no share found
        """
        if not self.user_id or not self.repo:
            raise ValueError("User authentication required")

        # Find shares for this thread
        shares = await self.repo.list_by_thread(thread_id)
        if not shares:
            return False

        # Revoke all shares for this thread
        for share in shares:
            await self.repo.revoke(share.id)

        return True

    async def list_user_shares(self) -> list[ShareToken]:
        """List all shares created by the current user.

        Returns:
            List of ShareToken objects
        """
        if not self.user_id or not self.repo:
            raise ValueError("User authentication required")

        return await self.repo.list_shares()
