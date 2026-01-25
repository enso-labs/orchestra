"""Unit tests for AbortService."""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from langgraph.store.memory import InMemoryStore

from src.services.abort import AbortService, ABORT_SIGNAL_TTL


class TestAbortServiceInit:
    """Tests for AbortService initialization."""

    def test_init_sets_user_id(self) -> None:
        """Test that initialization sets user_id correctly."""
        store = InMemoryStore()
        user_id = str(uuid4())
        service = AbortService(user_id=user_id, store=store)
        assert service.user_id == user_id

    def test_init_sets_store(self) -> None:
        """Test that initialization sets store correctly."""
        store = InMemoryStore()
        user_id = str(uuid4())
        service = AbortService(user_id=user_id, store=store)
        assert service.store == store

    def test_init_creates_thread_service(self) -> None:
        """Test that initialization creates ThreadService."""
        store = InMemoryStore()
        user_id = str(uuid4())
        service = AbortService(user_id=user_id, store=store)
        assert service.thread_service is not None
        assert service.thread_service.user_id == user_id


@pytest.mark.asyncio
class TestAbortServiceRequestAbort:
    """Tests for AbortService.request_abort method."""

    async def test_request_abort_verifies_ownership_if_exists(self):
        """Test that request_abort calls ownership verification."""
        store = InMemoryStore()
        user_id = str(uuid4())
        thread_id = str(uuid4())
        service = AbortService(user_id=user_id, store=store)

        # Mock the methods
        service._verify_thread_ownership_if_exists = AsyncMock()
        service._set_abort_signal = AsyncMock()

        await service.request_abort(thread_id)

        service._verify_thread_ownership_if_exists.assert_called_once_with(thread_id)

    async def test_request_abort_sets_signal(self):
        """Test that request_abort sets abort signal."""
        store = InMemoryStore()
        user_id = str(uuid4())
        thread_id = str(uuid4())
        service = AbortService(user_id=user_id, store=store)

        # Mock the methods
        service._verify_thread_ownership_if_exists = AsyncMock()
        service._set_abort_signal = AsyncMock()

        await service.request_abort(thread_id)

        service._set_abort_signal.assert_called_once_with(thread_id)

    async def test_request_abort_returns_status_message(self):
        """Test that request_abort returns correct status message."""
        store = InMemoryStore()
        user_id = str(uuid4())
        thread_id = str(uuid4())
        service = AbortService(user_id=user_id, store=store)

        # Mock the methods
        service._verify_thread_ownership_if_exists = AsyncMock()
        service._set_abort_signal = AsyncMock()

        result = await service.request_abort(thread_id)

        assert "Abort signal sent" in result
        assert "checkpoint" in result

    async def test_request_abort_raises_permission_error_when_unauthorized(self):
        """Test that request_abort raises PermissionError when unauthorized."""
        store = InMemoryStore()
        user_id = str(uuid4())
        thread_id = str(uuid4())
        service = AbortService(user_id=user_id, store=store)

        # Mock to raise PermissionError
        service._verify_thread_ownership_if_exists = AsyncMock(
            side_effect=PermissionError(f"Not authorized to abort thread {thread_id}")
        )

        with pytest.raises(PermissionError):
            await service.request_abort(thread_id)

    async def test_request_abort_succeeds_when_thread_not_in_store(self):
        """Test that request_abort succeeds even when thread not in store (first turn)."""
        store = InMemoryStore()
        user_id = str(uuid4())
        thread_id = str(uuid4())
        service = AbortService(user_id=user_id, store=store)

        # Mock ownership check to pass (thread not in store is allowed)
        service._verify_thread_ownership_if_exists = AsyncMock()
        service._set_abort_signal = AsyncMock()

        # Should not raise
        result = await service.request_abort(thread_id)
        assert "Abort signal sent" in result


