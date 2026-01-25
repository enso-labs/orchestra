# Progressive Refactoring Workflow

## Overview

This document defines a repeatable workflow for systematically refactoring Orchestra's codebase. Use this prompt template with each complexity hotspot to ensure consistent, maintainable, and extensible improvements.

---

## Workflow Prompt Template

Copy and customize the following prompt for each refactoring iteration:

---

### REFACTORING PROMPT

```
You are refactoring the Orchestra codebase to improve maintainability and extensibility.

## Current Target

**Component**: [COMPONENT_NAME]
**Priority**: [P0|P1|P2|P3]
**Complexity Score**: [X/10]
**Primary Files**:
- [file_path_1]
- [file_path_2]

## Reference Documents

Before starting, read:
1. `docs/ARCHITECTURE_ANALYSIS.md` - Understand the full system architecture
2. `AGENTS.md` - Follow project coding standards
3. The target files listed above

## Refactoring Objectives

1. **Single Responsibility**: Each class/function should have one clear purpose
2. **Dependency Injection**: Remove hard-coded dependencies, use interfaces
3. **Testability**: Ensure all components can be unit tested in isolation
4. **Extensibility**: New features should be additive, not require modification
5. **Backward Compatibility**: Existing API contracts must be preserved

## Phase 1: Analysis (Do Not Write Code Yet)

### Step 1.1: Map Current State
- Read all target files completely
- Identify all public interfaces (functions, classes, types)
- Document current responsibilities of each component
- List all dependencies (imports, injected services, external calls)
- Find all consumers of this component (who calls it?)

### Step 1.2: Identify Code Smells
Check for these specific issues:
- [ ] God classes/functions (>200 lines or >5 responsibilities)
- [ ] Tight coupling (direct instantiation instead of injection)
- [ ] Mixed abstraction levels (business logic + infrastructure)
- [ ] Duplicate logic across files
- [ ] Missing interfaces/protocols
- [ ] Hardcoded configuration values
- [ ] Side effects in constructors
- [ ] Circular dependencies

### Step 1.3: Define Target Architecture
- Propose new file/class structure
- Define interfaces/protocols for each component
- Specify dependency injection points
- Document breaking changes (if any)

## Phase 2: Design (Present Plan Before Implementation)

### Step 2.1: Create Design Document
Present the following before writing code:

```markdown
## Refactoring Design: [Component Name]

### Current Problems
1. [Problem 1]
2. [Problem 2]

### Proposed Changes
| Current | Proposed | Rationale |
|---------|----------|-----------|
| [old]   | [new]    | [why]     |

### New File Structure
```
[directory]/
├── [new_file_1].py  # [purpose]
├── [new_file_2].py  # [purpose]
└── interfaces/
    └── [interface].py
```

### Interface Definitions
```python
class IComponentName(Protocol):
    def method_a(self, arg: Type) -> ReturnType: ...
```

### Migration Strategy
1. [Step 1]
2. [Step 2]

### Risk Assessment
- Breaking changes: [Yes/No, details]
- Test coverage gaps: [List]
- Rollback plan: [Description]
```

### Step 2.2: Await Approval
Wait for user confirmation before proceeding to implementation.

## Phase 3: Implementation

### Step 3.1: Create Interfaces First
- Define Protocol/ABC classes for all new abstractions
- Place in dedicated `interfaces/` or `protocols/` module
- Include comprehensive docstrings

### Step 3.2: Implement New Components
- Create new implementations that satisfy interfaces
- Keep old code functional during transition
- Use feature flags if needed for gradual rollout

### Step 3.3: Migrate Consumers
- Update all files that import/use the refactored component
- Ensure type hints are correct
- Run type checker: `make typecheck` or `mypy src/`

### Step 3.4: Add/Update Tests
- Unit tests for each new component
- Integration tests for the refactored flow
- Ensure existing tests still pass

### Step 3.5: Clean Up
- Remove deprecated code (only after all consumers migrated)
- Update imports across the codebase
- Run formatter: `make format`

## Phase 4: Validation

### Step 4.1: Run Test Suite
```bash
cd backend && make test
```

### Step 4.2: Type Check
```bash
cd backend && uv run mypy src/
```

### Step 4.3: Manual Verification
- Test the primary user flow affected by changes
- Verify no regressions in related features

### Step 4.4: Documentation
- Update docstrings
- Add inline comments for complex logic
- Update `docs/ARCHITECTURE_ANALYSIS.md` if structure changed

## Phase 5: Commit

### Step 5.1: Stage Changes
```bash
git add -A
git status  # Review changes
```

### Step 5.2: Commit with Descriptive Message
```bash
git commit -m "refactor([component]): [summary]

