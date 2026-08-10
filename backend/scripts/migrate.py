"""Run Orchestra and Aegra migrations as one ordered, fail-closed init step.

The API container must not race either migration chain.  This command is run by
Compose/CI/deployment as a short-lived init container before the Aegra API is
started.  It performs no database creation, restore, rename, or destructive
repair; those are operator-owned actions documented in the cutover runbook.
"""

from __future__ import annotations

import asyncio
import os
import sys
from dataclasses import dataclass
from typing import Iterable

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ORCHESTRA_VERSION_TABLE = "orchestra_alembic_version"
AEGRA_VERSION_TABLE = "alembic_version"
REQUIRED_LANGGRAPH_TABLES = (
    "checkpoint_migrations",
    "checkpoints",
    "checkpoint_blobs",
    "checkpoint_writes",
    "store_migrations",
    "store",
    "store_vectors",
    "vector_migrations",
)


class MigrationPreflightError(RuntimeError):
    """Raised when a migration target is missing, ambiguous, or incomplete."""


@dataclass(frozen=True)
class DatabaseIdentity:
    """Non-secret identity fields used to compare two PostgreSQL URLs."""

    host: str
    port: int
    database: str
    username: str


@dataclass(frozen=True)
class TableFingerprint:
    """Stable row count and content digest for a LangGraph table."""

    row_count: int
    digest: str


@dataclass(frozen=True)
class MigrationConfig:
    """Environment-backed migration configuration with no secret logging."""

    orchestra_url: str
    aegra_url: str
    expected_database: str | None

    @classmethod
    def from_environment(cls) -> "MigrationConfig":
        orchestra_url = os.environ.get("POSTGRES_CONNECTION_STRING")
        aegra_url = os.environ.get("DATABASE_URL") or orchestra_url
        if not orchestra_url:
            raise MigrationPreflightError("POSTGRES_CONNECTION_STRING is required for the migration init step")
        if not aegra_url:
            raise MigrationPreflightError("DATABASE_URL is required for the Aegra migration chain")
        # Aegra reads DATABASE_URL while its settings module is imported. Keep
        # older operator env files safe without allowing the two chains to
        # diverge: the fallback is the already-validated Orchestra target.
        os.environ["DATABASE_URL"] = aegra_url
        expected_database = os.environ.get("MIGRATION_DATABASE_NAME") or None
        return cls(
            orchestra_url=orchestra_url,
            aegra_url=aegra_url,
            expected_database=expected_database,
        )


def database_identity(uri: str) -> DatabaseIdentity:
    """Extract comparable target identity from a PostgreSQL URL.

    Passwords and query parameters are intentionally excluded.  The URL is
    never printed, so credentials cannot leak through migration diagnostics.
    """

    try:
        parsed = make_url(uri)
    except Exception as exc:  # pragma: no cover - SQLAlchemy owns URL parsing
        raise MigrationPreflightError("Invalid PostgreSQL connection URL") from exc

    database = parsed.database
    if not database:
        raise MigrationPreflightError("PostgreSQL connection URL has no database name")

    return DatabaseIdentity(
        host=(parsed.host or "localhost").lower(),
        port=parsed.port or 5432,
        database=database,
        username=parsed.username or "",
    )


def validate_configured_identity(config: MigrationConfig) -> DatabaseIdentity:
    """Reject split URLs or an explicitly wrong database before any writes."""

    orchestra = database_identity(config.orchestra_url)
    aegra = database_identity(config.aegra_url)
    if orchestra != aegra:
        raise MigrationPreflightError(
            "POSTGRES_CONNECTION_STRING and DATABASE_URL target different database identities; refusing to migrate"
        )
    if config.expected_database and orchestra.database != config.expected_database:
        raise MigrationPreflightError(
            f"Configured migration database is {orchestra.database!r}, "
            f"but MIGRATION_DATABASE_NAME requires {config.expected_database!r}"
        )
    return orchestra


def _psycopg_connection_url(uri: str) -> str:
    """Normalize SQLAlchemy async driver URLs for psycopg LangGraph setup."""

    parsed = make_url(uri)
    if parsed.drivername.endswith("+asyncpg"):
        parsed = parsed.set(drivername="postgresql")
    return parsed.render_as_string(hide_password=False)


