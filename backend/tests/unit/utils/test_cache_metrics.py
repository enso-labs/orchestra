"""Tests for cache_metrics_middleware in src/utils/middleware.py."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage

from src.utils.middleware import cache_metrics_middleware


def _make_response(usage_metadata=None):
    """Build a mock ModelResponse with an AIMessage carrying usage_metadata."""
    ai_msg = AIMessage(content="Hello")
    if usage_metadata is not None:
        ai_msg.usage_metadata = usage_metadata
    else:
        ai_msg.usage_metadata = None
    response = MagicMock()
    response.messages = [ai_msg]
    return response


def _make_usage(input_tokens=100, output_tokens=50, total_tokens=150, cache_creation=0, cache_read=0):
    """Build a mock usage_metadata namespace."""
    details = SimpleNamespace(cache_creation=cache_creation, cache_read=cache_read)
    return SimpleNamespace(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        input_token_details=details,
    )


@pytest.mark.asyncio
async def test_logs_cache_metrics_when_cache_data_present():
    """Should log structured metrics when cache_read > 0."""
    usage = _make_usage(input_tokens=1000, cache_read=800, cache_creation=200)
    response = _make_response(usage_metadata=usage)

    handler = AsyncMock(return_value=response)
    request = MagicMock()

    with patch("src.utils.middleware.logger") as mock_logger:
        result = await cache_metrics_middleware.awrap_model_call(request, handler)

    handler.assert_awaited_once_with(request)
    assert result is response

    mock_logger.info.assert_called_once()
    log_msg = mock_logger.info.call_args[0][0]
    assert "prompt_cache_metrics" in log_msg
    assert "cache_read_tokens=800" in log_msg
    assert "cache_creation_tokens=200" in log_msg
    assert "cache_hit_ratio=80.0%" in log_msg


@pytest.mark.asyncio
async def test_no_log_when_no_cache_data():
    """Should not log when cache_creation and cache_read are both 0."""
    usage = _make_usage(input_tokens=100, cache_read=0, cache_creation=0)
    response = _make_response(usage_metadata=usage)

    handler = AsyncMock(return_value=response)
    request = MagicMock()

    with patch("src.utils.middleware.logger") as mock_logger:
        result = await cache_metrics_middleware.awrap_model_call(request, handler)

    assert result is response
    mock_logger.info.assert_not_called()


@pytest.mark.asyncio
async def test_no_op_when_usage_metadata_is_none():
    """Should pass through when usage_metadata is None."""
    response = _make_response(usage_metadata=None)

    handler = AsyncMock(return_value=response)
    request = MagicMock()

    with patch("src.utils.middleware.logger") as mock_logger:
        result = await cache_metrics_middleware.awrap_model_call(request, handler)

    assert result is response
    mock_logger.info.assert_not_called()


@pytest.mark.asyncio
async def test_no_op_when_response_has_no_ai_message():
    """Should pass through when response has no AIMessage."""
    response = MagicMock()
    response.messages = []

    handler = AsyncMock(return_value=response)
    request = MagicMock()

    with patch("src.utils.middleware.logger") as mock_logger:
        result = await cache_metrics_middleware.awrap_model_call(request, handler)

    assert result is response
    mock_logger.info.assert_not_called()


@pytest.mark.asyncio
async def test_graceful_when_input_token_details_missing():
    """Should handle missing input_token_details without error."""
    usage = SimpleNamespace(
        input_tokens=100,
        output_tokens=50,
        total_tokens=150,
        input_token_details=None,
    )
    response = _make_response(usage_metadata=usage)

    handler = AsyncMock(return_value=response)
    request = MagicMock()

    with patch("src.utils.middleware.logger") as mock_logger:
        result = await cache_metrics_middleware.awrap_model_call(request, handler)

    assert result is response
    mock_logger.info.assert_not_called()


@pytest.mark.asyncio
async def test_cache_hit_ratio_computation():
    """Verify cache_hit_ratio = cache_read / input_tokens * 100."""
    usage = _make_usage(input_tokens=500, cache_read=250, cache_creation=0)
    response = _make_response(usage_metadata=usage)

    handler = AsyncMock(return_value=response)
    request = MagicMock()

    with patch("src.utils.middleware.logger") as mock_logger:
        await cache_metrics_middleware.awrap_model_call(request, handler)

    log_msg = mock_logger.info.call_args[0][0]
    assert "cache_hit_ratio=50.0%" in log_msg


@pytest.mark.asyncio
async def test_logs_when_only_cache_creation():
    """Should log when cache_creation > 0 even if cache_read is 0."""
    usage = _make_usage(input_tokens=1000, cache_read=0, cache_creation=500)
    response = _make_response(usage_metadata=usage)

    handler = AsyncMock(return_value=response)
    request = MagicMock()

    with patch("src.utils.middleware.logger") as mock_logger:
        await cache_metrics_middleware.awrap_model_call(request, handler)

    mock_logger.info.assert_called_once()
    log_msg = mock_logger.info.call_args[0][0]
    assert "cache_creation_tokens=500" in log_msg
    assert "cache_hit_ratio=0.0%" in log_msg
