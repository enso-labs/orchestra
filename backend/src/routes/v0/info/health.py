from fastapi import Depends, APIRouter, HTTPException
from src.constants import (
    APP_VERSION,
    DB_SQLA_POOL_MAX_OVERFLOW,
    DB_SQLA_POOL_SIZE,
    DB_SQLA_POOL_TIMEOUT,
)
from src.services.db import async_engine, get_store, get_checkpoint_db
from langgraph.store.postgres import AsyncPostgresStore
from src.utils.logger import logger
import asyncio

router = APIRouter(prefix="/health")


@router.get("", name="Overall Health Check")
async def health_check():
    """Simple health check endpoint"""
    return {
        "status": "healthy",
        "message": "Service is running",
        "version": APP_VERSION,
    }


@router.get("/db", name="Database Pool Health Check")
async def check_db_pool_health():
    """Report SQLAlchemy connection pool utilisation.

    Pure introspection of the pool object — issues no query, so it still answers
    when the pool is exhausted. That is the point: pool exhaustion surfaces as a
    500 on every authenticated route, and this makes it one curl to confirm.
    """
    pool = async_engine.pool
    checked_out = pool.checkedout()
    capacity = DB_SQLA_POOL_SIZE + DB_SQLA_POOL_MAX_OVERFLOW

    return {
        "status": "healthy" if checked_out < capacity else "exhausted",
        "size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": checked_out,
        "overflow": pool.overflow(),
        "max_size": DB_SQLA_POOL_SIZE,
        "max_overflow": DB_SQLA_POOL_MAX_OVERFLOW,
        "capacity": capacity,
        "timeout": DB_SQLA_POOL_TIMEOUT,
    }


@router.get("/store", name="Store Health Check")
async def check_store_health(
    store: AsyncPostgresStore = Depends(get_store),
):
    """Check if the AsyncPostgresStore connection is healthy"""
    try:
        # Test basic store operation with timeout
        async with asyncio.timeout(5.0):  # 5 second timeout
            async with store as s:
                # Try a simple search operation
                await s.asearch(("health_check",), limit=1)
                return {
                    "status": "healthy",
                    "store_type": type(store).__name__,
                    "test_operation": "search",
                    "message": "Store connection is working",
                }
    except asyncio.TimeoutError:
        logger.error("Store health check timed out")
        raise HTTPException(status_code=503, detail="Store connection timeout - service unavailable")
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Store health check failed: {error_msg}")

        if "connection" in error_msg.lower() and "closed" in error_msg.lower():
            raise HTTPException(
                status_code=503,
                detail="Store connection is closed - service unavailable",
            )

        raise HTTPException(status_code=500, detail=f"Store health check failed: {error_msg}")


@router.get("/checkpointer", name="Checkpointer Health Check")
async def check_checkpointer_health():
    """Check if the AsyncPostgresSaver connection is healthy"""
    try:
        # Test basic checkpointer operation with timeout
        async with (
            get_checkpoint_db() as checkpointer,
            asyncio.timeout(5.0),
        ):  # 5 second timeout
            # Try to list checkpoints (this tests the connection)
            from langgraph.checkpoint.base import RunnableConfig

            config = RunnableConfig(configurable={"thread_id": "health_check"})

            checkpoint_count = 0
            async for _ in checkpointer.alist(config, limit=1):
                checkpoint_count += 1
                break

            return {
                "status": "healthy",
                "checkpointer_type": type(checkpointer).__name__,
                "test_operation": "list_checkpoints",
                "message": "Checkpointer connection is working",
            }
    except asyncio.TimeoutError:
        logger.error("Checkpointer health check timed out")
        raise HTTPException(
            status_code=503,
            detail="Checkpointer connection timeout - service unavailable",
        )
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Checkpointer health check failed: {error_msg}")

        if "connection" in error_msg.lower() and "closed" in error_msg.lower():
            raise HTTPException(
                status_code=503,
                detail="Checkpointer connection is closed - service unavailable",
            )

        raise HTTPException(status_code=500, detail=f"Checkpointer health check failed: {error_msg}")