- [Change 1]
- [Change 2]

Breaking changes: [None | Description]
"
```

### Step 5.3: Push
```bash
git push -u origin [branch-name]
```

## Quality Gates (Must Pass Before Completion)

- [ ] All tests pass
- [ ] No new type errors
- [ ] Code formatted (`make format`)
- [ ] No circular imports
- [ ] Interfaces defined for new abstractions
- [ ] At least one test per new public function
- [ ] No increase in cyclomatic complexity
- [ ] Backward compatible (or breaking changes documented)

## Output Deliverables

1. **Refactored code** committed to branch
2. **Updated tests** covering new components
3. **Updated architecture diagram** if structure changed
4. **Migration notes** if breaking changes introduced
```

---

## Hotspot-Specific Prompts

Below are pre-configured prompts for each identified complexity hotspot. Use these in order.

---

### Hotspot #1: Agent Construction Pipeline

```
You are refactoring the Orchestra codebase to improve maintainability and extensibility.

## Current Target

**Component**: Agent Construction Pipeline
**Priority**: P0 (Critical)
**Complexity Score**: 9/10
**Primary Files**:
- backend/src/agents/__init__.py
- backend/src/controllers/llm.py

## Specific Problems to Solve

1. `construct_agent()` has 6+ responsibilities:
   - Tool initialization
   - Subagent initialization
   - System prompt formatting
   - Memory loading
   - Middleware setup
   - Graph construction

2. `init_tools()` has complex conditionals for 6 tool sources:
   - Default tools
   - Auth tools
   - Optional tools
   - User-defined tools (from DB)
   - MCP tools (external)
   - A2A agents (external)

3. No clear separation between configuration and execution

## Target Architecture

Implement Builder Pattern:

```python
# Target API
agent = (
    AgentBuilder(assistant_config)
    .with_tools(ToolComposer()
        .add_defaults()
        .add_user_tools(user_id)
        .add_mcp(mcp_config)
        .build())
    .with_subagents(SubAgentFactory.create(assistant.subagents))
    .with_memory(MemoryLoader(store, user_id))
    .with_middleware(MiddlewareChain.default())
    .with_checkpoint(saver)
    .build()
)
```

## New File Structure

```
backend/src/agents/
├── __init__.py           # Public exports only
├── builder.py            # AgentBuilder class
├── orchestra.py          # Orchestra wrapper (existing)
├── tools/
│   ├── __init__.py
│   ├── composer.py       # ToolComposer
│   ├── registry.py       # ToolRegistry (singleton)
│   └── loaders/
│       ├── default.py
│       ├── mcp.py
│       └── a2a.py
├── subagents/
│   ├── __init__.py
│   └── factory.py        # SubAgentFactory
├── middleware/
│   ├── __init__.py
│   ├── chain.py          # MiddlewareChain
│   └── defaults.py       # Default middleware
└── prompts/
    ├── __init__.py
    └── formatter.py      # SystemPromptFormatter
```

## Constraints

- Maintain backward compatibility with existing `construct_agent()` API
- Keep `Orchestra` class interface unchanged
- All new components must have Protocol/interface definitions

Follow the standard refactoring workflow phases (Analysis → Design → Implementation → Validation → Commit).
```

---

### Hotspot #2: Service Dependency Injection

