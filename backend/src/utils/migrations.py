from alembic import command
from alembic.config import Config
from alembic.util.exc import CommandError
from sqlalchemy import create_engine, text
from loguru import logger
import os


def _stamp_head_with_clear():
    """Clear stale alembic_version and stamp to head.

    Used when the recorded revision doesn't exist but tables already exist.
    """
    db_uri = os.environ.get("POSTGRES_CONNECTION_STRING")
    if not db_uri:
        logger.warning("POSTGRES_CONNECTION_STRING not set, skipping revision clear")
        return

    try:
        engine = create_engine(db_uri)
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM alembic_version"))
            conn.commit()
        engine.dispose()
        logger.info("Cleared stale alembic_version table")

        # Stamp to head after clearing
        alembic_cfg = Config("alembic.ini")
        command.stamp(alembic_cfg, "head")
        logger.info("Database stamped to head")
    except Exception as e:
        logger.warning(f"Failed to clear and stamp: {str(e)}")
        raise e


def run_migrations():
    """Run database migrations on startup"""
    try:
        logger.info("Running database migrations...")
        alembic_cfg = Config("alembic.ini")
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
        logger.error(f"Error running database migrations: {str(e)}")
        raise e
