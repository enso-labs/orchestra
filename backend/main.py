from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles 
from fastapi.middleware.cors import CORSMiddleware
import os

from src.constants import (
    HOST,
    PORT,
    LOG_LEVEL,
    APP_VERSION
)
from src.routes import auth_app, app_v0, app_v1
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
    run_migrations()
    yield
    # Shutdown
    pass

# Create the main app with no routes
app = FastAPI(
    title="Enso - Be Preset",
    version=APP_VERSION,
    description=(
        "This is a simple API for building chatbots with LangGraph. " 
        "It allows you to create new threads, query existing threads, "
        "and get the history of a thread.\n Check out the repo on "
        f"<a href='https://github.com/ryaneggz/langgraph-template'>Github</a>"
    ),
    contact={
        "name": "Ryan Eggleston",
        "email": "ryaneggleston@promptengineers.ai"
    },
    debug=True,
    docs_url=None,  # Disable the main app docs
    redoc_url=None,  # Disable the main app redoc
    lifespan=lifespan
)

# Mount the apps to the main app
app.mount("/api/auth", auth_app)
app.mount("/api/v0", app_v0)
app.mount("/api/v1", app_v1)

# Create a redirector for the main docs page
@app.get("/api", include_in_schema=False)
async def api_docs_redirect():
    return FileResponse("src/public/api-selector.html")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directories
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
