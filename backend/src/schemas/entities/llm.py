from uuid import uuid4
from datetime import datetime
from typing import Dict, List, Any, Literal, Optional
from pathlib import PurePosixPath
from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    computed_field,
    field_serializer,
    field_validator,
    model_validator,
)
from langchain_core.messages import (
    BaseMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
)
from src.services.prompt.defaults import get_default_system_prompt
from src.utils.format import slugify


class Config(BaseModel):
    model_config = ConfigDict(extra="allow")  # ✅ allow arbitrary extra fields

    user_id: Optional[str] = Field(default=None, description="The user id", examples=[str(uuid4())])
    thread_id: Optional[str] = Field(default=None, description="The thread id", examples=[str(uuid4())])
    run_id: Optional[str] = Field(default=None, description="The run id", examples=[str(uuid4())])
    checkpoint_id: Optional[str] = Field(default=None, description="The checkpoint id", examples=[str(uuid4())])
    assistant_id: Optional[str] = Field(default=None, description="The assistant id", examples=[str(uuid4())])
    project_id: Optional[str] = Field(default=None, description="The project id", examples=[str(uuid4())])
    graph_id: Optional[Literal["react", "deepagent"]] = Field(
        default=None, description="The graph id", examples=["react", "deepagent"]
    )


class LLMInput(BaseModel):
    model_config = ConfigDict(extra="allow")  # Allow additional properties

    class ChatMessage(BaseModel):
        role: Literal["user", "assistant", "system", "tool"] = Field(examples=["user"])
        content: str | List[Any] = Field(examples=["Weather in Dallas?"])

    messages: List[ChatMessage]
    files: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @field_validator("files", mode="before")
    @classmethod
    def ensure_files_not_none(cls, v):
        """Ensure files is never None - deepagents reducer requires a dict."""
        return v if v is not None else {}

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
    system_prompt: Optional[str] = Field(default=None, examples=["You are a helpful assistant."])

    @field_validator("model", mode="before")
    @classmethod
    def coerce_empty_model_to_none(cls, v):
        """Coerce empty and whitespace-only model strings to None."""
        if isinstance(v, str) and not v.strip():
            return None
        return v

    instructions: Optional[str] = Field(default=None, examples=["Your role is to help the user with their task."])

    @model_validator(mode="after")
    def validate_system_prompt_or_instructions(self):
        if self.system_prompt and self.instructions:
            raise ValueError("Only one of system_prompt or instructions may be set, not both.")
        return self

    tools: list[str]
    subagents: Optional[list[dict]] = []
    mcp: Optional[dict] = {}
    a2a: Optional[dict] = {}
    files: Optional[Dict[str, str]] = Field(
        default_factory=dict,
        description="File system storage for the assistant. Key is the file path, value is the file content.",
    )
    metadata: dict = {}
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    # Public agent fields
    public: bool = Field(default=False, description="Whether the assistant is publicly accessible")
    owner_id: Optional[str] = Field(default=None, description="The user ID of the assistant owner")
    published_at: Optional[datetime] = Field(default=None, description="When the assistant was made public")
    fork_count: int = Field(default=0, description="Number of times this assistant has been forked/remixed")
    tags: list[str] = Field(default_factory=list, description="Category tags for discovery and filtering")

    @computed_field
    @property
    def slug(self) -> str:
        return slugify(self.name)

    @field_serializer("created_at", "updated_at", "published_at")
    def serialize_dt(self, dt: Optional[datetime], _):
        return dt.isoformat() if dt else None

    def to_llm_request(
        self,
        input: LLMInput,
        model: str = None,
        metadata: "Config" = None,
        reasoning_effort: str = None,
    ) -> "LLMRequest":
        from src.schemas.entities import Config
        from src.schemas.entities import LLMRequest

        if metadata and isinstance(metadata, Config):
            metadata = metadata.model_dump()
        return LLMRequest(
            model=model or self.model,
            reasoning_effort=reasoning_effort,
            tools=self.tools,
            a2a=self.a2a,
            mcp=self.mcp,
            system_prompt=self.system_prompt,
            instructions=self.instructions,
            subagents=self.subagents,
            metadata=metadata or self.metadata,
            input=input,
        )


