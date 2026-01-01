from uuid import uuid4
from datetime import datetime
from typing import Dict, List, Any, Literal, Optional
from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    computed_field,
    field_serializer,
    model_validator,
)
from langchain_core.messages import (
    BaseMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
)
from src.constants.llm import DEFAULT_CHAT_MODEL, DEFAULT_SYSTEM_PROMPT
from src.utils.format import slugify


class PresidioRequest(BaseModel):
    analyze: Optional[bool] = Field(
        default=False, description="Whether to analyze the text"
    )
    anonymize: Optional[bool] = Field(
        default=False, description="Whether to anonymize the text"
    )


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
    project_id: Optional[str] = Field(
        default=None, description="The project id", examples=[str(uuid4())]
    )
    graph_id: Optional[Literal["react", "deepagent"]] = Field(
        default=None, description="The graph id", examples=["react", "deepagent"]
    )


class LLMInput(BaseModel):
    model_config = ConfigDict(extra="allow")  # Allow additional properties

    class ChatMessage(BaseModel):
        role: Literal["user", "assistant", "system", "tool"] = Field(examples=["user"])
        content: str | List[Any] = Field(examples=["Weather in Dallas?"])

    messages: List[ChatMessage]
    files: Optional[Dict[str, Any]] = Field(default=None)

    def to_langchain_messages(self) -> "LLMInput":
        # Convert API messages to LangChain message objects
        converted: List[BaseMessage] = []
        for message in self.messages:
            role = message.role
            content = message.content
            if role == "user":
                converted.append(HumanMessage(content=content, role=role))
            elif role == "assistant":
                converted.append(AIMessage(content=content, role=role))
            elif role == "system":
                converted.append(SystemMessage(content=content))
            elif role == "tool":
                converted.append(ToolMessage(content=content))
            else:
                raise ValueError(f"Unsupported role: {role}")
        self.messages = converted


class AssistantSearch(BaseModel):
    limit: int = 200
    offset: int = 0
    sort: str = "updated_at"
    sort_order: str = "desc"
    filter: dict = {}


class Assistant(BaseModel):
    id: Optional[str] = None
    name: str
    description: str = Field(default="Helpful AI Assistant.")
    model: Optional[str] = None
    system_prompt: Optional[str] = Field(
        default=None, examples=["You are a helpful assistant."]
    )
    instructions: Optional[str] = Field(
        default=None, examples=["Your role is to help the user with their task."]
    )

    @model_validator(mode="after")
    def validate_system_prompt_or_instructions(self):
        if self.system_prompt and self.instructions:
            raise ValueError(
                "Only one of system_prompt or instructions may be set, not both."
            )
        return self

    tools: list[str]
    subagents: Optional[list[dict]] = []
    mcp: Optional[dict] = {}
    a2a: Optional[dict] = {}
    metadata: dict = {}
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @computed_field
    @property
    def slug(self) -> str:
        return slugify(self.name)

    @field_serializer("created_at", "updated_at")
    def serialize_dt(self, dt: Optional[datetime], _):
        return dt.isoformat() if dt else None

    def to_llm_request(
        self,
        input: LLMInput,
        model: str = None,
        metadata: "Config" = None,
    ) -> "LLMRequest":
        from src.schemas.entities import Config
        from src.schemas.entities import LLMRequest

        if metadata and isinstance(metadata, Config):
            metadata = metadata.model_dump()
        return LLMRequest(
            model=model or self.model,
            tools=self.tools,
            a2a=self.a2a,
            mcp=self.mcp,
            system_prompt=self.system_prompt,
            instructions=self.instructions,
            subagents=self.subagents,
            metadata=metadata or self.metadata,
            input=input,
        )


class LLMRequest(BaseModel):
    input: LLMInput
    model: Optional[str] = Field(default=DEFAULT_CHAT_MODEL)
    system_prompt: Optional[str] = Field(default=DEFAULT_SYSTEM_PROMPT, exclude=True)
    instructions: Optional[str] = Field(default="", exclude=True)
    tools: Optional[List[Any]] = Field(default_factory=list)
    a2a: Optional[dict[str, dict]] = Field(default_factory=dict)
    mcp: Optional[dict[str, dict]] = Field(default_factory=dict)
    subagents: Optional[List[Assistant]] = Field(default_factory=list)
    presidio: Optional[PresidioRequest] = Field(default_factory=PresidioRequest)
    metadata: Optional[Config] = Field(
        default_factory=Config, description="LangGraph configuration"
    )

    @model_validator(mode="before")
    @classmethod
    def coerce_metadata(cls, values):
        """Ensure metadata is always a Config model, not a plain dict."""
        if isinstance(values, dict) and "metadata" in values:
            meta = values.get("metadata")
            if meta is None or meta == {}:
                values["metadata"] = Config()
            elif isinstance(meta, dict):
                values["metadata"] = Config(**meta)
        return values
