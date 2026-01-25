"""Unit tests for TaskIQ broker configuration.

Phase 3-4 TDD: Tests for broker configuration ensuring proper setup.
"""

import pytest


class TestBrokerConfiguration:
    """Tests for broker configuration."""

    def test_broker_uses_postgres_dsn(self):
        """Broker uses PostgreSQL connection string from constants."""
        from src.workers.broker import broker
        from src.constants import DB_URI

        assert broker.dsn == DB_URI

    def test_broker_has_result_backend(self):
        """Broker is configured with result backend."""
        from src.workers.broker import broker

        assert broker.result_backend is not None

    def test_result_backend_uses_postgres(self):
        """Result backend uses PostgreSQL."""
        from src.workers.broker import result_backend
        from src.constants import DB_URI

        assert result_backend.dsn == DB_URI

    def test_broker_channel_name(self):
        """Broker uses the correct channel name."""
        from src.workers.broker import broker

        # The broker should have orchestra_tasks as channel name
        assert broker.channel_name == "orchestra_tasks"


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