def _script_revisions(config: Config) -> set[str]:
    script = ScriptDirectory.from_config(config)
    return {revision.revision for revision in script.walk_revisions()}


def _orchestra_config() -> Config:
    """Build the Orchestra Alembic config without importing the API app."""

    from src.utils.migrations import _build_alembic_config

    return _build_alembic_config()


def _aegra_config() -> Config:
    """Build the pinned Aegra Alembic config from the installed package."""

    from aegra_api.core.migrations import get_alembic_config

    return get_alembic_config()


def _version_rows(connection, table: str) -> list[str]:
    rows = connection.execute(text(f"SELECT version_num FROM {table} ORDER BY version_num"))
    return [str(row[0]) for row in rows]


def _table_exists(connection, table: str) -> bool:
    return bool(
        connection.execute(
            text("SELECT to_regclass(:qualified) IS NOT NULL"),
            {"qualified": f"public.{table}"},
        ).scalar()
    )


def inspect_version_ownership(connection, orchestra_revisions: set[str], aegra_revisions: set[str]) -> None:
    """Reject the pre-rename and ambiguous two-chain layouts.

    A fresh database has neither table and is valid.  A database with only the
    default table is not valid for this deployment: it may still be the old
    Orchestra table, and silently guessing would risk Aegra's migration state.
    """

    orchestra_exists = _table_exists(connection, ORCHESTRA_VERSION_TABLE)
    aegra_exists = _table_exists(connection, AEGRA_VERSION_TABLE)
    if aegra_exists and not orchestra_exists:
        raise MigrationPreflightError(
            f"{AEGRA_VERSION_TABLE} exists without {ORCHESTRA_VERSION_TABLE}; "
            "apply the operator-owned one-time rename before starting this deployment"
        )

    if orchestra_exists:
        orchestra_rows = _version_rows(connection, ORCHESTRA_VERSION_TABLE)
        if len(orchestra_rows) > 1:
            raise MigrationPreflightError(f"{ORCHESTRA_VERSION_TABLE} has multiple revisions; ownership is ambiguous")
        unknown = set(orchestra_rows) - orchestra_revisions
        if unknown:
            raise MigrationPreflightError(
                f"{ORCHESTRA_VERSION_TABLE} contains unknown revisions {sorted(unknown)}; refusing automatic repair"
            )

    if aegra_exists:
        aegra_rows = _version_rows(connection, AEGRA_VERSION_TABLE)
        if len(aegra_rows) > 1:
            raise MigrationPreflightError(f"{AEGRA_VERSION_TABLE} has multiple revisions; ownership is ambiguous")
        unknown = set(aegra_rows) - aegra_revisions
        if unknown:
            raise MigrationPreflightError(
                f"{AEGRA_VERSION_TABLE} contains unknown revisions {sorted(unknown)}; refusing automatic repair"
            )


def _fingerprint_query(table: str) -> str:
    """Return a stable key/content digest query for a supported LangGraph table."""

    queries = {
        "checkpoints": """
            SELECT count(*)::bigint,
                   COALESCE(md5(string_agg(
                       md5(concat_ws(E'\\x1f', thread_id, checkpoint_ns, checkpoint_id,
                                     parent_checkpoint_id, checkpoint::text, metadata::text)),
                       ',' ORDER BY thread_id, checkpoint_ns, checkpoint_id)), md5(''))
            FROM checkpoints
        """,
        "store": """
            SELECT count(*)::bigint,
                   COALESCE(md5(string_agg(
                       md5(concat_ws(E'\\x1f', prefix, key, value::text)),
                       ',' ORDER BY prefix, key)), md5(''))
            FROM store
        """,
        "store_vectors": """
            SELECT count(*)::bigint,
                   COALESCE(md5(string_agg(
                       md5(concat_ws(E'\\x1f', prefix, key, field_name, embedding::text)),
                       ',' ORDER BY prefix, key, field_name)), md5(''))
            FROM store_vectors
        """,
    }
    return queries[table]


def capture_data_fingerprints(
    connection, tables: Iterable[str] = ("checkpoints", "store", "store_vectors")
) -> dict[str, TableFingerprint | None]:
    """Capture stable keys/content digests without rewriting any rows."""

    fingerprints: dict[str, TableFingerprint | None] = {}
    for table in tables:
        if not _table_exists(connection, table):
            fingerprints[table] = None
            continue
        row = connection.execute(text(_fingerprint_query(table))).one()
        fingerprints[table] = TableFingerprint(row_count=int(row[0]), digest=str(row[1]))
    return fingerprints


