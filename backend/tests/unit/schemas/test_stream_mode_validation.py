"""Unit tests for stream_mode validation on LLMRequest schema."""

import pytest
from pydantic import ValidationError

from src.schemas.entities.llm import LLMRequest, DEFAULT_STREAM_MODES


def _make_request(**kwargs) -> LLMRequest:
    """Helper to build an LLMRequest with minimal required fields."""
    payload = {"input": {"messages": [{"role": "user", "content": "hi"}]}, **kwargs}
    return LLMRequest(**payload)


class TestStreamModeDefaults:
    def test_no_stream_mode_is_none(self):
        req = _make_request()
        assert req.stream_mode is None

    def test_resolved_stream_mode_returns_default_when_none(self):
        req = _make_request()
        assert req.resolved_stream_mode == ["messages", "values"]
        assert req.resolved_stream_mode == DEFAULT_STREAM_MODES


class TestStreamModeValidModes:
    def test_valid_modes_accepted(self):
        req = _make_request(stream_mode=["messages", "values", "updates"])
        assert req.stream_mode == ["messages", "values", "updates"]

    def test_all_valid_modes(self):
        all_modes = ["messages", "values", "updates", "tasks", "debug", "custom", "checkpoints"]
        req = _make_request(stream_mode=all_modes)
        assert req.stream_mode == all_modes


class TestStreamModeInvalidModes:
    def test_invalid_mode_raises_validation_error(self):
        with pytest.raises(ValidationError) as exc_info:
            _make_request(stream_mode=["messages", "invalid"])
        assert "invalid" in str(exc_info.value).lower()

    def test_all_invalid_modes_raises(self):
        with pytest.raises(ValidationError):
            _make_request(stream_mode=["bogus", "fake"])


class TestStreamModeCoercion:
    def test_empty_list_coerced_to_none(self):
        req = _make_request(stream_mode=[])
        assert req.stream_mode is None

    def test_single_string_coerced_to_list(self):
        req = _make_request(stream_mode="messages")
        assert req.stream_mode == ["messages"]

    def test_duplicates_deduped_preserving_order(self):
        req = _make_request(stream_mode=["messages", "values", "messages"])
        assert req.stream_mode == ["messages", "values"]

    def test_none_stays_none(self):
        req = _make_request(stream_mode=None)
        assert req.stream_mode is None


class TestStreamModeRoundTrip:
    def test_model_dump_and_reconstruct(self):
        original = _make_request(stream_mode=["updates", "debug"])
        dumped = original.model_dump()
        restored = LLMRequest(**dumped)
        assert restored.stream_mode == ["updates", "debug"]
        assert restored.resolved_stream_mode == ["updates", "debug"]

    def test_none_round_trip(self):
        original = _make_request()
        dumped = original.model_dump()
        restored = LLMRequest(**dumped)
        assert restored.stream_mode is None
        assert restored.resolved_stream_mode == DEFAULT_STREAM_MODES
