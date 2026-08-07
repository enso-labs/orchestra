"""Regression pins for the SQLAlchemy connection pool (issue #955).

The pool was previously created with no arguments at all, so it silently ran on
SQLAlchemy's defaults (size 5, overflow 10, timeout 30s). Combined with auth
holding a pooled connection for the whole request, that exhausted the pool and
returned 500 for every authenticated route — which surfaced in the UI as an
empty model picker.

The other half of that fix is pinned in tests/unit/utils/test_auth_dependency_scope.py.
"""

from src.constants import (
    DB_SQLA_POOL_MAX_OVERFLOW,
    DB_SQLA_POOL_RECYCLE,
    DB_SQLA_POOL_SIZE,
    DB_SQLA_POOL_TIMEOUT,
)
from src.services.db import async_engine

# SQLAlchemy's own defaults. The pool must not silently fall back to these.
SQLALCHEMY_DEFAULT_POOL_SIZE = 5
SQLALCHEMY_DEFAULT_TIMEOUT = 30


class TestAsyncEnginePoolConfig:
    def test_pool_is_explicitly_configured(self):
        pool = async_engine.pool

        assert pool.size() == DB_SQLA_POOL_SIZE
        assert pool._max_overflow == DB_SQLA_POOL_MAX_OVERFLOW
        assert pool._timeout == DB_SQLA_POOL_TIMEOUT
        assert pool._recycle == DB_SQLA_POOL_RECYCLE

    def test_pool_does_not_use_silent_defaults(self):
        """The exact failure mode from #955: no kwargs passed to create_async_engine."""
        pool = async_engine.pool

        assert pool.size() != SQLALCHEMY_DEFAULT_POOL_SIZE, (
            "Pool size fell back to the SQLAlchemy default — pool kwargs were likely dropped"
        )
        assert pool._timeout != SQLALCHEMY_DEFAULT_TIMEOUT, (
            "Pool timeout fell back to 30s; queueing that long turns a burst into a cascade of 500s"
        )

    def test_pre_ping_enabled(self):
        assert async_engine.pool._pre_ping is True

    def test_timeout_fails_fast(self):
        assert DB_SQLA_POOL_TIMEOUT <= 10, "pool_timeout must fail fast, not queue silently"
