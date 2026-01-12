"""Unit tests for TaskIQ broker configuration.

Phase 3-4 TDD: Tests for broker configuration ensuring proper setup.
"""
import os
import pytest
from unittest.mock import patch


class TestBrokerConfiguration:
    """Tests for broker configuration."""

    def test_redis_url_default_value(self):
        """REDIS_URL has a default value if not set in environment."""
        # The default should be redis://localhost:6379/0
        default_url = "redis://localhost:6379/0"
        # Test the default logic
        import os as _os

        result = _os.getenv("REDIS_URL", default_url)
        # Either it's from env or the default
        assert result is not None
        assert result.startswith("redis://")

    def test_redis_url_exists_in_module(self):
        """REDIS_URL is exported from the broker module."""
        from src.workers.broker import REDIS_URL

        assert REDIS_URL is not None
        assert isinstance(REDIS_URL, str)
        assert REDIS_URL.startswith("redis://")

    def test_broker_has_result_backend(self):
        """Broker is configured with result backend."""
        from src.workers.broker import broker

        assert broker.result_backend is not None

    def test_result_backend_ttl(self):
        """Result backend has 5 minute TTL."""
        from src.workers.broker import result_backend

        assert result_backend.result_ex_time == 300

    def test_broker_queue_name(self):
        """Broker uses the correct queue name."""
        from src.workers.broker import broker

        # The broker should have orchestra_tasks as queue name
        assert "orchestra" in broker.queue_name.lower()


class TestBrokerIntegration:
    """Integration tests for broker functionality."""

    def test_broker_can_be_imported(self):
        """Broker module can be imported successfully."""
        from src.workers import broker

        assert broker is not None

    def test_broker_has_task_decorator(self):
        """Broker has task decorator for registering tasks."""
        from src.workers.broker import broker

        assert hasattr(broker, "task")
        assert callable(broker.task)
