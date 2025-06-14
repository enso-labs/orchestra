import os
import json
from typing import Callable
from time import perf_counter
from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles 
from fastapi.middleware.cors import CORSMiddleware
from src.utils.logger import logger

from src.routes.v0 import (
    tool, llm, thread, retrieve, source, info, 
    auth, token, storage, settings, agent, model, server, rag
)
from src.constants import (
    HOST,
    LANGCONNECT_SERVER_URL,
    PORT,
    LOG_LEVEL,
    APP_VERSION,
    APP_ENV
)
from src.utils.migrations import run_migrations

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting up...")
    print(f"Environment Settings:")
    print(f"APP_VERSION: {APP_VERSION}")
    print(f"LOG_LEVEL: {LOG_LEVEL}")
    print(f"HOST: {HOST}")
    print(f"PORT: {PORT}")
    print(f"APP_ENV: {APP_ENV}")
    if APP_ENV == "production" or APP_ENV == "staging":
        run_migrations()
    yield
    # Shutdown
    pass

app = FastAPI(
    title="Enso 🤖",
    version=APP_VERSION,
    description=(
        "This is a simple API for building chatbots with LangGraph. " 
        "It allows you to create new threads, query existing threads, "
        "and get the history of a thread.\n Check out the repo on "
        f"<a href='https://github.com/enso-labs/cloud'>Github</a>"
    ),
    contact={
        "name": "Ryan Eggleston",
        "email": "ryaneggleston@promptengineers.ai"
    },
    debug=True,
    docs_url="/api",
    lifespan=lifespan
)
@app.middleware("http")
async def log_requests(request: Request, call_next: Callable[[Request], Response]):
    start = perf_counter()
    response = await call_next(request)
    duration = perf_counter() - start
    
    # Log detailed request information
    logger.info(
        json.dumps({
            "request": {
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "client_host": request.client.host if request.client else "Unknown",
                "duration": f"{duration:.2f}s",
                "status_code": response.status_code
            }
        })
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

# Include routers
PREFIX = "/api"
app.include_router(auth, prefix=PREFIX)
app.include_router(info, prefix=PREFIX)
app.include_router(token, prefix=PREFIX)
app.include_router(llm, prefix=PREFIX)
app.include_router(thread, prefix=PREFIX)
app.include_router(tool, prefix=PREFIX)
app.include_router(model, prefix=PREFIX)
app.include_router(settings, prefix=PREFIX)
app.include_router(agent, prefix=PREFIX)
if LANGCONNECT_SERVER_URL:
    app.include_router(rag, prefix=PREFIX)
# app.include_router(retrieve, prefix=PREFIX)
app.include_router(source, prefix=PREFIX)
app.include_router(storage, prefix=PREFIX)
app.include_router(server, prefix=PREFIX)
# Mount specific directories only if they exist
app.mount("/docs", StaticFiles(directory="src/public/docs", html=True), name="docs")
app.mount("/assets", StaticFiles(directory="src/public/assets"), name="assets")

# Check if icons directory exists before mounting
if os.path.exists("src/public/icons"):
    app.mount("/icons", StaticFiles(directory="src/public/icons"), name="icons")

# Function to serve static files with fallback
@app.get("/{filename:path}", include_in_schema=False)
async def serve_static_or_index(filename: str, request: Request):
    # List of static files to check for at the root
    static_files = ["manifest.json", "sw.js", "favicon.ico", "robots.txt", "manifest.webmanifest"]
    
    # If the request is for a known static file and it exists, serve it
    if filename in static_files and os.path.exists(f"src/public/{filename}"):
        return FileResponse(f"src/public/{filename}")
    
    # For /icons/* paths, check if the file exists
    if filename.startswith("icons/") and os.path.exists(f"src/public/{filename}"):
        return FileResponse(f"src/public/{filename}")
    
    # For all other routes, serve the index.html for SPA routing
    return FileResponse("src/public/index.html")

### Run Server
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host=HOST,
        port=PORT, 
        log_level=LOG_LEVEL
    )