def verify_data_preserved(
    before: dict[str, TableFingerprint | None], after: dict[str, TableFingerprint | None]
) -> None:
    """Fail if a pre-existing table's row content changed during initialization."""

    for table, old in before.items():
        if old is None:
            continue
        current = after.get(table)
        if current != old:
            raise MigrationPreflightError(
                f"Existing {table} content changed during migration: before={old!r}, after={current!r}"
            )


def verify_required_tables(connection) -> None:
    """Ensure Aegra can open all checkpoint/store tables before API startup."""

    missing = [table for table in REQUIRED_LANGGRAPH_TABLES if not _table_exists(connection, table)]
    if missing:
        raise MigrationPreflightError(f"Required LangGraph tables are missing after setup: {', '.join(missing)}")


def _verify_live_database(connection, identity: DatabaseIdentity) -> None:
    current_database = str(connection.execute(text("SELECT current_database()")).scalar())
    if current_database != identity.database:
        raise MigrationPreflightError(
            f"Connected database identity {current_database!r} does not match configured {identity.database!r}"
        )


def _run_orchestra_migrations() -> None:
    cfg = _orchestra_config()
    command.upgrade(cfg, "head")


def _run_aegra_migrations() -> None:
    from aegra_api.core.migrations import run_migrations

    run_migrations()


async def _setup_langgraph_tables(connection_url: str) -> None:
    """Create LangGraph checkpoint/store tables before the API is released."""

    from aegra_api.config import load_store_config
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from langgraph.store.postgres.aio import AsyncPostgresStore

    store_config = load_store_config() or {}
    index_config = store_config.get("index")
    async with AsyncPostgresSaver.from_conn_string(connection_url) as checkpointer:
        await checkpointer.setup()
    async with AsyncPostgresStore.from_conn_string(connection_url, index=index_config) as store:
        await store.setup()


def run() -> None:
    """Execute the ordered migration/preflight transaction."""

    config = MigrationConfig.from_environment()
    identity = validate_configured_identity(config)
    engine = create_engine(config.orchestra_url)
    try:
        with engine.connect() as connection:
            _verify_live_database(connection, identity)
            orchestra_revisions = _script_revisions(_orchestra_config())
            aegra_revisions = _script_revisions(_aegra_config())
            inspect_version_ownership(connection, orchestra_revisions, aegra_revisions)
            before = capture_data_fingerprints(connection)

        print(f"Migration target verified: {identity.host}:{identity.port}/{identity.database}")
        print("Applying Orchestra migrations (orchestra_alembic_version)")
        _run_orchestra_migrations()
        print("Applying Aegra migrations (alembic_version)")
        _run_aegra_migrations()
        print("Initializing LangGraph checkpoint/store tables")
        asyncio.run(_setup_langgraph_tables(_psycopg_connection_url(config.orchestra_url)))

        with engine.connect() as connection:
            _verify_live_database(connection, identity)
            after = capture_data_fingerprints(connection)
            verify_data_preserved(before, after)
            verify_required_tables(connection)
            orchestra_rows = _version_rows(connection, ORCHESTRA_VERSION_TABLE)
            aegra_rows = _version_rows(connection, AEGRA_VERSION_TABLE)
            orchestra_head = ScriptDirectory.from_config(_orchestra_config()).get_current_head()
            aegra_head = ScriptDirectory.from_config(_aegra_config()).get_current_head()
            if orchestra_rows != [orchestra_head]:
                raise MigrationPreflightError(
                    f"{ORCHESTRA_VERSION_TABLE} is not at head: expected {orchestra_head!r}, got {orchestra_rows!r}"
                )
            if aegra_rows != [aegra_head]:
                raise MigrationPreflightError(
                    f"{AEGRA_VERSION_TABLE} is not at head: expected {aegra_head!r}, got {aegra_rows!r}"
                )
    finally:
        engine.dispose()

    print("Migration preflight complete; API startup may proceed")


def main() -> int:
    try:
        run()
    except Exception as exc:
        print(f"Migration preflight failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