```
You are refactoring the Orchestra codebase to improve maintainability and extensibility.

## Current Target

**Component**: Service Dependency Injection
**Priority**: P0
**Complexity Score**: 8/10
**Primary Files**:
- backend/src/contexts/service.py
- backend/src/services/*.py

## Specific Problems to Solve

1. All 8+ services instantiated on every request (even if unused)
2. No interface contracts (hard to mock in tests)
3. Circular dependency risk between services
4. Implicit initialization order

## Target Architecture

Implement lazy loading with Protocol interfaces:

```python
# Interfaces (new file: backend/src/services/interfaces.py)
class IAssistantService(Protocol):
    async def get(self, id: str) -> Assistant: ...
    async def create(self, data: AssistantCreate) -> Assistant: ...

class IToolService(Protocol):
    async def list(self, user_id: str) -> list[Tool]: ...

# ServiceContext with lazy loading
class ServiceContext:
    def __init__(self, user_id: str, store: AsyncPostgresStore):
        self._user_id = user_id
        self._store = store
        self._cache: dict[str, Any] = {}

    @cached_property
    def assistant(self) -> IAssistantService:
        return AssistantService(self._store, self._user_id)

    @cached_property
    def tool(self) -> IToolService:
        return ToolService(self._store, self._user_id)
```

## New File Structure

```
backend/src/services/
├── __init__.py
├── interfaces.py         # All Protocol definitions
├── context.py            # ServiceContext (refactored)
├── assistant.py          # Implements IAssistantService
├── tool.py               # Implements IToolService
├── thread.py             # Implements IThreadService
└── ...
```

## Testing Requirement

Create mock implementations for all interfaces in `backend/tests/mocks/services.py`.

Follow the standard refactoring workflow phases.
```

---

### Hotspot #3: Database Store Abstraction

```
You are refactoring the Orchestra codebase to improve maintainability and extensibility.

## Current Target

**Component**: Database Store Abstraction
**Priority**: P1
**Complexity Score**: 8/10
**Primary Files**:
- backend/src/services/db.py
- backend/src/repos/*.py

## Specific Problems to Solve

1. Two persistence patterns: SQLAlchemy (users) vs LangGraph Store (everything else)
2. No unified query interface
3. Hard to add new storage backends (e.g., SQLite for local dev)
4. Semantic search mixed with CRUD operations

## Target Architecture

Create abstract DataStore interface:

```python
# backend/src/repos/interfaces.py
class IDataStore(Protocol):
    """Unified interface for all data operations."""

    async def get(self, namespace: str, key: str) -> dict | None: ...
    async def put(self, namespace: str, key: str, value: dict) -> None: ...
    async def delete(self, namespace: str, key: str) -> None: ...
    async def search(
        self,
        namespace: str,
        filters: dict | None = None,
        limit: int = 100,
        offset: int = 0
    ) -> list[dict]: ...
    async def semantic_search(
        self,
        namespace: str,
        query: str,
        limit: int = 10
    ) -> list[dict]: ...

# Implementations
class PostgresStore(IDataStore): ...      # Production
class InMemoryStore(IDataStore): ...      # Testing
class SQLiteStore(IDataStore): ...        # Local development
```

## New File Structure

```
backend/src/repos/
├── __init__.py
├── interfaces.py         # IDataStore, IRepository
├── base.py               # BaseRepository
├── stores/
│   ├── __init__.py
│   ├── postgres.py       # PostgresStore (wraps LangGraph)
│   ├── memory.py         # InMemoryStore
│   └── sqlite.py         # SQLiteStore (future)
├── user.py               # UserRepository (SQLAlchemy)
├── assistant.py          # AssistantRepository
├── thread.py             # ThreadRepository
└── tool.py               # ToolRepository
```

Follow the standard refactoring workflow phases.
```

---

### Hotspot #4: Streaming & Worker Logic

