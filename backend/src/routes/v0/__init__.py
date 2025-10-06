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
]

if LANGCONNECT_SERVER_URL:
    from .rag import gateway as rag

    __all__.append("rag")
