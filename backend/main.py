from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles 
from fastapi.middleware.cors import CORSMiddleware

from src.routes.v0 import tool, llm, thread, retrieve, source, info, auth, token, storage
from src.constants import (
    HOST,
    PORT,
    LOG_LEVEL,
    APP_VERSION
)
from src.utils.migrations import run_migrations

app = FastAPI(
    title="Thread Agent by Prompt Engineers AI 🤖",
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
    docs_url="/api"
)

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

app = FastAPI(
    title="Thread Agent by Prompt Engineers AI 🤖",
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
    docs_url="/api",
    lifespan=lifespan
)


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
app.include_router(auth)
app.include_router(info, prefix=PREFIX)
app.include_router(llm, prefix=PREFIX)
app.include_router(thread, prefix=PREFIX)
app.include_router(tool, prefix=PREFIX)
app.include_router(retrieve, prefix=PREFIX)
app.include_router(source, prefix=PREFIX)
app.include_router(token, prefix=PREFIX)
app.include_router(storage, prefix=PREFIX)


app.mount("/docs", StaticFiles(directory="src/public/docs", html=True), name="docs")
app.mount("/assets", StaticFiles(directory="src/public/assets"), name="assets")

@app.get("/{full_path:path}", include_in_schema=False)
async def serve_index(request: Request, full_path: str):
    print(f"Received request for {request.url}")
    return FileResponse(f"src/public/index.html")

### Run Server
if __name__ == "__main__":
    import uvicorn
    
    print(f"Environment Settings:")
    print(f"APP_VERSION: {APP_VERSION}")
    print(f"LOG_LEVEL: {LOG_LEVEL}")
    
    uvicorn.run(
        app,
        host=HOST,
        port=PORT, 
        log_level=LOG_LEVEL
    )
