import ssl

import pytest

from src.utils.db import get_asyncpg_connect_args, get_asyncpg_url


def test_get_asyncpg_url_strips_sslmode_and_sets_asyncpg_driver():
    url = get_asyncpg_url("postgresql://user:pass@localhost:5432/app?sslmode=disable&application_name=orchestra")

    assert url.drivername == "postgresql+asyncpg"
    assert "sslmode" not in url.query
    assert url.query["application_name"] == "orchestra"


def test_get_asyncpg_connect_args_maps_sslmode_disable_to_ssl_false():
    connect_args = get_asyncpg_connect_args("postgresql://user:pass@localhost:5432/app?sslmode=disable")

    assert connect_args["statement_cache_size"] == 0
    assert connect_args["ssl"] is False


def test_get_asyncpg_connect_args_maps_sslmode_require_to_ssl_true():
    connect_args = get_asyncpg_connect_args("postgresql://user:pass@localhost:5432/app?sslmode=require")

    assert connect_args["ssl"] is True


def test_get_asyncpg_connect_args_maps_verify_ca_to_ssl_context():
    connect_args = get_asyncpg_connect_args("postgresql://user:pass@localhost:5432/app?sslmode=verify-ca")

    assert isinstance(connect_args["ssl"], ssl.SSLContext)
    assert connect_args["ssl"].check_hostname is False


def test_get_asyncpg_connect_args_rejects_unknown_sslmode():
    with pytest.raises(ValueError, match="Unsupported PostgreSQL sslmode"):
        get_asyncpg_connect_args("postgresql://user:pass@localhost:5432/app?sslmode=bogus")
