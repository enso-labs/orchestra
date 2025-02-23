from alembic import command
from alembic.config import Config
from loguru import logger

def run_migrations():
    """Run database migrations on startup"""
    try:
        logger.info("Running database migrations...")
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migrations completed successfully")
    except Exception as e:
        logger.error(f"Error running database migrations: {str(e)}")
        raise e 