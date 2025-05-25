from src.constants import LANGCONNECT_SERVER_URL

from .llm import router as llm
from .thread import router as thread
from .tool import router as tool
from .retrieve import router as retrieve
from .source import router as source
from .info import router as info
from .auth import router as auth
from .token import router as token
from .storage import router as storage
from .settings import router as settings
from .agent import router as agent
from .model import router as model
from .server import router as server
if LANGCONNECT_SERVER_URL:
    from .rag import gateway as rag

__all__ = [
    "llm",
    "thread",
    "tool",
    "retrieve",
    "source",
    "info",
    "auth",
    "token",
    "storage",
    "settings",
    "agent",
    "model",
    "server",
]

if LANGCONNECT_SERVER_URL:
    __all__.append("rag")