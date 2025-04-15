from enum import Enum
from typing import Optional, List, Any

from pydantic import BaseModel, Field
from langchain_core.messages import AnyMessage

from src.entities.a2a import A2AServer
from src.constants.llm import ModelName
from src.constants.examples import (
    ADD_DOCUMENTS_EXAMPLE,
    # LIST_DOCUMENTS_EXAMPLE,
    THREAD_HISTORY_EXAMPLE,
    NEW_THREAD_ANSWER_EXAMPLE,
    EXISTING_THREAD_ANSWER_EXAMPLE,
    EXISTING_THREAD_QUERY_EXAMPLE,
    NEW_THREAD_QUERY_EXAMPLE
)


class Configurable(BaseModel):
    thread_id: str

class StreamInput(BaseModel):
    messages: list
    configurable: Configurable
    
class ChatInput(BaseModel):
    system: Optional[str] = Field(default="You are a helpful assistant.")
    query: str = Field(default="What is the capital of France?")
    images: Optional[List[str]] = Field(default=[])
    model: Optional[str] = Field(default="openai:gpt-4o-mini")
    
class ExistingThread(ChatInput):
    tools: Optional[List[Any]] = Field(default_factory=list)
    mcp: Optional[dict] = Field(default_factory=dict)
    a2a: Optional[A2AServer] = Field(default_factory=dict)
    images: Optional[List[str]] = Field(default_factory=list)
    model: Optional[str] = Field(default=ModelName.ANTHROPIC_CLAUDE_3_5_SONNET)
    
    model_config = {
        "json_schema_extra": {"example": EXISTING_THREAD_QUERY_EXAMPLE}
    }
    
    
class AgentThread(BaseModel):
    query: str
    # model: Optional[str] = None
    
    model_config = {
        "json_schema_extra": {"example": {"query": "What is the capital of France?"}}
    }
    
class NewThread(ExistingThread):
    system: Optional[str] = Field(default="You are a helpful assistant.")
    visualize: Optional[bool] = Field(default=False)
    
    model_config = {
        "json_schema_extra": {"example": NEW_THREAD_QUERY_EXAMPLE}
    }
        
class Thread(BaseModel):
    thread_id: str = Field(...)
    checkpoint_ns: Optional[str] = Field(default='')
    checkpoint_id: Optional[str] = Field(default=None)
    messages: list[AnyMessage] = Field(default_factory=list)
    v: Optional[int] = Field(default=1)
    ts: Optional[str] = Field(default=None)
    
    model_config = {
        "json_schema_extra": {
            "examples": {
                "thread_history": THREAD_HISTORY_EXAMPLE
            }
        }
    }
    
class Threads(BaseModel):
    threads: list[Thread] = Field(default_factory=list)
    
    model_config = {
        "json_schema_extra": {
            "examples": {
                "threads": [THREAD_HISTORY_EXAMPLE, THREAD_HISTORY_EXAMPLE]
            }
        }
    }
    
class Answer(BaseModel):
    thread_id: str = Field(...)
    answer: AnyMessage = Field(...)
    
    model_config = {
        "json_schema_extra": {
            "examples": {
                'new_thread': NEW_THREAD_ANSWER_EXAMPLE,
                'existing_thread': EXISTING_THREAD_ANSWER_EXAMPLE,
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
                    "e052d740-b0d4-483c-871a-7a0005d92fdd"
                ]
            }
        }
    }
        
class Document(BaseModel):
    page_content: str
    metadata: dict = {}
    
    model_config = {
        "json_schema_extra": {"example": ADD_DOCUMENTS_EXAMPLE['documents'][0]}
    }
        
class AddDocuments(BaseModel):
    documents: list[Any] = Field(...)
    
    model_config = {
        "json_schema_extra": {"example": ADD_DOCUMENTS_EXAMPLE}
    }

    
##### Vector Store
class SearchType(str, Enum):
    MMR = "mmr"
    SIMILARITY = "similarity"

class SearchKwargs(dict):
    k: int = 3
    fetch_k: int = 2
    lambda_mult: float = 0.5
    filter: str = None