```
You are refactoring the Orchestra codebase to improve maintainability and extensibility.

## Current Target

**Component**: Streaming & Worker Logic
**Priority**: P1
**Complexity Score**: 7/10
**Primary Files**:
- backend/src/utils/stream.py
- backend/src/workers/tasks.py
- backend/src/routes/v0/llm.py

## Specific Problems to Solve

1. Two parallel streaming paths (direct SSE vs distributed worker)
2. SSE formatting mixed with business logic
3. Redis stream management scattered across files
4. Complex error recovery duplicated

## Target Architecture

Unify streaming through common pipeline:

```python
# backend/src/streaming/pipeline.py
class StreamingPipeline(Protocol):
    async def stream(
        self,
        agent: Orchestra,
        request: LLMRequest,
        config: RunnableConfig
    ) -> AsyncIterator[StreamChunk]: ...

class DirectStreamingPipeline(StreamingPipeline):
    """Streams directly to client via SSE."""

class DistributedStreamingPipeline(StreamingPipeline):
    """Streams via Redis for worker-based execution."""

# backend/src/streaming/formatter.py
class StreamFormatter:
    def to_sse(self, chunk: StreamChunk) -> str: ...
    def to_json(self, chunk: StreamChunk) -> dict: ...

# backend/src/streaming/redis_manager.py
class RedisStreamManager:
    async def publish(self, stream_id: str, chunk: StreamChunk): ...
    async def subscribe(self, stream_id: str) -> AsyncIterator[StreamChunk]: ...
```

## New File Structure

```
backend/src/streaming/
├── __init__.py
├── interfaces.py         # StreamingPipeline protocol
├── pipeline.py           # DirectStreamingPipeline
├── distributed.py        # DistributedStreamingPipeline
├── formatter.py          # StreamFormatter
├── redis_manager.py      # RedisStreamManager
└── chunks.py             # StreamChunk types
```

Follow the standard refactoring workflow phases.
```

---

### Hotspot #5: Error Handling & Retry Logic

```
You are refactoring the Orchestra codebase to improve maintainability and extensibility.

## Current Target

**Component**: Error Handling & Retry Logic
**Priority**: P1
**Complexity Score**: 7/10
**Primary Files**:
- backend/src/services/errors.py
- backend/src/services/checkpoint_resilient.py
- backend/src/workers/tasks.py

## Specific Problems to Solve

1. Error handling scattered across services
2. Retry logic duplicated (checkpoint + worker level)
3. No unified error response format
4. HITL (Human-In-The-Loop) interrupt logic is implicit

## Target Architecture

Centralized error handling with classification:

```python
# backend/src/errors/types.py
class ErrorCategory(Enum):
    TRANSIENT = "transient"      # Retry automatically
    PERMANENT = "permanent"      # Fail immediately
    INTERRUPT = "interrupt"      # HITL required

@dataclass
class OrchestraError:
    category: ErrorCategory
    code: str
    message: str
    details: dict | None = None
    retry_after: int | None = None  # For transient errors

# backend/src/errors/handler.py
class ErrorHandler:
    def classify(self, error: Exception) -> OrchestraError: ...
    def should_retry(self, error: OrchestraError) -> bool: ...
    def to_response(self, error: OrchestraError) -> dict: ...

# backend/src/errors/retry.py
class RetryPolicy:
    max_attempts: int = 3
    base_delay: float = 1.0
    max_delay: float = 30.0
    exponential_base: float = 2.0

    async def execute[T](
        self,
        operation: Callable[[], Awaitable[T]],
        on_retry: Callable[[Exception, int], None] | None = None
    ) -> T: ...
```

## New File Structure

```
backend/src/errors/
├── __init__.py
├── types.py              # ErrorCategory, OrchestraError
├── handler.py            # ErrorHandler
├── retry.py              # RetryPolicy
├── middleware.py         # FastAPI exception handlers
└── hitl.py               # HITL state machine
```

Follow the standard refactoring workflow phases.
```

---

### Hotspot #6: Tool Plugin System

