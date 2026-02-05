# Expert Analysis: Files Map Structure & AGENTS.md Extraction Strategy

## 1. Files Map Structure -- What Formats Can File Values Take?

The files map has **two distinct type signatures** depending on the source, and values can take several concrete formats in practice:

### 1a. Assistant-Level Files (`assistant.files`)

**Pydantic type:** `Optional[Dict[str, str]]` (defined at `/home/ryaneggz/ruska-ai/orchestra/backend/src/schemas/entities/llm.py`, line 115)

```python
files: Optional[Dict[str, str]] = Field(
    default_factory=dict,
    description="File system storage for the assistant. Key is the file path, value is the file content.",
)
```

- **Key format:** File path string (e.g., `"AGENTS.md"`, `"/src/main.py"`)
- **Value format:** Plain string -- the raw file content
- This is the simplest case. The frontend `toBackendFormat()` method in `/home/ryaneggz/ruska-ai/orchestra/frontend/src/hooks/useFileSystem.ts` (line 303) joins content lines back into a single string:

```typescript
const toBackendFormat = useCallback((): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [path, data] of fileSystem) {
        result[path] = data.content.join("\n");
    }
    return result;
}, [fileSystem]);
```

### 1b. Thread-Level Files (`params.input.files` / `LLMInput.files`)

**Pydantic type:** `Optional[Dict[str, Any]]` (defined at `/home/ryaneggz/ruska-ai/orchestra/backend/src/schemas/entities/llm.py`, line 56)

```python
files: Optional[Dict[str, Any]] = Field(default_factory=dict)
```

The `Any` type means thread-level files can hold **multiple value formats**:

| Format | Example | Source |
|--------|---------|--------|
| Plain string | `{"AGENTS.md": "# Instructions\nBe helpful"}` | Backend-sync or simple API calls |
| Dict with content key (content as list) | `{"AGENTS.md": {"content": ["# Instructions", "Be helpful"], "created_at": "...", "modified_at": "...", "source": "__user_files__"}}` | Frontend `FileData` objects via `getFilesForSubmission()` |
| Dict with content key (content as string) | `{"AGENTS.md": {"content": "# Instructions\nBe helpful"}}` | Possible from direct API callers |

**Evidence for dict-with-list format:** The frontend's `useChat.ts` (line 197-199) collects files for submission by flattening the filesMap:

```typescript
const filesToSubmit: Record<string, any> = {};
filesMap.forEach((files) => {
    Object.assign(filesToSubmit, files);
});
```

The `filesMap` entries can contain `FileData` objects where `content` is `string[]` (see `/home/ryaneggz/ruska-ai/orchestra/frontend/src/hooks/useFileSystem.ts`, line 7):

```typescript
export interface FileData {
    content: string[];
    created_at: string;
    modified_at: string;
    source?: string;
}
```

**Key finding:** When the frontend sends thread-level files, user-created files retain their `FileData` structure (dict with `content` as `string[]`). When files come from backend sync, they may be plain strings. Both formats must be handled.

---

## 2. Two Sources of Files -- Agent-Level vs Thread-Level

### 2a. Agent-Level Files (`assistant.files`)

- **Source:** Stored in the LangGraph store (Postgres or in-memory) as part of the `Assistant` entity
- **Loaded by:** `AssistantService.get()` in `/home/ryaneggz/ruska-ai/orchestra/backend/src/services/assistant.py` (line 62-66)
- **Type:** `Dict[str, str]` -- always string values
- **Lifecycle:** Persisted with the assistant; loaded when `LLMService.assistant()` resolves an `assistant_id` from metadata
- **Key flow path:** `LLMService.assistant()` -> `AssistantService.get()` -> `Assistant` model -> `assistant.files` -> `to_llm_request()` -> `LLMRequest`

**Important detail about `to_llm_request()`:** The method at line 143-164 of `llm.py` does NOT forward `assistant.files` into the `LLMRequest`. It only forwards: `model`, `tools`, `a2a`, `mcp`, `system_prompt`, `instructions`, `subagents`, `metadata`, and `input`. The assistant's files are not placed into the request; they remain on the `Assistant` object.

```python
def to_llm_request(self, input: LLMInput, model: str = None, metadata: "Config" = None) -> "LLMRequest":
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
```

