"""Abort signal service for distributed worker coordination.

This service provides a clean interface for sending and checking abort signals
via Redis. It follows the Single Responsibility Principle by handling only
abort signal management.

Security considerations:
- All abort operations require authenticated user
- Thread ownership verified before signaling
- All operations logged for audit trail
- Rate limiting via existing limiter middleware

Design:
- Uses Redis keys with TTL for automatic cleanup
- Signal pattern: abort:signal:{thread_id}
- Workers poll this key during streaming
- Abort signals store structured JSON with requester identity
- Workers validate expected_user_id matches stored requester
"""

import json
import redis.asyncio as redis
from datetime import datetime, timezone
from typing import Optional
from langgraph.store.base import BaseStore

from src.constants.redis import REDIS_URL
from src.services.thread import ThreadService
from src.utils.logger import logger

# TTL for abort signals (5 minutes) - matches stream TTL
ABORT_SIGNAL_TTL = 300
ABORT_SIGNAL_PREFIX = "abort:signal:"


class AbortService:
    """Manages abort signal propagation to workers with ownership verification.

    This service handles the coordination between the API and distributed workers
    for task cancellation. It uses Redis keys with TTL for fire-and-forget
    signaling that workers poll during execution.

    Design principles:
    - Fire-and-forget signaling (worker polls for signal)
    - Ownership verification before signal
    - Idempotent operations (multiple abort calls are safe)
    """

    def __init__(self, user_id: str, store: BaseStore):
        """Initialize AbortService with user context.

        Args:
            user_id: The authenticated user's ID
            store: The LangGraph store for thread access
        """
        self.user_id = user_id
        self.store = store
        self.thread_service = ThreadService(user_id=user_id, store=store)

    async def request_abort(self, thread_id: str) -> str:
        """Request abortion of a running task.

        For active streams, the thread may not exist in the store yet (first turn)
        or may have stale data (mid-stream). We allow abort signals to be set
        regardless, since:
        1. User is authenticated (we have their user_id for audit)
        2. User must have obtained the thread_id from a valid interaction
        3. Worker validates thread_id matches what it's processing

        If the thread exists in the store, we verify ownership. If not, we log
        and proceed (supports aborting during first turn before thread is saved).

        Args:
            thread_id: The thread ID to abort

        Returns:
            Status message indicating abort signal was sent

        Raises:
            PermissionError: If thread exists and user doesn't own it
        """
        # Step 1: Verify ownership if thread exists (optional for mid-stream abort)
        await self._verify_thread_ownership_if_exists(thread_id)

        # Step 2: Set abort signal in Redis
        await self._set_abort_signal(thread_id)

        # Step 3: Log for audit trail
        logger.info(
            "abort_signal_sent",
            extra={
                "event": "abort_signal_sent",
                "thread_id": thread_id,
                "user_id": self.user_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        return "Abort signal sent. Task will terminate at next checkpoint."

    async def _verify_thread_ownership_if_exists(self, thread_id: str) -> None:
        """Verify thread ownership if the thread exists in the store.

        During active streams (especially first turn), the thread may not exist
        in the store yet. In this case, we allow the abort to proceed since:
        - User is authenticated
        - User must have the thread_id from a valid source
        - Worker will only abort if thread_id matches

        Args:
            thread_id: The thread ID to verify

        Raises:
            PermissionError: If thread exists and user doesn't own it
        """
        thread = await self.thread_service.get(thread_id)

        if not thread:
            # Thread not in store yet (first turn or mid-stream)
            # Allow abort - user is authenticated and has valid thread_id
            logger.info(
                "abort_thread_not_in_store",
                extra={
                    "event": "abort_thread_not_in_store",
                    "thread_id": thread_id,
                    "user_id": self.user_id,
                    "note": "Allowing abort for active stream",
                },
            )
            return

        # Thread exists - verify ownership via namespace or metadata
        # Namespace lookup already ensures user has access to their threads.
        # Additional check via metadata if present for extra security.
        if thread.metadata:
            thread_user_id = thread.metadata.get("user_id")
            if thread_user_id and str(thread_user_id) != str(self.user_id):
                logger.warning(
                    "abort_unauthorized_attempt",
                    extra={
                        "event": "abort_unauthorized_attempt",
                        "thread_id": thread_id,
                        "requesting_user": self.user_id,
                        "thread_owner": thread_user_id,
                    },
                )
                raise PermissionError(f"Not authorized to abort thread {thread_id}")

    async def _set_abort_signal(self, thread_id: str) -> None:
        """Set abort signal in Redis for worker to poll.

        Stores structured JSON data including the requesting user's ID,
        allowing workers to validate that the abort request came from the
        expected user.

        Args:
            thread_id: The thread ID to set abort signal for
        """
        redis_client = redis.from_url(REDIS_URL)
        try:
            key = f"{ABORT_SIGNAL_PREFIX}{thread_id}"
            signal_data = {
                "requested_by": self.user_id,
                "requested_at": datetime.now(timezone.utc).isoformat(),
            }
            await redis_client.set(key, json.dumps(signal_data), ex=ABORT_SIGNAL_TTL)
        finally:
            await redis_client.aclose()

    @staticmethod
    async def check_abort_signal(thread_id: str, expected_user_id: Optional[str] = None) -> bool:
        """Check if an abort signal exists for a thread from the expected user.

        Used by workers to poll for abort requests. This is a static method
        so it can be called without user context from worker tasks.

        When expected_user_id is provided, validates that the stored abort
        signal was requested by that user, preventing unauthorized callers
        from triggering aborts.

        Args:
            thread_id: Thread ID to check
            expected_user_id: If provided, only return True if the abort
                signal was requested by this user

        Returns:
            True if abort signal exists and (if expected_user_id is provided)
            the stored requester matches, False otherwise
        """
        redis_client = redis.from_url(REDIS_URL)
        try:
            key = f"{ABORT_SIGNAL_PREFIX}{thread_id}"
            stored_data = await redis_client.get(key)

            if not stored_data:
                return False

            # If no expected_user_id provided, just check existence (legacy behavior)
            if expected_user_id is None:
                return True

            # Parse stored JSON and validate requester
            try:
                signal = json.loads(stored_data)
                return signal.get("requested_by") == expected_user_id
            except (json.JSONDecodeError, TypeError):
                # Invalid JSON stored - treat as no valid signal
                logger.warning(
                    "abort_signal_invalid_json",
                    extra={
                        "event": "abort_signal_invalid_json",
                        "thread_id": thread_id,
                    },
                )
                return False

        except Exception as e:
            # Log but don't fail - worker continues if check fails
            logger.warning(
                "abort_signal_check_failed",
                extra={
                    "event": "abort_signal_check_failed",
                    "thread_id": thread_id,
                    "error": str(e),
                },
            )
            return False
        finally:
            await redis_client.aclose()

    @staticmethod
    async def clear_abort_signal(thread_id: str) -> None:
        """Clear abort signal after task terminates.

        Called by worker after processing abort to prevent stale signals
        affecting subsequent tasks on the same thread.

        Args:
            thread_id: Thread ID to clear abort signal for
        """
        redis_client = redis.from_url(REDIS_URL)
        try:
            key = f"{ABORT_SIGNAL_PREFIX}{thread_id}"
            await redis_client.delete(key)
            logger.debug(
                "abort_signal_cleared",
                extra={
                    "event": "abort_signal_cleared",
                    "thread_id": thread_id,
                },
            )
        except Exception as e:
            # Log but don't fail
            logger.warning(
                "abort_signal_clear_failed",
                extra={
                    "event": "abort_signal_clear_failed",
                    "thread_id": thread_id,
                    "error": str(e),
                },
            )
        finally:
            await redis_client.aclose()