@pytest.mark.asyncio
class TestAbortServiceVerifyOwnershipIfExists:
    """Tests for AbortService._verify_thread_ownership_if_exists method."""

    async def test_verify_ownership_allows_abort_when_thread_not_in_store(self):
        """Test that ownership verification allows abort when thread not in store (first turn)."""
        store = InMemoryStore()
        user_id = str(uuid4())
        thread_id = str(uuid4())
        service = AbortService(user_id=user_id, store=store)

        # Mock thread_service.get to return None
        service.thread_service.get = AsyncMock(return_value=None)

        # Should not raise - allows abort during first turn
        await service._verify_thread_ownership_if_exists(thread_id)

    async def test_verify_ownership_passes_for_owned_thread(self):
        """Test that ownership verification passes for owned thread."""
        store = InMemoryStore()
        user_id = str(uuid4())
        thread_id = str(uuid4())
        service = AbortService(user_id=user_id, store=store)

        # Mock thread_service.get to return thread with matching user_id in metadata
        mock_thread = MagicMock()
        mock_thread.metadata = {"user_id": user_id}
        service.thread_service.get = AsyncMock(return_value=mock_thread)

        # Should not raise
        await service._verify_thread_ownership_if_exists(thread_id)

    async def test_verify_ownership_raises_permission_error_for_other_user(self):
        """Test that ownership verification raises PermissionError for other user's thread."""
        store = InMemoryStore()
        user_id = str(uuid4())
        other_user_id = str(uuid4())
        thread_id = str(uuid4())
        service = AbortService(user_id=user_id, store=store)

        # Mock thread_service.get to return thread with different user_id in metadata
        mock_thread = MagicMock()
        mock_thread.metadata = {"user_id": other_user_id}
        service.thread_service.get = AsyncMock(return_value=mock_thread)

        with pytest.raises(PermissionError, match="Not authorized to abort thread"):
            await service._verify_thread_ownership_if_exists(thread_id)

    async def test_verify_ownership_passes_when_no_metadata(self):
        """Test that ownership verification passes when thread has no metadata."""
        store = InMemoryStore()
        user_id = str(uuid4())
        thread_id = str(uuid4())
        service = AbortService(user_id=user_id, store=store)

        # Mock thread_service.get to return thread without metadata
        mock_thread = MagicMock()
        mock_thread.metadata = None
        service.thread_service.get = AsyncMock(return_value=mock_thread)

        # Should not raise (namespace lookup already verified ownership)
        await service._verify_thread_ownership_if_exists(thread_id)

    async def test_verify_ownership_passes_when_no_user_id_in_metadata(self):
        """Test that ownership verification passes when metadata has no user_id."""
        store = InMemoryStore()
        user_id = str(uuid4())
        thread_id = str(uuid4())
        service = AbortService(user_id=user_id, store=store)

        # Mock thread_service.get to return thread with metadata but no user_id
        mock_thread = MagicMock()
        mock_thread.metadata = {"other_field": "value"}
        service.thread_service.get = AsyncMock(return_value=mock_thread)

        # Should not raise (namespace lookup already verified ownership)
        await service._verify_thread_ownership_if_exists(thread_id)


@pytest.mark.asyncio
class TestAbortServiceSetSignal:
    """Tests for AbortService._set_abort_signal method."""

    async def test_set_abort_signal_executes_insert(self):
        """Test that _set_abort_signal executes correct PostgreSQL insert."""
        store = InMemoryStore()
        user_id = str(uuid4())
        thread_id = str(uuid4())
        service = AbortService(user_id=user_id, store=store)

        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock()
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            await service._set_abort_signal(thread_id)

        mock_conn.execute.assert_called_once()
        call_args = mock_conn.execute.call_args
        # Check that thread_id and user_id were passed
        assert thread_id in call_args[0]
        assert user_id in call_args[0]


@pytest.mark.asyncio
class TestAbortServiceCheckSignal:
    """Tests for AbortService.check_abort_signal static method."""

    async def test_check_abort_signal_returns_true_when_exists_no_user_check(self):
        """Test that check_abort_signal returns True when signal exists (legacy behavior)."""
        thread_id = str(uuid4())
        user_id = str(uuid4())

        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(return_value={"requested_by": user_id})
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            result = await AbortService.check_abort_signal(thread_id)

        assert result is True

    async def test_check_abort_signal_returns_true_when_user_matches(self):
        """Test that check_abort_signal returns True when expected_user_id matches."""
        thread_id = str(uuid4())
        user_id = str(uuid4())

        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(return_value={"requested_by": user_id})
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            result = await AbortService.check_abort_signal(
                thread_id, expected_user_id=user_id
            )

        assert result is True

    async def test_check_abort_signal_returns_false_when_user_mismatch(self):
        """Test that check_abort_signal returns False when expected_user_id doesn't match."""
        thread_id = str(uuid4())
        user_id = str(uuid4())
        other_user_id = str(uuid4())

        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(return_value={"requested_by": other_user_id})
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            result = await AbortService.check_abort_signal(
                thread_id, expected_user_id=user_id
            )

        assert result is False

    async def test_check_abort_signal_returns_false_when_not_exists(self):
        """Test that check_abort_signal returns False when signal doesn't exist."""
        thread_id = str(uuid4())

        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(return_value=None)
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            result = await AbortService.check_abort_signal(thread_id)

        assert result is False

    async def test_check_abort_signal_returns_false_on_error(self):
        """Test that check_abort_signal returns False on PostgreSQL error."""
        thread_id = str(uuid4())

        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(side_effect=Exception("Connection failed"))
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            result = await AbortService.check_abort_signal(thread_id)

        assert result is False


@pytest.mark.asyncio
class TestAbortServiceClearSignal:
    """Tests for AbortService.clear_abort_signal static method."""

    async def test_clear_abort_signal_deletes_row(self):
        """Test that clear_abort_signal executes delete query."""
        thread_id = str(uuid4())

        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock()
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            await AbortService.clear_abort_signal(thread_id)

        mock_conn.execute.assert_called_once()
        call_args = mock_conn.execute.call_args
        assert "DELETE" in call_args[0][0]
        assert thread_id in call_args[0]

    async def test_clear_abort_signal_handles_error_gracefully(self):
        """Test that clear_abort_signal handles errors gracefully."""
        thread_id = str(uuid4())

        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(side_effect=Exception("Connection failed"))
        mock_conn.close = AsyncMock()

        # Should not raise
        with patch("asyncpg.connect", return_value=mock_conn):
            await AbortService.clear_abort_signal(thread_id)