class PublicAssistant(BaseModel):
    """Safe projection of Assistant for public access - excludes sensitive configuration."""

    id: str
    name: str
    description: str
    slug: str
    model: Optional[str] = None
    owner_id: Optional[str] = None
    published_at: Optional[datetime] = None
    fork_count: int = 0
    tags: list[str] = Field(default_factory=list, description="Category tags for discovery and filtering")
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    # NOTE: files is intentionally excluded - it's owner-only data

    @classmethod
    def from_assistant(cls, assistant: Assistant) -> "PublicAssistant":
        """Create PublicAssistant from full Assistant, stripping sensitive fields."""
        return cls(
            id=assistant.id,
            name=assistant.name,
            description=assistant.description,
            slug=assistant.slug,
            model=assistant.model,
            owner_id=assistant.owner_id,
            published_at=assistant.published_at,
            fork_count=assistant.fork_count,
            tags=assistant.tags,
            updated_at=assistant.updated_at,
            created_at=assistant.created_at,
        )

    @field_serializer("created_at", "updated_at", "published_at")
    def serialize_dt(self, dt: Optional[datetime], _):
        return dt.isoformat() if dt else None


class LLMRequest(BaseModel):
    input: LLMInput
    model: Optional[str] = Field(default=None)
    reasoning_effort: Optional[str] = Field(
        default=None,
        description=(
            "How much internal reasoning the model should spend. Accepted values differ per model -- read them "
            "from the `reasoning` map on GET /llm/models. Omit to fall back to the caller's saved default, then "
            "to the provider's own default."
        ),
        examples=["low"],
    )

    @model_validator(mode="after")
    def validate_reasoning_effort(self):
        """Reject an effort the selected model cannot honour.

        Only checked when the request names a model: when ``model`` is omitted
        the server resolves it later from user settings, and an effort that does
        not survive that resolution is dropped rather than rejected.
        """
        if not self.reasoning_effort or not self.model:
            return self

        from src.utils.reasoning import get_reasoning_options

        options = get_reasoning_options(self.model)
        if self.reasoning_effort not in options:
            supported = ", ".join(options) if options else "none"
            raise ValueError(
                f"Model '{self.model}' does not support reasoning_effort "
                f"'{self.reasoning_effort}'. Supported values: {supported}."
            )
        return self

    system_prompt: Optional[str] = Field(default_factory=get_default_system_prompt, exclude=True)
    instructions: Optional[str] = Field(default="", exclude=True)
    tools: Optional[List[Any]] = Field(default_factory=list)
    a2a: Optional[dict[str, dict]] = Field(default_factory=dict)
    mcp: Optional[dict[str, dict]] = Field(default_factory=dict)
    subagents: Optional[List[Assistant]] = Field(default_factory=list)
    metadata: Optional[Config] = Field(default_factory=Config, description="LangGraph configuration")
    # Inference dictation parameters
    generate_files: Optional[bool] = Field(
        default=False,
        description="When True, the LLM will generate file content from the prompt",
    )
    target_file: Optional[str] = Field(
        default=None,
        description="Target file path for generated content",
    )
    file_context: Optional[str] = Field(
        default=None,
        max_length=10000,
        description="Existing file content to provide as context for generation",
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

    @field_validator("target_file")
    @classmethod
    def validate_target_file(cls, v: Optional[str]) -> Optional[str]:
        """Validate target_file path: reject path traversal and normalize."""
        if v is None:
            return v

        # Check for path traversal attempts
        path = PurePosixPath(v)
        for part in path.parts:
            if part == "..":
                raise ValueError("Path traversal is not allowed: '..' segments are forbidden")

        # Normalize the path while preserving leading '/'
        had_leading_slash = v.startswith("/")
        normalized = str(PurePosixPath(v))

        # PurePosixPath removes leading '/' for relative paths, restore if needed
        if had_leading_slash and not normalized.startswith("/"):
            normalized = "/" + normalized

        return normalized
