"""Guard the blast radius of `_stamp_head_with_clear()`.

Orchestra and Aegra run two independent alembic chains against the same
database. Orchestra's chain owns `orchestra_alembic_version`; the default
`alembic_version` belongs to Aegra. `_stamp_head_with_clear()` is reached from
`run_migrations()` on the "Can't locate revision" branch -- which is exactly
what a two-chain collision produces -- so if it cleared the wrong table it
would silently wipe Aegra's migration state on an Orchestra startup.

These tests verify by rejection: the Aegra sentinel row must survive.
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url

from src.constants import DB_URI
from src.utils import migrations as migrations_module

VERSION_TABLE_DDL = (
    "CREATE TABLE {name} (version_num VARCHAR(32) NOT NULL, CONSTRAINT {name}_pkc PRIMARY KEY (version_num))"
)


@pytest.fixture
def scratch_db_uri():
    """Create a throwaway database with both version tables populated.

    A scratch database keeps the assertions honest without letting a DELETE
    anywhere near the alembic state of the real test database.
    """
    url = make_url(DB_URI)
    db_name = f"orchestra_stamp_test_{uuid.uuid4().hex[:12]}"
    admin_engine = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")

    with admin_engine.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{db_name}"'))
        conn.execute(text(f'CREATE DATABASE "{db_name}"'))

    scratch_url = url.set(database=db_name)
    try:
        engine = create_engine(scratch_url)
        with engine.connect() as conn:
            conn.execute(text(VERSION_TABLE_DDL.format(name="alembic_version")))
            conn.execute(text(VERSION_TABLE_DDL.format(name="orchestra_alembic_version")))
            # The sentinel stands in for Aegra's migration state.
            conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('aegra_sentinel')"))
            conn.execute(text("INSERT INTO orchestra_alembic_version (version_num) VALUES ('orchestra_stale')"))
            conn.commit()
        engine.dispose()

        yield scratch_url.render_as_string(hide_password=False)
    finally:
        with admin_engine.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)'))
        admin_engine.dispose()


def _read_version_rows(db_uri: str, table: str) -> list[str]:
    engine = create_engine(db_uri)
    try:
        with engine.connect() as conn:
            return [row[0] for row in conn.execute(text(f"SELECT version_num FROM {table}"))]
    finally:
        engine.dispose()


def test_stamp_head_with_clear_spares_aegras_version_table(scratch_db_uri, monkeypatch):
    """Orchestra's stale row is cleared; Aegra's sentinel must survive."""
    monkeypatch.setenv("POSTGRES_CONNECTION_STRING", scratch_db_uri)

    with patch.object(migrations_module.command, "stamp", MagicMock()):
        migrations_module._stamp_head_with_clear()

    assert _read_version_rows(scratch_db_uri, "orchestra_alembic_version") == []
    assert _read_version_rows(scratch_db_uri, "alembic_version") == ["aegra_sentinel"]


def test_stamp_head_with_clear_config_carries_orchestra_version_table(scratch_db_uri, monkeypatch):
    """The Config handed to `command.stamp` must target the same table."""
    monkeypatch.setenv("POSTGRES_CONNECTION_STRING", scratch_db_uri)

    stamp_mock = MagicMock()
    with patch.object(migrations_module.command, "stamp", stamp_mock):
        migrations_module._stamp_head_with_clear()

    stamp_mock.assert_called_once()
    alembic_cfg, revision = stamp_mock.call_args[0]
    assert revision == "head"
    assert alembic_cfg.get_main_option("version_table") == "orchestra_alembic_version"
