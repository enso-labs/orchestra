from src.constants import LANGCONNECT_SERVER_URL

from .llm import llm_router as llm
from .thread import router as thread
from .tool import router as tool
from .info import router as info
from .auth import router as auth
from .token import router as token
from .storage import router as storage
from .assistant import router as assistant

__all__ = [
    "llm",
    "thread",
    "tool",
    "info",
    "auth",
    "token",
    "storage",
    "assistant",
]

if LANGCONNECT_SERVER_URL:
    from .rag import gateway as rag

    __all__.append("rag")