This means **AGENTS.md extraction from agent files must happen BEFORE `to_llm_request()` is called** -- specifically in `LLMService.assistant()` at `/home/ryaneggz/ruska-ai/orchestra/backend/src/services/llm.py`, lines 154-163.

### 2b. Thread-Level Files (`params.input.files`)

- **Source:** Sent by the frontend in the request body under `input.files`
- **Type:** `Dict[str, Any]` -- values can be strings, dicts, or other structures
- **Lifecycle:** Per-request; carried in `LLMInput.files` and propagated to `RunnableConfig.configurable.files` via `init_config()` at `/home/ryaneggz/ruska-ai/orchestra/backend/src/agents/__init__.py` (line 183)
- **Key flow path:** HTTP request body -> `LLMRequest.input.files` -> `init_config()` -> `config["configurable"]["files"]` -> `stream_generator()` / `_execute_agent_stream()`

**How thread files reach the runtime:**

```python
# In init_config() at agents/__init__.py line 183:
"files": params.input.files or {},

# In stream_generator() at utils/stream.py line 194:
files_map = config["metadata"].get("files", {}) or input.files or {}

# In _execute_agent_stream() at workers/tasks.py line 98:
files_map = config["configurable"].get("files", {})
```

Note the inconsistency: `stream_generator()` checks `config["metadata"]` for files while `_execute_agent_stream()` checks `config["configurable"]`. The `init_config()` function places files into `configurable`, not `metadata`. This means `stream_generator()` falls through to `input.files` as its backup.

---

## 3. Key Lookup Patterns -- What Key Format to Search For

### Observed key conventions

From the frontend code, file paths use several conventions:

1. **Agent files (backend format):** Keys as produced by `toBackendFormat()` preserve the exact path the user created. The frontend `createFile()` (line 82) takes a raw `path` parameter. In tests (line 557), paths use leading slashes: `"/file1.txt"`, `"/file2.txt"`.

2. **Frontend file panel:** When a user creates a file via the file panel, they type the filename. The exact key depends on user input -- could be `"AGENTS.md"` or `"/AGENTS.md"`.

3. **Agent create form:** Uses `toBackendFormat()` which preserves whatever path the user typed.

### Recommended lookup strategy

Search for AGENTS.md using a **case-insensitive basename match** to be resilient:

```python
AGENTS_MD_KEYS = {"AGENTS.md", "agents.md", "/AGENTS.md", "/agents.md"}
```

Or better, use a normalized lookup function:

```python
import os

def find_agents_md_key(files: dict) -> str | None:
    """Find the AGENTS.md key in a files dict, case-insensitive."""
    if not files:
        return None
    for key in files:
        basename = os.path.basename(key)
        if basename.lower() == "agents.md":
            return key
    return None
```

This handles:
- `"AGENTS.md"` (most common, bare filename)
- `"/AGENTS.md"` (with leading slash)
- `"agents.md"` (lowercase variant)
- `"/path/to/AGENTS.md"` (nested path, unlikely but safe)

### Recommendation

For the initial implementation, keep it simple. The PRD specifies the key `"AGENTS.md"` (exact match). Start with exact match plus case-insensitive fallback:

```python
def find_agents_md_key(files: dict) -> str | None:
    if not files:
        return None
    # Exact match first (fast path)
    if "AGENTS.md" in files:
        return "AGENTS.md"
    # Case-insensitive fallback
    for key in files:
        if key.rstrip("/").rsplit("/", 1)[-1].lower() == "agents.md":
            return key
    return None
```

---

## 4. Content Extraction Helper -- Design

Given the multiple formats documented in Section 1, a robust extraction function is needed:

```python
def extract_file_content(file_value: Any) -> str | None:
    """
    Safely extract text content from a files map entry,
    regardless of format (string, dict with content key, list).

    Returns the extracted string content, or None if empty/invalid.

    Supported formats:
    - str: returned as-is
    - dict with "content" key:
        - content is str: returned as-is
        - content is list[str]: joined with newlines
    - list[str]: joined with newlines
    """
    if file_value is None:
        return None

    # Format 1: Plain string (from assistant.files Dict[str, str])
    if isinstance(file_value, str):
        return file_value.strip() or None

    # Format 2: Dict with "content" key (from frontend FileData)
    if isinstance(file_value, dict):
        content = file_value.get("content")
        if content is None:
            return None
        if isinstance(content, str):
            return content.strip() or None
        if isinstance(content, list):
            joined = "\n".join(str(line) for line in content)
            return joined.strip() or None
        return None

    # Format 3: List of strings (edge case)
    if isinstance(content, list):
        joined = "\n".join(str(line) for line in file_value)
        return joined.strip() or None

    return None
```

