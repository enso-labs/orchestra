import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from src.constants import LANGCONNECT_SERVER_URL

from .llm import llm_router as llm
from .thread import router as thread
from .tool import router as tool
from .health import router as health
from .auth import router as auth
from .token import router as token
from .storage import router as storage
from .assistant import router as assistant
from .schedule import router as schedule
from .prompt import router as prompt
from .project import router as project

__all__ = [
    "llm",
    "thread",
    "tool",
    "health",
    "auth",
    "token",
    "storage",
    "assistant",
    "schedule",
    "prompt",
    "project",
]

def add_api_routes(app: FastAPI, prefix: str = "/api"):
    app.include_router(auth, prefix=prefix)
    app.include_router(health, prefix=prefix)
    app.include_router(llm, prefix=prefix)
    app.include_router(thread, prefix=prefix)
    app.include_router(assistant, prefix=prefix)
    app.include_router(tool, prefix=prefix)
    app.include_router(project, prefix=prefix)
    app.include_router(prompt, prefix=prefix)
    app.include_router(schedule, prefix=prefix)
    if LANGCONNECT_SERVER_URL:
        app.include_router(rag, prefix=prefix)
    app.include_router(storage, prefix=prefix)
    
def add_mounts(app: FastAPI):
    app.mount("/docs", StaticFiles(directory="src/public/docs", html=True), name="docs")
    app.mount("/assets", StaticFiles(directory="src/public/assets"), name="assets")
    if os.path.exists("src/public/icons"):
        app.mount("/icons", StaticFiles(directory="src/public/icons"), name="icons")
    

if LANGCONNECT_SERVER_URL:
    from .rag import gateway as rag
    __all__.append("rag")
