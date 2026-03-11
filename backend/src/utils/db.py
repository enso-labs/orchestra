import ssl
from typing import Any

from sqlalchemy.engine.url import URL, make_url


def get_asyncpg_url(db_uri: str | URL) -> URL:
    """Convert a PostgreSQL URL to an asyncpg-compatible SQLAlchemy URL."""
    url = make_url(db_uri) if isinstance(db_uri, str) else db_uri
    return url.difference_update_query(["sslmode"]).set(drivername="postgresql+asyncpg")


def get_asyncpg_connect_args(
    db_uri: str | URL,
    *,
    statement_cache_size: int | None = 0,
) -> dict[str, Any]:
    """Translate libpq-style URL options into asyncpg connect args."""
    url = make_url(db_uri) if isinstance(db_uri, str) else db_uri
    connect_args: dict[str, Any] = {}

    if statement_cache_size is not None:
        connect_args["statement_cache_size"] = statement_cache_size

    sslmode = url.query.get("sslmode")
    if sslmode is None:
        return connect_args

    normalized_sslmode = sslmode.lower()
    if normalized_sslmode == "disable":
        connect_args["ssl"] = False
        return connect_args

    if normalized_sslmode in {"allow", "prefer", "require"}:
        connect_args["ssl"] = True
        return connect_args

    if normalized_sslmode == "verify-ca":
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        connect_args["ssl"] = ssl_context
        return connect_args

    if normalized_sslmode == "verify-full":
        connect_args["ssl"] = ssl.create_default_context()
        return connect_args

    raise ValueError(f"Unsupported PostgreSQL sslmode for asyncpg: {sslmode}")