### Where to place this utility

Recommended location: `/home/ryaneggz/ruska-ai/orchestra/backend/src/utils/files.py` (new file)

This keeps it co-located with other utility modules (`utils/format.py`, `utils/stream.py`) and makes it importable from both `services/llm.py` and any future extraction points.

---

## 5. Priority / Precedence -- Agent Files vs Thread Files

### Current precedence for instructions

The existing code in `LLMService.assistant()` (`/home/ryaneggz/ruska-ai/orchestra/backend/src/services/llm.py`, lines 124-172) works as follows:

1. If `params.metadata.assistant_id` is set, load the assistant
2. Use the assistant's `system_prompt` and `instructions`
3. Convert to `LLMRequest` via `to_llm_request()`
4. The `LLMRequest` carries `instructions` and `system_prompt` to `construct_agent()` -> `init_system_prompt()`

The `init_system_prompt()` function (`/home/ryaneggz/ruska-ai/orchestra/backend/src/utils/format.py`, line 81-116) combines `system_prompt` + `instructions` + metadata.

### Recommended AGENTS.md precedence

Based on the PRD requirements (FR-1 through FR-5):

**Priority order (highest to lowest):**

1. **Agent-level AGENTS.md** (`assistant.files["AGENTS.md"]`) -- When an assistant is loaded and has AGENTS.md in its files, this takes precedence over everything. It overrides the assistant's existing `instructions` field.

2. **Assistant's existing `instructions` field** -- Backwards compatibility fallback when no AGENTS.md exists in agent files.

3. **Thread-level AGENTS.md** (`params.input.files["AGENTS.md"]`) -- For non-agent mode (no assistant_id). When no assistant is loaded, check thread-level files.

4. **Existing `params.instructions`** -- Final fallback for non-agent mode.

### Why agent-level AGENTS.md wins over thread-level

When an assistant is loaded via `assistant_id`, the assistant's configuration (including its files) represents the agent's identity. Thread-level files represent the conversation context. The agent's AGENTS.md should define the agent's behavior, not be overridden by thread files.

### Implementation approach

In `LLMService.assistant()`:

```python
async def assistant(self, params: LLMRequest) -> LLMRequest:
    # ... existing code ...

    if params.metadata.assistant_id:
        assistant = await self.assistant_service.get(...)
        if assistant:
            # NEW: Check for AGENTS.md in assistant files
            agents_md_key = find_agents_md_key(assistant.files)
            if agents_md_key:
                content = extract_file_content(assistant.files[agents_md_key])
                if content:
                    assistant.system_prompt = None  # Use default
                    assistant.instructions = content

            assistant.system_prompt = self.default_system_prompt(assistant)
            assistant.tools = await self.init_tools(...)
            return assistant.to_llm_request(...)

    # Non-agent mode: check thread-level files
    agents_md_key = find_agents_md_key(params.input.files)
    if agents_md_key:
        content = extract_file_content(params.input.files[agents_md_key])
        if content:
            params.instructions = content

    params.system_prompt = self.default_system_prompt(params)
    params.tools = await self.init_tools(...)
    return params
```

### Validator safety note

The `Assistant` model has a validator at line 103-109:

```python
@model_validator(mode="after")
def validate_system_prompt_or_instructions(self):
    if self.system_prompt and self.instructions:
        raise ValueError(
            "Only one of system_prompt or instructions may be set, not both."
        )
    return self
```

Setting `assistant.system_prompt = None` before assigning `instructions` avoids triggering this validator. However, since the validator runs at model creation time (`mode="after"`), and we are mutating an already-created instance, this validator will NOT re-run on attribute assignment. We are safe to set both fields sequentially on an existing instance. The validator only fires during `__init__` / `model_validate`.

---

## 6. Schema Implications -- Does Anything Need to Change?

### Answer: No schema changes are required.

Here is why:

