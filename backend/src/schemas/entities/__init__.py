from enum import Enum
from uuid import uuid4
from typing import Optional, List, Any, Literal

from pydantic import BaseModel, Field, ConfigDict
from langgraph.types import StreamMode
from langchain_core.messages import (
    AnyMessage,
    BaseMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
)

from src.schemas.models.assistant import Assistant
from src.constants.llm import ChatModels
from src.constants.examples import (
    ADD_DOCUMENTS_EXAMPLE,
    THREAD_HISTORY_EXAMPLE,
    NEW_THREAD_ANSWER_EXAMPLE,
    EXISTING_THREAD_ANSWER_EXAMPLE,
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
    messages: list[AnyMessage] = Field(default_factory=list)
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
    answer: AnyMessage = Field(...)

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


class StreamContext(BaseModel):
    msg: AnyMessage | None = None
    metadata: dict = {}
    event: str = ""


class Config(BaseModel):
    model_config = ConfigDict(extra="allow")  # ✅ allow arbitrary extra fields

    user_id: Optional[str] = Field(
        default=None, description="The user id", examples=[str(uuid4())]
    )
    thread_id: Optional[str] = Field(
        default=None, description="The thread id", examples=[str(uuid4())]
    )
    checkpoint_id: Optional[str] = Field(
        default=None, description="The checkpoint id", examples=[str(uuid4())]
    )
    assistant_id: Optional[str] = Field(
        default=None, description="The assistant id", examples=[str(uuid4())]
    )
    graph_id: Optional[Literal["react", "deepagent"]] = Field(
        default=None, description="The graph id", examples=["react", "deepagent"]
    )


class ThreadSearch(BaseModel):
    limit: int = Field(default=100, description="The limit of threads to search")
    offset: int = Field(default=0, description="The offset of threads to search")
    filter: Optional[Config] = Field(
        default_factory=Config, description="The filter of threads to search"
    )


class LLMRequest(BaseModel):
    model: Optional[ChatModels] = Field(default=ChatModels.OPENAI_GPT_5_NANO.value)
    system: Optional[str] = Field(default="You are a helpful assistant.")
    tools: Optional[List[str]] = Field(default_factory=list)
    a2a: Optional[dict[str, dict]] = Field(default_factory=dict)
    mcp: Optional[dict[str, dict]] = Field(default_factory=dict)
    subagents: Optional[List[Assistant]] = Field(default_factory=list)

    metadata: Optional[Config] = Field(
        default={}, description="LangGraph configuration"
    )

    class ChatMessage(BaseModel):
        role: Literal["user", "assistant", "system", "tool"] = Field(examples=["user"])
        content: str | List[Any] = Field(examples=["Weather in Dallas?"])

    messages: List[ChatMessage]

    def to_langchain_messages(self) -> List[BaseMessage]:
        # Convert API messages to LangChain message objects
        converted: List[BaseMessage] = []
        for message in self.messages:
            role = message.role
            content = message.content
            if role == "user":
                converted.append(HumanMessage(content=content))
            elif role == "assistant":
                converted.append(AIMessage(content=content))
            elif role == "system":
                converted.append(SystemMessage(content=content))
            elif role == "tool":
                converted.append(ToolMessage(content=content))
            else:
                raise ValueError(f"Unsupported role: {role}")
        return converted


class LLMStreamRequest(LLMRequest):
    stream_mode: StreamMode | list[StreamMode] = "values"