```
You are refactoring the Orchestra codebase to improve maintainability and extensibility.

## Current Target

**Component**: Tool Plugin System
**Priority**: P2
**Complexity Score**: 6/10
**Primary Files**:
- backend/src/tools/__init__.py
- backend/src/tools/*.py

## Specific Problems to Solve

1. Tool registration scattered (default_tools(), auth_tools(), optional_tools())
2. No plugin discovery mechanism
3. Manual metadata injection
4. Hard to extend with external packages

## Target Architecture

Unified tool registry with plugin discovery:

```python
# backend/src/tools/registry.py
class ToolRegistry:
    _tools: dict[str, ToolDefinition] = {}

    @classmethod
    def register(cls, name: str, category: str = "default"):
        """Decorator for registering tools."""
        def decorator(func: Callable) -> Callable:
            cls._tools[name] = ToolDefinition(
                name=name,
                func=func,
                category=category,
                schema=generate_schema(func)
            )
            return func
        return decorator

    @classmethod
    def get_tools(
        cls,
        categories: list[str] | None = None,
        user_context: UserContext | None = None
    ) -> list[BaseTool]: ...

    @classmethod
    def discover_plugins(cls, entry_point: str = "orchestra.tools"): ...

# Usage
@ToolRegistry.register("web_search", category="search")
async def web_search(query: str) -> str:
    """Search the web for information."""
    ...
```

## New File Structure

```
backend/src/tools/
├── __init__.py           # Public exports
├── registry.py           # ToolRegistry
├── definition.py         # ToolDefinition dataclass
├── loader.py             # Plugin discovery
├── builtin/
│   ├── __init__.py
│   ├── search.py
│   ├── code.py
│   ├── bash.py
│   └── memory.py
├── external/
│   ├── __init__.py
│   ├── mcp.py            # MCP tool loader
│   └── a2a.py            # A2A agent loader
└── user/
    ├── __init__.py
    └── custom.py         # User-defined tools from DB
```

Follow the standard refactoring workflow phases.
```

---

## Workflow Execution Checklist

Use this checklist when executing each hotspot refactoring:

```markdown
## Refactoring: [Component Name]
Date: [YYYY-MM-DD]
Branch: [branch-name]

### Pre-flight
- [ ] Read `docs/ARCHITECTURE_ANALYSIS.md`
- [ ] Read `AGENTS.md`
- [ ] Read all target files
- [ ] Identify all consumers of this component

### Analysis Complete
- [ ] Current state documented
- [ ] Code smells identified
- [ ] Target architecture defined

### Design Approved
- [ ] Design document created
- [ ] User approved design
- [ ] Breaking changes identified

### Implementation Complete
- [ ] Interfaces created
- [ ] New components implemented
- [ ] Consumers migrated
- [ ] Tests added/updated

### Validation Passed
- [ ] `make test` passes
- [ ] `make format` applied
- [ ] Type check passes
- [ ] Manual testing done

### Committed
- [ ] Changes committed with descriptive message
- [ ] Pushed to branch
- [ ] Architecture docs updated if needed
```

---

## Progressive Refactoring Schedule

| Sprint | Hotspot | Estimated Complexity |
|--------|---------|---------------------|
| 1 | Agent Construction Pipeline | High |
| 2 | Service Dependency Injection | Medium |
| 3 | Database Store Abstraction | High |
| 4 | Streaming & Worker Logic | Medium |
| 5 | Error Handling & Retry | Medium |
| 6 | Tool Plugin System | Medium |
| 7 | API Route Organization | Low |
| 8 | Frontend State Management | Low |

---

## Success Metrics

After completing all hotspots, measure:

| Metric | Before | Target |
|--------|--------|--------|
| Test Coverage | ~40% | >80% |
| Avg Cyclomatic Complexity | ~15 | <5 |
| Time to Add New Tool | ~2 hours | <30 min |
| Time to Onboard Developer | ~1 week | <1 day |
| Build Time | baseline | <10% increase |

---

*Last Updated: 2026-01-25*
