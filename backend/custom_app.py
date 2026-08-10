"""Orchestra's Aegra custom application.

Only app-specific routes live here.  Agent Protocol routes remain registered by
``aegra_api.main`` at the root; this app owns the ``/api`` namespace and MCP.
There is intentionally no SPA catch-all, so ``POST /threads/search`` and the
other protocol methods cannot be answered with frontend HTML.
"""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from pathlib import Path
from time import perf_counter
from typing import Any, Callable

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastmcp import FastMCP
from fastmcp.server.openapi import MCPType, RouteMap
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from src.constants import APP_TITLE, APP_VERSION
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
from src.utils.logger import logger
from src.utils.rate_limit import limiter


# This app is deliberately separate from the Aegra root application.  Keeping
# the route inventory explicit makes it impossible to accidentally mount the
# old graph/thread/scheduler routers under /api during the cutover.
api_app = FastAPI(title=APP_TITLE, version=APP_VERSION)
for _router in (
    auth,
    info,
    llm_utils,
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
    deferred,
):
    api_app.include_router(_router, prefix="/api")


_mcp_route_maps = [
    RouteMap(tags={"mcp"}, mcp_type=MCPType.TOOL),
    RouteMap(mcp_type=MCPType.EXCLUDE),
]
mcp = FastMCP.from_fastapi(
    app=api_app,
    name=APP_TITLE,
    route_maps=_mcp_route_maps,
)
mcp_app = mcp.http_app(path="/mcp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Share Aegra's store and nested MCP lifespan with custom routes."""
    # Aegra's core lifespan wraps this lifespan, so its database manager and
    # store are initialized before this lookup.  Both app objects are needed:
    # routes are spliced by reference and FastAPI dependency resolution keeps
    # api_app as the dependency-overrides provider.
    from aegra_api.core.database import db_manager

    store = db_manager.get_store()
    app.state.store = store
    api_app.state.store = store
    app.state.aegra_store = store
    app.state.aegra_db = db_manager

    async with mcp_app.lifespan(app):
        yield


async def _log_requests(request: Request, call_next: Callable[[Request], Any]) -> Response:
    start = perf_counter()
    response = await call_next(request)
    logger.info(
        json.dumps(
            {
                "request": {
                    "method": request.method,
                    "path": request.url.path,
                    "duration": f"{perf_counter() - start:.2f}s",
                    "status_code": response.status_code,
                }
            }
        )
    )
    return response


# Static assets are explicit, non-protocol paths.  Do not add the legacy
# `/{filename:path}` SPA fallback here: Aegra appends Agent Protocol routers to
# this application after loading the custom app, and a catch-all would turn
# protocol GETs into HTML.  The `/chat` route is enough for the production SPA
# entry point; asset directories remain directly mounted.
_STATIC_ROOT = Path(__file__).resolve().parent / "src" / "public"
static_app = FastAPI()
for _directory in ("assets", "icons", "embed"):
    _static_directory = _STATIC_ROOT / _directory
    if _static_directory.is_dir():
        static_app.mount(
            f"/{_directory}",
            StaticFiles(directory=_static_directory),
            name=f"static-{_directory}",
        )


async def _serve_spa(path: str = "") -> FileResponse:
    """Serve the built SPA only on explicit frontend paths."""

    index = _STATIC_ROOT / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=404, detail="Frontend assets are not installed")
    requested = (_STATIC_ROOT / path).resolve()
    if path and requested.is_relative_to(_STATIC_ROOT) and requested.is_file():
        return FileResponse(requested)
    return FileResponse(index)


@static_app.get("/chat", include_in_schema=False)
@static_app.get("/chat/{path:path}", include_in_schema=False)
async def serve_chat(path: str = "") -> FileResponse:
    return await _serve_spa(path)


for _asset_name in ("favicon.ico", "manifest.json", "manifest.webmanifest", "robots.txt", "sw.js"):

    @static_app.get(f"/{_asset_name}", include_in_schema=False)
    async def serve_root_asset(asset_name: str = _asset_name) -> FileResponse:
        asset = _STATIC_ROOT / asset_name
        if not asset.is_file():
            raise HTTPException(status_code=404, detail="Frontend asset is not installed")
        return FileResponse(asset)


# Put MCP before custom API routes and explicit static routes after them.  Aegra's
# core app later appends root protocol routes; because static routes are explicit
# and non-overlapping, neither they nor `/api` can shadow Agent Protocol methods.
app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description="Orchestra custom API mounted alongside Aegra Agent Protocol routes.",
    lifespan=lifespan,
    routes=[*mcp_app.routes, *api_app.routes, *static_app.routes],
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.middleware("http")(_log_requests)

# Aegra also installs its configured CORS middleware on the merged app.  This
# local middleware keeps the custom app usable in isolation and is harmless
# when Aegra wraps it with the same policy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Location", "Location"],
)


__all__ = ["api_app", "app", "lifespan", "mcp", "mcp_app"]
