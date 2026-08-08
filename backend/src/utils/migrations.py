from alembic import command
from alembic.config import Config
from alembic.util.exc import CommandError
from sqlalchemy import create_engine, text
from loguru import logger
import os
from pathlib import Path


# Orchestra's alembic chain owns this table, NOT the default `alembic_version`.
# `alembic_version` belongs to Aegra's chain, which runs against the same
# database. Anything here that touched `alembic_version` would destroy another
# system's migration state. Keep this in sync with migrations/env.py.
ORCHESTRA_VERSION_TABLE = "orchestra_alembic_version"


def _build_alembic_config() -> Config:
    """Build an alembic Config pinned to Orchestra's version table."""
    # Resolve alembic.ini relative to this file, not the process cwd. Every
    # documented caller happens to run from `backend/`, but a script invoked
    # from the repo root would otherwise silently pick up nothing.
    ini_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    alembic_cfg = Config(str(ini_path))
    alembic_cfg.set_main_option("version_table", ORCHESTRA_VERSION_TABLE)
    return alembic_cfg


def _rename_not_yet_applied() -> bool:
    """True when the DB still holds the pre-rename layout.

    `orchestra_alembic_version` missing while `alembic_version` is present means
    the one-time `ALTER TABLE` from the US-001 runbook has not run yet. Alembic
    would read that as an unversioned database and replay from `0000_init`,
    whose `op.create_table("users", ...)` has no `IF NOT EXISTS` -- so the real
    error surfaces as `DuplicateTable`, which says nothing about the true cause.
    """
    db_uri = os.environ.get("POSTGRES_CONNECTION_STRING")
    if not db_uri:
        return False
    try:
        engine = create_engine(db_uri)
        with engine.connect() as conn:
            present = {
                row[0]
                for row in conn.execute(
                    text(
                        "SELECT tablename FROM pg_tables WHERE tablename IN ('alembic_version', :orchestra)"
                    ).bindparams(orchestra=ORCHESTRA_VERSION_TABLE)
                )
            }
        engine.dispose()
        return ORCHESTRA_VERSION_TABLE not in present and "alembic_version" in present
    except Exception:
        # Never let the diagnostic itself become the failure.
        return False


def _stamp_head_with_clear():
    """Clear stale orchestra_alembic_version and stamp to head.

    Used when the recorded revision doesn't exist but tables already exist.

    Only Orchestra's own version table (`orchestra_alembic_version`) is cleared.
    The default `alembic_version` table is Aegra's and must never be touched
    here -- clearing it would wipe a second migration chain's state.
    """
    db_uri = os.environ.get("POSTGRES_CONNECTION_STRING")
    if not db_uri:
        logger.warning("POSTGRES_CONNECTION_STRING not set, skipping revision clear")
        return

    try:
        engine = create_engine(db_uri)
        with engine.connect() as conn:
            conn.execute(text(f"DELETE FROM {ORCHESTRA_VERSION_TABLE}"))
            conn.commit()
        engine.dispose()
        logger.info(f"Cleared stale {ORCHESTRA_VERSION_TABLE} table")

        # Stamp to head after clearing
        alembic_cfg = _build_alembic_config()
        command.stamp(alembic_cfg, "head")
        logger.info("Database stamped to head")
    except Exception as e:
        logger.warning(f"Failed to clear and stamp: {str(e)}")
        raise e


def run_migrations():
    """Run database migrations on startup"""
    try:
        logger.info("Running database migrations...")
        alembic_cfg = _build_alembic_config()
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migrations completed successfully")
    except CommandError as e:
        # Handle case where database has a stale revision that no longer exists
        if "Can't locate revision" in str(e):
            logger.warning(f"Database has stale revision, clearing and stamping: {str(e)}")
            _stamp_head_with_clear()
        else:
            logger.error(f"Error running database migrations: {str(e)}")
            raise e
    except Exception as e:
        if _rename_not_yet_applied():
            logger.error(
                "Database migrations failed because the US-001 rename has not been applied. "
                f"This database has `alembic_version` but no `{ORCHESTRA_VERSION_TABLE}`, so alembic "
                "treated it as unversioned and replayed from 0000_init against existing tables. "
                "Run the one-time `ALTER TABLE alembic_version RENAME TO "
                f"{ORCHESTRA_VERSION_TABLE};` before starting this code. "
                f"Underlying error: {str(e)}"
            )
            raise e
        logger.error(f"Error running database migrations: {str(e)}")
        raise e