| Schema | Current State | Impact |
|--------|---------------|--------|
| `Assistant.files: Optional[Dict[str, str]]` | Already supports storing AGENTS.md as a string value | No change needed |
| `Assistant.instructions: Optional[str]` | Already exists; AGENTS.md content will be assigned to this field at runtime | No change needed |
| `Assistant.system_prompt: Optional[str]` | Already optional; will be set to None when AGENTS.md is present | No change needed |
| `LLMInput.files: Optional[Dict[str, Any]]` | Already supports any value format | No change needed |
| `LLMRequest.instructions: Optional[str]` | Already carries instructions to `construct_agent()` | No change needed |
| `Config` (metadata) | No files field needed in metadata | No change needed |
| `Thread.files: Optional[Any]` | Already stores files for thread persistence | No change needed |

The PRD explicitly states (Non-Goals): "No changes to the `Assistant` Pydantic model schema itself" and "No removal of `system_prompt`/`instructions` fields from the backend model (kept for backwards compatibility)."

### One consideration: `LLMRequest` does not carry `files` from assistant

The `to_llm_request()` method does not forward `assistant.files` into the `LLMRequest`. This is by design -- the files are agent configuration, not request-level data. The AGENTS.md extraction happens before the conversion to `LLMRequest`, so the extracted content flows through `instructions` instead.

---

## Summary: Data Flow Diagram

```
Request arrives at /api/llm
    |
    v
LLMRequest parsed (input.files = Dict[str, Any])
    |
    v
LLMService.assistant(params)
    |
    +-- Has assistant_id? ----YES----> Load Assistant from store
    |                                       |
    |                                       v
    |                                  assistant.files (Dict[str, str])
    |                                       |
    |                                       v
    |                                  find_agents_md_key(assistant.files)
    |                                       |
    |                                  Found? --YES--> extract_file_content()
    |                                       |              |
    |                                       |              v
    |                                       |         assistant.instructions = content
    |                                       |         assistant.system_prompt = None
    |                                       |
    |                                       v
    |                                  to_llm_request() -> LLMRequest
    |                                       |
    |                                       v
    |                                  init_system_prompt(DEFAULT + instructions)
    |
    +-- No assistant_id -----> Check params.input.files (Dict[str, Any])
                                       |
                                       v
                                  find_agents_md_key(params.input.files)
                                       |
                                  Found? --YES--> extract_file_content()
                                       |              |
                                       |              v
                                       |         params.instructions = content
                                       |
                                       v
                                  init_system_prompt(system_prompt + instructions)
```

---

## Files Referenced in This Analysis

| File | Relevance |
|------|-----------|
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/schemas/entities/llm.py` | `LLMInput.files` (Dict[str, Any]), `Assistant.files` (Dict[str, str]), `Assistant.to_llm_request()`, validator |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/agents/__init__.py` | `init_config()` placing files into configurable, `construct_agent()`, `init_system_prompt()` usage |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/utils/stream.py` | `stream_generator()` files_map extraction from config/input |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/workers/tasks.py` | `_execute_agent_stream()` files_map from config, calls `LLMService.assistant()` |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/services/llm.py` | `LLMService.assistant()` -- the injection point for AGENTS.md |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/utils/format.py` | `init_system_prompt()` composing final prompt with instructions |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/services/assistant.py` | `AssistantService` loading assistants from store |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/schemas/entities/store.py` | `Thread.files` (Optional[Any]) |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/controllers/llm.py` | `LLMController` entry point, runtime init with files |
| `/home/ryaneggz/ruska-ai/orchestra/frontend/src/hooks/useFileSystem.ts` | `FileData` interface, `toBackendFormat()`, `getFilesForSubmission()` |
| `/home/ryaneggz/ruska-ai/orchestra/frontend/src/hooks/useChat.ts` | `filesToSubmit` construction, filesMap SSE handling |
| `/home/ryaneggz/ruska-ai/orchestra/frontend/src/context/ChatContext.tsx` | User files sync to filesMap |
| `/home/ryaneggz/ruska-ai/orchestra/frontend/src/components/forms/agents/agent-create-form.tsx` | Agent form using `toBackendFormat()` for files |
| `/home/ryaneggz/ruska-ai/orchestra/tasks/prd-agents-md-system-prompt-injection.md` | PRD defining requirements |
