from enum import Enum
from uuid import uuid4
from typing import Optional, List, Any

from pydantic import BaseModel, Field

from src.schemas.entities.llm import *
from src.constants.examples import (
    ADD_DOCUMENTS_EXAMPLE,
    THREAD_HISTORY_EXAMPLE,
    NEW_THREAD_ANSWER_EXAMPLE,
    EXISTING_THREAD_ANSWER_EXAMPLE,
)


class InvokeTool(BaseModel):
    name: str = Field(description="The name of the tool to invoke")
    args: dict = Field(description="The arguments to pass to the tool")
    result: Optional[Any] = Field(
        default=None, description="The result of the tool invocation"
    )


class ArcadeConfig(BaseModel):
    tools: Optional[List[str]] = Field(default_factory=list)
    toolkits: Optional[List[str]] = Field(default_factory=list)

    model_config = {
        "json_schema_extra": {
            "example": {"tools": ["Web.ScrapeUrl"], "toolkits": ["Google"]}
        }
    }


class Thread(BaseModel):
    thread_id: str = Field(...)
    checkpoint_ns: Optional[str] = Field(default="")
    checkpoint_id: Optional[str] = Field(default=None)
    messages: list[BaseMessage] = Field(default_factory=list)
    v: Optional[int] = Field(default=1)
    ts: Optional[str] = Field(default=None)

    model_config = {
        "json_schema_extra": {"examples": {"thread_history": THREAD_HISTORY_EXAMPLE}}
    }


class Threads(BaseModel):
    threads: list[Thread] = Field(default_factory=list)

    model_config = {
        "json_schema_extra": {
            "examples": {"threads": [THREAD_HISTORY_EXAMPLE, THREAD_HISTORY_EXAMPLE]}
        }
    }


class Answer(BaseModel):
    thread_id: str = Field(...)
    answer: BaseMessage = Field(...)

    model_config = {
        "json_schema_extra": {
            "examples": {
                "new_thread": NEW_THREAD_ANSWER_EXAMPLE,
                "existing_thread": EXISTING_THREAD_ANSWER_EXAMPLE,
            }
        }
    }


class DocIds(BaseModel):
    documents: list[str] = Field(...)

    model_config = {
        "json_schema_extra": {
            "example": {
                "documents": [
                    "317369e3-d061-4a7c-afea-948edea9856b",
                    "84d83f48-b01b-4bf3-b027-765c61772344",
                    "e052d740-b0d4-483c-871a-7a0005d92fdd",
                ]
            }
        }
    }


class Document(BaseModel):
    page_content: str
    metadata: dict = {}

    model_config = {
        "json_schema_extra": {"example": ADD_DOCUMENTS_EXAMPLE["documents"][0]}
    }


class AddDocuments(BaseModel):
    documents: list[Any] = Field(...)

    model_config = {"json_schema_extra": {"example": ADD_DOCUMENTS_EXAMPLE}}


##### Vector Store
class SearchType(str, Enum):
    MMR = "mmr"
    SIMILARITY = "similarity"


class SearchKwargs(dict):
    k: int = 3
    fetch_k: int = 2
    lambda_mult: float = 0.5
    filter: str = None


class ThreadSearch(BaseModel):
    limit: int = Field(default=100, description="The limit of threads to search")
    offset: int = Field(default=0, description="The offset of threads to search")
    filter: Optional[Config] = Field(
        default_factory=Config, description="The filter of threads to search"
    )
    
class SearchFilter(BaseModel):
    query: Optional[str] = Field(default=None, description="The query to search")
    filter: Optional[dict] = Field(default={}, description="The filter of results to search")
    limit: int = Field(default=20, description="The limit of results to search")
    offset: int = Field(default=0, description="The offset of results to search")

    model_config = {
        "json_schema_extra": {
            "example": {
                "query": "test",
                "filter": {},
                "limit": 20,
                "offset": 0
            }
        }
    }