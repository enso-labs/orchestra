import json
from typing import Callable
from time import perf_counter
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
from fastmcp import FastMCP
from fastmcp.server.openapi import RouteMap, MCPType

load_dotenv()

from src.routes.v0 import create_api_router, mount_static_router
from src.utils.logger import logger
from src.services.db import (
    get_checkpoint_db,
    get_store_db,
)
from src.constants import (
    HOST,
    PORT,
    LOG_LEVEL,
    APP_VERSION,
    APP_ENV,
    APP_TITLE,
)
from src.utils.migrations import run_migrations
from src.utils.rate_limit import limiter
from src.services.cron import cron_service
from src.utils.cache import init_cache
from contextlib import asynccontextmanager


# Create base API app (without lifespan - will be added to combined app)
api_app = FastAPI()

# Include routers
api_app = create_api_router(api_app)
# Mount specific directories only if they exist
api_app = mount_static_router(api_app)

# Generate MCP server from FastAPI app for LLM-friendly API
mcp_ignore_routes = [
    # ✅ allow-list: anything tagged "mcp" gets included
    RouteMap(
        tags={"mcp"},
        mcp_type=MCPType.TOOL,  # or RESOURCE / RESOURCE_TEMPLATE if you want semantics
    ),
    # ❌ deny-list fallback: exclude everything else
    RouteMap(mcp_type=MCPType.EXCLUDE),
]
mcp = FastMCP.from_fastapi(app=api_app, name=APP_TITLE, route_maps=mcp_ignore_routes)
mcp_app = mcp.http_app(path="/mcp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting up...")
    print("Environment Settings:")
    print(f"APP_VERSION: {APP_VERSION}")
    print(f"LOG_LEVEL: {LOG_LEVEL}")
    print(f"HOST: {HOST}")
    print(f"PORT: {PORT}")
    print(f"APP_ENV: {APP_ENV}")
    if APP_ENV == "production" or APP_ENV == "staging":
        run_migrations()

    cron_service.scheduler.start()

    # Initialize cache
    init_cache()

    # Enter the async context managers to get live instances
    async with (
        get_checkpoint_db() as saver,
        get_store_db() as store,
    ):
        # optional: create tables/indexes
        await saver.setup()
        await store.setup()

        # share across requests
        app.state.store = store
        # Also set on api_app for MCP internal calls (ASGITransport uses api_app)
        api_app.state.store = store

        # Run MCP lifespan within our lifespan
        async with mcp_app.lifespan(app):
            # serve requests
            yield


# Create combined app with both REST and MCP routes
app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description=(
        "This is a simple API for building chatbots with LangGraph. "
        "It allows you to create new threads, query existing threads, "
        "and get the history of a thread.\n Check out the repo on "
        "<a href='https://github.com/ruska-ai/orchestra'>Github</a>"
    ),
    contact={"name": "Ryan Eggleston", "email": "reggleston@ruska.ai"},
    debug=True,
    docs_url="/api",
    lifespan=lifespan,
    swagger_ui_parameters={"docExpansion": "none"},
    routes=[
        *mcp_app.routes,  # MCP routes at /mcp
        *api_app.routes,  # Original API routes
    ],
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def log_requests(request: Request, call_next: Callable[[Request], Response]):
    start = perf_counter()
    response = await call_next(request)
    duration = perf_counter() - start

    # Log detailed request information
    logger.info(
        json.dumps(
            {
                "request": {
                    "method": request.method,
                    "path": request.url.path,
                    "query_params": dict(request.query_params),
                    "client_host": request.client.host if request.client else "Unknown",
                    "duration": f"{duration:.2f}s",
                    "status_code": response.status_code,
                }
            }
        )
    )
    return response


# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

### Run Server
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=HOST,
        port=PORT,
        log_level=LOG_LEVEL,
        timeout_graceful_shutdown=1,  # Force close SSE connections quickly on shutdown
    )
