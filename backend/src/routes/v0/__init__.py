"""Compatibility router factory for the pre-Aegra import surface.

Production imports :mod:`custom_app`, which mounts the same surviving custom
routes alongside Aegra's root Agent Protocol routes.  This module intentionally
contains no interactive graph, schedule, or background-runtime imports.
"""

from __future__ import annotations

from fastapi import FastAPI

from src.constants import LANGCONNECT_SERVER_URL


def create_api_router(app: FastAPI, prefix: str = "/api") -> FastAPI:
    """Mount only retained custom API routes on *app*.

    The explicit inventory is also used by compatibility tests and prevents a
    deleted runtime module from re-entering through an eager package import.
    """

    from src.routes.custom_llm import router as llm_utils
    from src.routes.deferred import router as deferred
    from src.routes.v0.api_tokens import router as api_tokens
    from src.routes.v0.assistant import router as assistant
    from src.routes.v0.auth import router as auth
    from src.routes.v0.config import router as config
    from src.routes.v0.info import router as info
    from src.routes.v0.memory import router as memory
    from src.routes.v0.project import router as project
    from src.routes.v0.prompt import router as prompt
    from src.routes.v0.settings import router as settings
    from src.routes.v0.share import router as share
    from src.routes.v0.storage import router as storage
    from src.routes.v0.tool import router as tool

    for router in (
        auth,
        info,
        llm_utils,
        deferred,
        tool,
        assistant,
        prompt,
        project,
        storage,
        api_tokens,
        share,
        settings,
        memory,
        config,
    ):
        app.include_router(router, prefix=prefix)

    if LANGCONNECT_SERVER_URL:
        from src.routes.v0.rag import gateway as rag

        app.include_router(rag, prefix=prefix)

    return app


def mount_static_router(app: FastAPI) -> FastAPI:
    """Keep the old helper importable without adding a protocol catch-all."""

    return app


__all__ = ["create_api_router", "mount_static_router"]
