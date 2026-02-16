# RLM Library Architecture Analysis

> Analysis of the [rlms](https://github.com/alexzhang13/rlm) library (v0.x) for Orchestra integration evaluation.
> Paper: [arXiv:2512.24601v2](https://arxiv.org/abs/2512.24601) by Alex Zhang, Tim Kraska, Omar Khattab (MIT OASYS Lab)

## 1. Overview

Recursive Language Models (RLMs) replace the standard `llm.completion(prompt, model)` call with `rlm.completion(prompt, model)`. The key insight is that instead of passing the entire context to the LM, the context is offloaded to a **REPL environment variable** that the LM can programmatically examine, decompose, and query sub-LMs about — enabling near-infinite context processing.

The library is installed via `pip install rlms` and exposes a single primary class: `RLM`.

```python
from rlm import RLM

rlm = RLM(
    backend="openai",
    backend_kwargs={"model_name": "gpt-5-nano"},
    environment="local",  # or "docker", "modal", "prime", "daytona", "e2b"
    max_depth=1,
    max_iterations=30,
    verbose=True,
)

result = rlm.completion("Analyze this large input...", root_prompt="What are the key findings?")
print(result.response)
```

---

## 2. How `rlm.completion()` Orchestrates Decomposition

**Source**: `rlm/core/rlm.py` — `RLM.completion()` (line 192)

### 2.1 High-Level Flow

```
User calls rlm.completion(prompt)
        │
        ▼
┌─ Depth Check ─────────────────────────────────────────┐
│ If depth >= max_depth → fallback to plain LLM call     │
│ (This is the recursion base case)                      │
└────────────────────────────────────────────────────────┘
        │ depth < max_depth
        ▼
┌─ Spawn Completion Context ────────────────────────────┐
│ 1. Create LM client (BaseLM) from backend config       │
│ 2. Create LMHandler (TCP socket server on localhost)    │
│ 3. Create or reuse REPL Environment                    │
│ 4. Load context payload into environment               │
└────────────────────────────────────────────────────────┘
        │
        ▼
┌─ Setup Prompt ────────────────────────────────────────┐
│ 1. Compute QueryMetadata (char lengths, type)          │
│ 2. Build system prompt + metadata assistant message    │
└────────────────────────────────────────────────────────┘
        │
        ▼
┌─ Iterative Loop (up to max_iterations=30) ────────────┐
│                                                        │
│   ┌─ Build current prompt ──────────────────────┐      │
│   │ message_history + user prompt suffix         │      │
│   │ (includes iteration number, context count)   │      │
│   └─────────────────────────────────────────────┘      │
│           │                                            │
│           ▼                                            │
│   ┌─ _completion_turn() ────────────────────────┐      │
│   │ 1. LM generates response (may contain       │      │
│   │    ```repl``` code blocks)                   │      │
│   │ 2. Parse code blocks via find_code_blocks()  │      │
│   │ 3. Execute each code block in environment    │      │
│   │ 4. Collect results (stdout, stderr, locals,  │      │
│   │    any sub-LLM calls made)                   │      │
│   │ 5. Return RLMIteration                       │      │
│   └─────────────────────────────────────────────┘      │
│           │                                            │
│           ▼                                            │
│   ┌─ Check for final answer ────────────────────┐      │
│   │ Parse response for FINAL(...) or             │      │
│   │ FINAL_VAR(variable_name)                     │      │
│   └─────────────────────────────────────────────┘      │
│           │                                            │
│       ┌───┴───┐                                        │
│   Found?   Not found?                                  │
│       │        │                                       │
│       ▼        ▼                                       │
│   Return    Format iteration into message history      │
│   result    and continue loop                          │
│                                                        │
└────────────────────────────────────────────────────────┘
        │ (if max_iterations exhausted)
        ▼
┌─ Default Answer ──────────────────────────────────────┐
│ Force the LM to produce a final answer from the        │
│ accumulated message history                            │
└────────────────────────────────────────────────────────┘
```

### 2.2 Key Mechanism: The LM Controls Decomposition

Unlike traditional chunking systems where the orchestrator pre-splits the input, in RLM the **LM itself decides how to decompose** the input. The LM receives:

1. A system prompt explaining the REPL environment and available functions
2. The context loaded as a variable in the REPL (not in the LM's prompt)
3. Iteration-by-iteration feedback from REPL execution results

The LM writes Python code in ````repl` `` blocks that:
- Reads and chunks the context variable
- Calls `llm_query()` or `llm_query_batched()` on chunks
- Stores results in variables
- Eventually calls `FINAL(answer)` or `FINAL_VAR(variable_name)`

### 2.3 The Iteration Protocol

Each iteration follows this conversation pattern:

```
[system] RLM_SYSTEM_PROMPT explaining REPL, llm_query, FINAL
[assistant] "Your context is a {type} with {N} total characters..."
[user] "Think step-by-step... Your next action:"
[assistant] "Let me examine the context... ```repl\nprint(len(context))\n```"
[user] "Code executed: ... REPL output: 500000"
[assistant] "I'll chunk this into 10 parts... ```repl\nchunks = ...\nanswers = llm_query_batched(prompts)\n```"
[user] "Code executed: ... REPL output: ..."
[assistant] "FINAL(The analysis shows...)"
```

The message history grows with each iteration, with assistant responses containing code and user messages containing execution results.

---

## 3. REPL Environment Interface

**Source**: `rlm/environments/base_env.py`

### 3.1 Base Interface

```python
class BaseEnv(ABC):
    def setup(self)                                    # Initialize environment
    def load_context(self, context_payload)             # Load initial context
    def execute_code(self, code: str) -> REPLResult    # Execute a code block
```

The `REPLResult` dataclass returned from `execute_code()`:

```python
@dataclass
class REPLResult:
    stdout: str                          # Printed output
    stderr: str                          # Error output
    locals: dict                         # Current variable state
    execution_time: float                # Wall clock time
    llm_calls: list[RLMChatCompletion]   # Sub-LLM calls made during execution
```

### 3.2 Environment Hierarchy

```
BaseEnv (ABC)
├── NonIsolatedEnv (ABC) — same machine as LM
│   ├── LocalREPL        — Python exec() in subprocess namespace
│   └── DockerREPL       — Docker container with HTTP proxy
└── IsolatedEnv (ABC)    — separate machine from LM
    ├── ModalREPL        — Modal Sandbox with tunnel
    ├── DaytonaREPL      — Daytona Sandbox with preview URL
    ├── PrimeREPL        — Prime Intellect Sandbox with port exposure
    └── E2BREPL          — E2B Sandbox
```

### 3.3 SupportsPersistence Protocol

**Source**: `rlm/environments/base_env.py` line 76

For multi-turn conversations, environments can implement:

```python
@runtime_checkable
class SupportsPersistence(Protocol):
    def update_handler_address(self, address: tuple[str, int]) -> None
    def add_context(self, context_payload, context_index=None) -> int
    def get_context_count(self) -> int
    def add_history(self, message_history, history_index=None) -> int
    def get_history_count(self) -> int
```

Currently only `LocalREPL` supports persistence. Contexts and histories are versioned (`context_0`, `context_1`, etc.) with `context` aliasing `context_0`.

### 3.4 Functions Injected into REPL

Every REPL environment provides these built-in functions to code executed within it:

| Function | Signature | Description |
|----------|-----------|-------------|
| `llm_query` | `(prompt: str, model: str = None) -> str` | Query a sub-LM synchronously |
| `llm_query_batched` | `(prompts: list[str], model: str = None) -> list[str]` | Query multiple prompts concurrently |
| `FINAL_VAR` | `(variable_name: str) -> str` | Return a REPL variable as the final answer |
| `SHOW_VARS` | `() -> str` | List all available variables |
| `context` | variable | The loaded context data |
| `print` | built-in | Standard output (captured and returned) |

---

## 4. Recursive Call Tracking and Aggregation

### 4.1 The LMHandler Architecture

**Source**: `rlm/core/lm_handler.py`

The `LMHandler` is a multi-threaded TCP socket server that routes all LLM requests — both from the root RLM process and from code executing inside REPL environments.

```
┌─────────────────────────────────────────────────────────┐
│                     RLM Process                          │
│                                                          │
│  ┌─────────────┐     ┌──────────────────────────┐       │
│  │ RLM.completion│────▶│ LMHandler (TCP Server)   │       │
│  │ (root calls) │     │ host: 127.0.0.1          │       │
│  └─────────────┘     │ port: auto-assigned       │       │
│                       │                          │       │
│                       │ Routes by depth:         │       │
│                       │  depth=0 → default_client│       │
│                       │  depth=1 → other_client  │       │
│                       └─────────┬────────────────┘       │
│                                 │                        │
│  ┌──────────────────────────────┼────────────────────┐   │
│  │ REPL Environment             │                    │   │
│  │                              │                    │   │
│  │  Code calls llm_query() ─────┘                    │   │
│  │  via socket (local) or HTTP (isolated)            │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Communication Patterns

**Local REPL** (same process):
- `llm_query()` calls `send_lm_request()` which opens a TCP socket to the LMHandler
- Protocol: 4-byte big-endian length prefix + JSON payload
- LMHandler routes to appropriate client based on `depth` parameter

**Isolated REPLs** (Docker, Modal, Prime, Daytona):
- A **broker server** (Flask app) runs inside the sandbox on port 8080/8888
- Code in sandbox calls broker's `/enqueue` endpoint (HTTP POST)
- The broker queues the request and blocks the calling thread
- A **poller thread** on the host side polls broker's `/pending` endpoint
- Host forwards request to LMHandler via TCP socket
- Host posts response back to broker's `/respond` endpoint
- Broker unblocks the original calling thread with the response

### 4.3 Depth-Based Model Routing

The `LMHandler.get_client()` method routes requests to different LLM providers based on depth:

```python
def get_client(self, model=None, depth=0) -> BaseLM:
    if model and model in self.clients:
        return self.clients[model]       # Explicit model request
    if depth == 1 and self.other_backend_client:
        return self.other_backend_client  # Sub-calls use cheaper model
    return self.default_client            # Root calls use main model
```

This allows using a powerful model (e.g., GPT-4) for root orchestration and a cheaper model (e.g., GPT-4o-mini) for sub-calls, reducing cost.

### 4.4 Batched Request Support

Both single and batched requests are supported:

```python
# Single request
@dataclass
class LMRequest:
    prompt: str | dict | None = None     # Single prompt
    prompts: list[str | dict] | None = None  # Batched prompts
    model: str | None = None
    depth: int = 0
```

Batched requests use `asyncio.gather()` for concurrent processing on the LMHandler side:

```python
async def run_all():
    tasks = [client.acompletion(prompt) for prompt in request.prompts]
    return await asyncio.gather(*tasks)
```

### 4.5 Usage/Cost Tracking

Every LLM call tracks token usage via the `UsageSummary` system:

```python
@dataclass
class UsageSummary:
    model_usage_summaries: dict[str, ModelUsageSummary]
    # e.g., {"gpt-4": ModelUsageSummary(calls=5, input_tokens=10000, output_tokens=2000),
    #        "gpt-4o-mini": ModelUsageSummary(calls=50, input_tokens=100000, output_tokens=20000)}
```

The final `RLMChatCompletion` includes total usage across all sub-calls:

```python
@dataclass
class RLMChatCompletion:
    root_model: str
    prompt: str | dict
    response: str
    usage_summary: UsageSummary
    execution_time: float
```

---

## 5. Prompt Templates for Decomposition and Synthesis

**Source**: `rlm/utils/prompts.py`

### 5.1 System Prompt (`RLM_SYSTEM_PROMPT`)

The system prompt is the core of how the LM knows to use the REPL. Key elements:

1. **Role**: "You are tasked with answering a query with associated context"
2. **Environment description**: Explains `context`, `llm_query`, `llm_query_batched`, `SHOW_VARS`, `print`
3. **Code execution format**: ` ```repl\n...\n``` ` blocks
4. **Strategy examples**:
   - Chunking context and querying sub-LMs per chunk
   - Iterative section-by-section analysis with buffers
   - `llm_query_batched()` for parallel concurrent queries
   - Markdown header-based structural decomposition
5. **Final answer protocol**: `FINAL(answer)` or `FINAL_VAR(variable_name)`
6. **Common mistake warnings**: FINAL_VAR requires creating the variable first

### 5.2 Context Metadata

Before the first user turn, an assistant message provides metadata:

```
"Your context is a {type} with {total_length} total characters,
and is broken up into chunks of char lengths: {chunk_lengths}."
```

This helps the LM plan its decomposition strategy based on actual data size.

### 5.3 User Prompt Variants

**First iteration** (iteration=0):
```
"You have not interacted with the REPL environment or seen your prompt / context yet.
Your next action should be to look through and figure out how to answer the prompt,
so don't just provide a final answer yet."
```

**Subsequent iterations** (iteration>0):
```
"The history before is your previous interactions with the REPL environment.
Continue using the REPL environment..."
```

**With root_prompt**:
```
"Think step-by-step on what to do using the REPL environment (which contains the context)
to answer the original prompt: \"{root_prompt}\"."
```

**Multi-context/Multi-history**:
```
"Note: You have {N} contexts available (context_0 through context_{N-1})."
"Note: You have {N} prior conversation histories available (history_0 through history_{N-1})."
```

### 5.4 Parsing

**Code block extraction** (`find_code_blocks()`):
- Regex: `` ```repl\s*\n(.*?)\n``` ``
- Returns list of code strings

**Final answer detection** (`find_final_answer()`):
- Checks for `FINAL_VAR(name)` first (executes code to retrieve variable)
- Then checks for `FINAL(answer)` (extracts inline text)
- Both patterns must be at start of line

**Iteration formatting** (`format_iteration()`):
- Assistant response added as-is
- Each code block result formatted as user message with code + REPL output
- Results truncated to 20,000 chars to avoid context overflow

---

## 6. Sandbox Backend Abstraction

### 6.1 Environment Factory

**Source**: `rlm/environments/__init__.py` — `get_environment()`

```python
EnvironmentType = Literal["local", "docker", "modal", "prime", "daytona", "e2b"]
```

| Environment | Class | Isolation | LLM Communication | Persistence | Notes |
|-------------|-------|-----------|-------------------|-------------|-------|
| `local` | `LocalREPL` | None (exec in process) | TCP socket direct | Yes | Default, fastest |
| `docker` | `DockerREPL` | Container | HTTP proxy on host | No | Requires Docker |
| `modal` | `ModalREPL` | Cloud sandbox | HTTP broker + tunnel | No | Requires Modal account |
| `prime` | `PrimeREPL` | Cloud sandbox | HTTP broker + port exposure | No | Prime Intellect (beta) |
| `daytona` | `DaytonaREPL` | Cloud sandbox | HTTP broker + preview URL | No | Daytona.io |
| `e2b` | `E2BREPL` | Cloud sandbox | HTTP broker | No | E2B.dev |

### 6.2 Communication Architecture Comparison

**LocalREPL**:
```
REPL code → llm_query() → TCP socket → LMHandler → LLM API → response back via socket
```

**Isolated REPLs (Modal/Prime/Daytona)**:
```
REPL code → HTTP POST to localhost:8080 (broker inside sandbox)
    → broker queues & blocks
    → host poller thread polls /pending
    → host sends TCP to LMHandler → LLM API
    → host posts to /respond
    → broker unblocks → returns to REPL code
```

### 6.3 State Management in Isolated Environments

Isolated environments persist state between code blocks using `dill` serialization:

```python
STATE_FILE = "/tmp/rlm_state.dill"

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "rb") as f:
            return dill.load(f)
    return {}

def save_state(state):
    # Filter non-serializable and internal vars
    clean_state = {k: v for k, v in state.items() if not k.startswith("_") and dill.dumps(v)}
    with open(STATE_FILE, "wb") as f:
        dill.dump(clean_state, f)
```

LocalREPL keeps state in-memory via persistent `globals`/`locals` dicts.

### 6.4 Client Backend Abstraction

**Source**: `rlm/clients/base_lm.py`, `rlm/clients/__init__.py`

```python
ClientBackend = Literal[
    "openai", "portkey", "openrouter", "vercel", "vllm",
    "litellm", "anthropic", "azure_openai", "gemini"
]
```

All clients implement:

```python
class BaseLM(ABC):
    def completion(self, prompt: str | dict) -> str
    async def acompletion(self, prompt: str | dict) -> str
    def get_usage_summary(self) -> UsageSummary
    def get_last_usage(self) -> ModelUsageSummary
```

The library supports dual-backend configurations for cost optimization:
- **Root backend** (`backend`): Used for the main LM's orchestration reasoning (e.g., GPT-4, Claude Sonnet)
- **Sub-call backend** (`other_backends`): Used for recursive sub-LM calls from REPL code (e.g., GPT-4o-mini)

```python
rlm = RLM(
    backend="openai",
    backend_kwargs={"model_name": "gpt-4"},
    other_backends=["openai"],
    other_backend_kwargs=[{"model_name": "gpt-4o-mini"}],
)
```

Currently limited to exactly one additional backend.

---

## 7. Key Architectural Observations

### 7.1 Strengths

1. **LM-driven decomposition**: The LM decides how to chunk and analyze, not a fixed algorithm. This adapts to any input structure.
2. **Clean abstraction**: `BaseEnv` + `BaseLM` makes it easy to add new environments and providers.
3. **Cost optimization**: Depth-based routing allows cheap sub-calls with an expensive orchestrator.
4. **Batched queries**: `llm_query_batched()` enables parallel sub-LM processing.
5. **Usage tracking**: Full token accounting across all recursive calls.
6. **Persistence support**: Multi-turn conversations with context versioning.

### 7.2 Limitations

1. **max_depth=1 only**: The library currently only supports one level of recursion (root LM + one level of sub-calls). True recursive depth is not yet implemented.
2. **No streaming**: `completion()` is synchronous and returns only when finished. No intermediate streaming of results.
3. **Single other_backend**: Only one additional backend is supported for sub-calls.
4. **Prompt-based control**: The quality of decomposition depends entirely on how well the LM follows the system prompt. There's no explicit decomposition graph or verification.
5. **No parallel environment execution**: All code blocks within a single iteration execute sequentially.
6. **Persistence only local**: Only `LocalREPL` supports multi-turn conversations.

### 7.3 Security Model

- `LocalREPL` uses a safe builtins whitelist (blocks `eval`, `exec`, `input`, `compile`, `globals`, `locals`) but still runs `exec()` in the host process — not suitable for untrusted inputs.
- Isolated environments (Docker, Modal, Prime, Daytona) provide full sandboxing.
- All environments allow `__import__` and `open` — code can import any installed package and read/write files.

---

## 8. Library Structure

```
rlm/
├── __init__.py              # Exports: RLM
├── core/
│   ├── rlm.py               # RLM class — main entry point
│   ├── lm_handler.py         # LMHandler — TCP server routing LLM requests
│   ├── comms_utils.py        # Socket protocol, request/response types
│   └── types.py              # Data types: RLMChatCompletion, REPLResult, etc.
├── clients/
│   ├── base_lm.py            # BaseLM ABC
│   ├── openai.py             # OpenAI/vLLM/OpenRouter/Vercel client
│   ├── anthropic.py          # Anthropic client
│   ├── gemini.py             # Google Gemini client
│   ├── litellm.py            # LiteLLM router client
│   ├── azure_openai.py       # Azure OpenAI client
│   └── portkey.py            # Portkey router client
├── environments/
│   ├── base_env.py           # BaseEnv, IsolatedEnv, NonIsolatedEnv, SupportsPersistence
│   ├── local_repl.py         # LocalREPL (default, in-process)
│   ├── docker_repl.py        # DockerREPL (container)
│   ├── modal_repl.py         # ModalREPL (cloud sandbox)
│   ├── daytona_repl.py       # DaytonaREPL (cloud sandbox)
│   ├── prime_repl.py         # PrimeREPL (cloud sandbox)
│   ├── e2b_repl.py           # E2BREPL (cloud sandbox)
│   └── constants.py          # Default packages for sandboxes
├── utils/
│   ├── prompts.py            # System prompt, user prompt builders
│   ├── parsing.py            # Code block extraction, final answer detection
│   └── rlm_utils.py          # Utility: filter sensitive keys
└── logger/
    ├── rlm_logger.py         # JSONL logging for trajectory visualization
    └── verbose.py            # Rich console printer
```

---

*Analysis performed on 2026-02-16 from [github.com/alexzhang13/rlm](https://github.com/alexzhang13/rlm) (cloned at latest commit).*

---

## 9. RLM → Orchestra Concept Mapping

This section maps each RLM architectural concept to its Orchestra equivalent, identifying gaps that need bridging for integration.

### 9.1 Mapping Table

| RLM Concept | RLM Implementation | Orchestra Equivalent | Gap / Bridge Needed |
|---|---|---|---|
| **Root LM orchestration** | `RLM.completion()` — iterative LM + REPL loop with decomposition | `stream_generator()` in `backend/src/utils/stream.py` — LangGraph agent streaming loop | Orchestra's loop is tool-call driven (LM picks tools), not REPL-driven (LM writes code). Need to either adapt RLM's REPL loop to emit LangGraph events or implement RLM-style iteration as a LangGraph node. |
| **Sub-LM calls** | `llm_query()` / `llm_query_batched()` via LMHandler TCP server | SubAgents via `deepagents` — supervisor invokes worker agents with own tools/model | Direct mapping: RLM sub-calls ≈ SubAgent invocations. **Gap**: RLM sub-calls are simple prompt→response; Orchestra SubAgents are full agents with tools. Sub-calls would need to be exposed as either simplified SubAgents or a new lightweight call mechanism. |
| **REPL Environment** | `BaseEnv.execute_code()` — Python exec in local/Docker/Modal/Daytona sandbox | Daytona sandbox via `backend/src/agents/daytona.py` + Python code interpreter tool | Good fit. Orchestra already has Daytona integration and a code interpreter tool. **Gap**: RLM injects `llm_query`, `FINAL`, `SHOW_VARS` into the REPL namespace; Orchestra's sandbox doesn't have these. Need to inject RLM-specific functions into the sandbox or proxy them. |
| **Depth-based model routing** | `LMHandler.get_client(depth)` — depth=0 uses root model, depth=1 uses cheaper model | Dynamic model selection middleware in `backend/src/utils/middleware.py` — complexity-based routing | Partial mapping. Orchestra routes by query complexity (simple/complex), RLM routes by call depth. **Gap**: No depth-awareness in Orchestra's model routing. Would need to pass depth context through the call chain or use SubAgent model config (each SubAgent already accepts its own `model`). |
| **Batched parallel queries** | `llm_query_batched()` → `asyncio.gather()` on LMHandler | No direct equivalent — SubAgents execute sequentially under supervisor | **Significant gap**. Orchestra doesn't support parallel sub-LM calls within a single turn. The deepagents supervisor invokes one SubAgent at a time. Would need either: (a) parallel tool execution in LangGraph, (b) a batch-query tool, or (c) use the rlms library's own batching. |
| **Context payload** | `env.load_context(payload)` — loads large text into REPL variable, not LM prompt | LangGraph state + `CompositeBackend` file storage via `AutoEvictMiddleware` | Partial mapping. Orchestra's `AutoEvictMiddleware` evicts large tool results (>40k chars) to filesystem. **Gap**: No concept of "REPL-resident context" that the LM can programmatically access without it counting against the context window. |
| **Iteration protocol** | LM generates `\`\`\`repl\`\`\`` blocks → execute → results appended to history → repeat | LangGraph message loop: LM generates tool calls → execute → results in state → repeat | Structurally similar. Both are iterative LM + execution loops. **Gap**: RLM uses code block parsing; Orchestra uses structured tool calls. RLM's iteration formatting (code + REPL output in user messages) differs from LangGraph's ToolMessage pattern. |
| **Final answer detection** | `FINAL()` / `FINAL_VAR()` parsed from LM response | LM's natural end-of-turn (no tool calls) signals completion | **Gap**: RLM requires explicit signaling via FINAL; Orchestra relies on the LM simply not invoking tools. If using RLM-style iteration, need to implement FINAL detection or map it to a special "done" tool. |
| **Usage/cost tracking** | `UsageSummary` — per-model token counts aggregated across all sub-calls | Token-based compaction threshold (`DEFAULT_COMPACTION_TOKEN_THRESHOLD = 170k`) + heuristic estimation (`len(content) // 4`) | **Significant gap**. Orchestra doesn't have per-request usage metering — it uses heuristic estimates for compaction only. RLM provides precise token counts per model across all recursive calls. Would need to add token logging per request/sub-request, or leverage rlms library's built-in tracking. |
| **Sandbox environments** | 6 environments: local, Docker, Modal, Prime, Daytona, E2B | Daytona (primary) + StateBackend (fallback) via `resolve_sandbox_backend()` | Good fit for Daytona. **Gap**: RLM supports 5 additional environment types. Orchestra only uses Daytona. For integration, constrain to Daytona + local (for development). |
| **State persistence** | `dill` serialization (isolated) / in-memory dicts (local) | PostgreSQL checkpointing via `langgraph-checkpoint-postgres` | Different approaches. Orchestra persists conversation state in Postgres; RLM persists REPL variable state in-memory or via dill. **Gap**: If using RLM's REPL, its state is ephemeral and separate from Orchestra's checkpoint. Would need to serialize REPL state into the LangGraph checkpoint if persistence across sessions is required. |
| **LLM client abstraction** | `BaseLM` — 9 providers (OpenAI, Anthropic, Gemini, LiteLLM, etc.) | `init_chat_model()` via LangChain — OpenAI, Anthropic, Google, Groq, XAI, Bedrock, Ollama | Overlapping but not identical. Both support major providers. **Gap**: RLM uses its own client classes; Orchestra uses LangChain's `BaseChatModel`. For direct integration, either: (a) configure rlms to use a provider Orchestra already has keys for, or (b) write a LangChain→BaseLM adapter. |
| **Prompt templates** | `RLM_SYSTEM_PROMPT` in `rlm/utils/prompts.py` — REPL instructions, strategy examples | Agent system prompts built by `init_system_prompt()` in `backend/src/agents/__init__.py` | **Gap**: RLM's system prompt is specialized for REPL-based decomposition. It would need to coexist with Orchestra's agent system prompt. For direct integration, the RLM prompt runs in the rlms library independently. For native implementation, the decomposition prompt would need to be added to Orchestra's prompt pipeline. |
| **Streaming output** | None — `completion()` is synchronous, returns only final result | SSE streaming via `stream_generator()` with `["messages", chunk_data]` format + `subgraphs=True` for SubAgent streaming | **Critical gap**. RLM has no streaming. Orchestra's UX depends on streaming. For integration, either: (a) run RLM in background and stream status updates, (b) implement RLM-style iteration natively in LangGraph with per-step streaming, or (c) contribute streaming to the rlms library. |
| **Existing RLM skill** | N/A | `.claude/skills/rlm/SKILL.md` — Claude Code skill implementing RLM pattern with Task tool (Sonnet supervisor + Haiku workers) | This is a CLI-level implementation only. Works for Claude Code users but not for the web platform. **Gap**: Need to port the skill's decompose→parallel-process→synthesize pattern to the backend agent pipeline for platform-level support. |

### 9.2 Detailed Gap Analysis

#### Gap 1: No Streaming in RLM (Critical)

Orchestra's frontend relies on SSE streaming to show real-time agent activity. The `stream_generator()` yields events for every LM token, tool call, and SubAgent message. RLM's `completion()` blocks until fully complete — potentially minutes for large inputs.

**Impact**: Users would see a loading spinner for the entire RLM execution duration with no visibility into progress.

**Bridge options**:
- **Option A**: Wrap `rlm.completion()` as a LangGraph tool. Stream a "processing" status, then return the final result. Minimal visibility but simple.
- **Option B**: Implement RLM-style iteration natively as LangGraph nodes. Each iteration (code generation → execution → result) becomes a streamed step. Maximum visibility but highest effort.
- **Option C**: Modify rlms library to accept callbacks per iteration. Emit SSE events from callbacks. Medium effort, requires library changes.

#### Gap 2: Parallel Sub-LM Calls (Significant)

RLM's `llm_query_batched()` runs multiple sub-LM calls concurrently via `asyncio.gather()`. Orchestra's SubAgent model is sequential — the supervisor picks one SubAgent at a time.

**Impact**: Lose the parallelism benefit that makes RLM fast for large inputs.

**Bridge options**:
- **Option A**: Use rlms library's built-in batching (direct integration). Preserves parallelism.
- **Option B**: Implement a `parallel_llm_query` tool in Orchestra that internally uses `asyncio.gather()`.
- **Option C**: Leverage LangGraph's `Send()` API for parallel node execution (requires deepagents support).

#### Gap 3: REPL-Resident Context (Significant)

RLM's key insight is that large context lives in the REPL environment, not the LM's context window. The LM accesses it programmatically via `print(context[:1000])` or `len(context)`. Orchestra currently passes all context in the message history.

**Impact**: Without this, large input processing still hits context window limits.

**Bridge options**:
- **Option A**: Use rlms library directly (context stays in rlms REPL). Works out of the box.
- **Option B**: Use Orchestra's `AutoEvictMiddleware` pattern — store large context in filesystem, give the LM a reference and code tool to access it.
- **Option C**: Implement a `context_store` tool that lets the agent save/retrieve large blobs from a key-value store.

#### Gap 4: Cost Tracking Across Recursive Calls (Moderate)

RLM tracks exact token usage per model via `UsageSummary`. Orchestra only estimates tokens for compaction decisions.

**Impact**: Can't report accurate cost for RLM operations to users.

**Bridge options**:
- **Option A**: Use rlms library's `UsageSummary` and surface it in the thread metadata.
- **Option B**: Add LangChain callback-based token counting to the agent pipeline.
- **Option C**: Defer — use heuristic estimates initially, add precise tracking later.

#### Gap 5: LLM Client Mismatch (Low)

RLM uses its own `BaseLM` client classes. Orchestra uses LangChain's `BaseChatModel`.

**Impact**: Need to configure API keys for both systems if using direct integration.

**Bridge options**:
- **Option A**: Pass Orchestra's API keys to rlms library configuration. Simple.
- **Option B**: Write a `LangChainLM` adapter that wraps `BaseChatModel` as RLM's `BaseLM`. Reuses Orchestra's existing client infrastructure.
- **Option C**: For native implementation, this gap disappears — use LangChain clients directly.

### 9.3 Component-Level Mapping Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          RLM Architecture                                │
│                                                                          │
│  ┌──────────────┐    ┌───────────────┐    ┌─────────────────────────┐   │
│  │ RLM.completion│───▶│ LMHandler TCP │───▶│ BaseLM (OpenAI/Anthro) │   │
│  │ (orchestrator)│    │ (model router)│    │ (LLM client)           │   │
│  └──────┬───────┘    └───────────────┘    └─────────────────────────┘   │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────┐    ┌───────────────┐    ┌─────────────────────────┐   │
│  │ BaseEnv      │───▶│ llm_query()   │───▶│ UsageSummary           │   │
│  │ (REPL sandbox)│   │ (sub-LM calls)│    │ (cost tracking)        │   │
│  └──────────────┘    └───────────────┘    └─────────────────────────┘   │
│                                                                          │
├═══════════════════════════════════ ↕ ════════════════════════════════════┤
│                                                                          │
│                      Orchestra Architecture                              │
│                                                                          │
│  ┌──────────────┐    ┌───────────────┐    ┌─────────────────────────┐   │
│  │ stream_      │───▶│ Model         │───▶│ BaseChatModel           │   │
│  │ generator()  │    │ Middleware     │    │ (LangChain client)      │   │
│  │ (orchestrator)│   │ (model router)│    └─────────────────────────┘   │
│  └──────┬───────┘    └───────────────┘                                   │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────┐    ┌───────────────┐    ┌─────────────────────────┐   │
│  │ Daytona /    │───▶│ SubAgents     │───▶│ Compaction Heuristics   │   │
│  │ StateBackend │    │ (deepagents)  │    │ (token estimation)      │   │
│  │ (sandbox)    │    │ (sub-LM calls)│    └─────────────────────────┘   │
│  └──────────────┘    └───────────────┘                                   │
│                                                                          │
│  ┌──────────────┐    ┌───────────────┐                                   │
│  │ SSE Streaming│    │ PostgreSQL    │    ← No RLM equivalent           │
│  │ (real-time)  │    │ Checkpointing │                                   │
│  └──────────────┘    └───────────────┘                                   │
│                                                                          │
│  ┌──────────────┐                                                        │
│  │ .claude/     │    ← CLI-level RLM skill (not platform-level)         │
│  │ skills/rlm/  │                                                        │
│  └──────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.4 Summary

**Strong overlaps** (minimal bridging needed):
- Sandbox environments: Daytona already exists in both systems
- LLM client providers: Both support OpenAI, Anthropic, Google, etc.
- Iterative agent loops: Both use LM→execute→feedback patterns
- Depth-based model selection: SubAgent configs already accept per-agent models

**Moderate gaps** (addressable with design choices):
- REPL-resident context → use rlms directly or implement via tools
- Cost tracking → leverage rlms UsageSummary or add LangChain callbacks
- Final answer protocol → map FINAL to a "done" tool or natural end-of-turn

**Critical gaps** (require significant work):
- No streaming in RLM → blocks Orchestra's real-time UX
- No parallel sub-calls in Orchestra → limits RLM's speed advantage
- LLM client abstraction mismatch → needs adapter or shared configuration
