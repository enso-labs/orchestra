# Orchestra Architecture Analysis & Refactoring Guide

## Executive Summary

Orchestra is a full-stack AI agent orchestration platform built on LangGraph. This document maps the system architecture and identifies complexity hotspots ranked by refactoring priority.

---

## 1. High-Level Architecture

```mermaid
flowchart TB
    subgraph Clients
        FE[React Frontend<br/>chat.ruska.ai]
        CLI[TypeScript CLI<br/>react-ink]
        API_CLIENT[External API Clients]
    end

    subgraph Gateway["FastAPI Gateway"]
        AUTH[Auth Middleware<br/>JWT + OAuth2]
        ROUTES[API Routes<br/>/api/v0/*]
        MCP_SERVER[FastMCP Server<br/>/mcp/*]
        STATIC[Static Files<br/>SPA Fallback]
    end

    subgraph Core["Core Business Logic"]
        CTRL[Controllers<br/>LLMController]
        SVC[Services Layer<br/>ServiceContext]
        REPO[Repositories<br/>Data Access]
    end

    subgraph Agents["Agent Execution Engine"]
        ORCH[Orchestra<br/>LangGraph Wrapper]
        GRAPH[DeepAgent<br/>CompiledStateGraph]
        TOOLS[Tool Library<br/>Built-in + Custom + MCP]
        SUBAGENTS[SubAgents<br/>Nested Assistants]
        MW[Middleware<br/>Tracing, Memory]
    end

    subgraph Workers["Distributed Workers"]
        TASKIQ[TaskIQ Broker<br/>Redis Queue]
        WORKER[Worker Process<br/>Agent Execution]
        STREAM[Redis Streams<br/>SSE Output]
    end

    subgraph Storage["Persistence Layer"]
        PG[(PostgreSQL<br/>+ pgvector)]
        CHECKPOINT[LangGraph Saver<br/>Conversation State]
        STORE[LangGraph Store<br/>Entities + Vectors]
        MINIO[(MinIO<br/>File Storage)]
        REDIS[(Redis<br/>Cache + Queue)]
    end

    subgraph External["External Services"]
        LLM_PROVIDERS[LLM Providers<br/>OpenAI, Anthropic, etc]
        MCP_CLIENTS[MCP Servers<br/>External Tools]
        A2A[A2A Agents<br/>External Agents]
        SEARCH[Search APIs<br/>Tavily, SearXNG]
    end

    FE --> AUTH
    CLI --> AUTH
    API_CLIENT --> AUTH
    AUTH --> ROUTES
    AUTH --> MCP_SERVER

    ROUTES --> CTRL
    MCP_SERVER --> CTRL
    CTRL --> SVC
    SVC --> REPO
    REPO --> STORE
    REPO --> CHECKPOINT

    CTRL --> ORCH
    ORCH --> GRAPH
    GRAPH --> TOOLS
    GRAPH --> SUBAGENTS
    GRAPH --> MW

    TOOLS --> MCP_CLIENTS
    TOOLS --> A2A
    TOOLS --> SEARCH
    GRAPH --> LLM_PROVIDERS

    CTRL -.->|Distributed Mode| TASKIQ
    TASKIQ --> WORKER
    WORKER --> ORCH
    WORKER --> STREAM
    STREAM -.-> FE

    STORE --> PG
    CHECKPOINT --> PG
    SVC --> MINIO
    TASKIQ --> REDIS
```

---

## 2. Request Flow Architecture

### Synchronous LLM Invoke Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant R as Routes/llm.py
    participant CTRL as LLMController
    participant SVC as ServiceContext
    participant AGENT as Orchestra/Agent
    participant CP as Checkpoint Saver
    participant LLM as LLM Provider

    C->>R: POST /api/llm/invoke
    R->>R: verify_credentials()
    R->>CTRL: llm_invoke(request, user)
    CTRL->>SVC: assistant_service.get()
    SVC-->>CTRL: Assistant config
    CTRL->>CTRL: construct_agent()
    Note over CTRL: init_tools()<br/>init_subagents()<br/>init_system_prompt()
    CTRL->>AGENT: Orchestra.invoke()
    AGENT->>CP: Load checkpoint
    AGENT->>LLM: Generate response
    LLM-->>AGENT: LLM output
    AGENT->>AGENT: Execute tools if needed
    AGENT->>CP: Save checkpoint
    AGENT-->>CTRL: AgentState
    CTRL->>CTRL: format_response()
    CTRL-->>R: LLMResponse
    R-->>C: JSON Response
```

### Streaming SSE Flow (Distributed Workers)

```mermaid
sequenceDiagram
    participant C as Client
    participant R as Routes/llm.py
    participant TQ as TaskIQ Queue
    participant W as Worker Process
    participant RS as Redis Streams
    participant AGENT as Orchestra/Agent

    C->>R: POST /api/llm/stream
    R->>TQ: enqueue(run_agent_stream)
    TQ-->>R: task_id
    R-->>C: {thread_id, distributed: true}

    C->>R: GET /threads/{id}/stream
    R->>RS: Subscribe to stream

    W->>TQ: Dequeue task
    W->>AGENT: invoke with streaming
    loop For each chunk
        AGENT-->>W: Chunk
        W->>RS: Publish chunk
        RS-->>R: Chunk received
        R-->>C: SSE: data chunk
    end
    W->>RS: Signal completion
    RS-->>R: Stream end
    R-->>C: SSE: [DONE]
```

---

## 3. Data Architecture

```mermaid
erDiagram
    USERS ||--o{ THREADS : owns
    USERS ||--o{ ASSISTANTS : creates
    USERS ||--o{ TOOLS : defines
    USERS ||--o{ PROJECTS : owns
    USERS ||--o{ PROMPTS : creates

    ASSISTANTS ||--o{ THREADS : powers
    ASSISTANTS ||--o{ SUBAGENTS : contains
    ASSISTANTS }o--o{ TOOLS : uses

    THREADS ||--o{ CHECKPOINTS : has
    THREADS ||--o{ MESSAGES : contains

    PROJECTS ||--o{ ASSISTANTS : organizes

    USERS {
        uuid id PK
        string username
        string email
        string hashed_password
        timestamp created_at
    }

    ASSISTANTS {
        uuid id PK
        uuid user_id FK
        string name
        string slug
        text system_prompt
        text instructions
        string model
        json tools
        json mcp
        json a2a
        boolean public
    }

    THREADS {
        uuid thread_id PK
        uuid assistant_id FK
        uuid user_id FK
        json metadata
        timestamp created_at
    }

    CHECKPOINTS {
        string id PK
        uuid thread_id FK
        string checkpoint_id
        json values
        json metadata
    }

    TOOLS {
        uuid id PK
        uuid user_id FK
        string name
        text description
        json schema
        string handler
    }

    PROJECTS {
        uuid id PK
        uuid user_id FK
        string name
        text description
    }

    PROMPTS {
        uuid id PK
        uuid user_id FK
        string name
        text content
        json variables
    }
```

---

## 4. Component Dependency Graph

```mermaid
flowchart LR
    subgraph Routes["Routes Layer"]
        R_AUTH[auth.py]
        R_LLM[llm.py]
        R_THREAD[thread.py]
        R_ASST[assistant.py]
        R_TOOL[tool/]
        R_PROJ[project/]
    end

    subgraph Controllers["Controllers"]
        C_LLM[LLMController]
    end

    subgraph Services["Services Layer"]
        S_CTX[ServiceContext]
        S_ASST[AssistantService]
        S_LLM[LLMService]
        S_TOOL[ToolService]
        S_THREAD[ThreadService]
        S_PROJ[ProjectService]
        S_PROMPT[PromptService]
        S_MEM[MemoryService]
        S_SCHED[ScheduleService]
        S_CP[CheckpointService]
    end

    subgraph Repos["Repository Layer"]
        REPO_BASE[BaseRepo]
        REPO_USER[UserRepo]
        REPO_THREAD[ThreadRepo]
    end

    subgraph Agents["Agent Layer"]
        A_ORCH[Orchestra]
        A_GRAPH[init_graph]
        A_TOOLS[init_tools]
        A_SUB[init_subagents]
    end

    subgraph DB["Database Layer"]
        DB_STORE[AsyncPostgresStore]
        DB_SAVER[AsyncPostgresSaver]
        DB_ENGINE[SQLAlchemy Engine]
    end

    R_LLM --> C_LLM
    R_THREAD --> S_CTX
    R_ASST --> S_CTX
    R_TOOL --> S_CTX
    R_PROJ --> S_CTX

    C_LLM --> S_CTX
    C_LLM --> A_ORCH

    S_CTX --> S_ASST
    S_CTX --> S_LLM
    S_CTX --> S_TOOL
    S_CTX --> S_THREAD
    S_CTX --> S_PROJ
    S_CTX --> S_PROMPT
    S_CTX --> S_MEM
    S_CTX --> S_SCHED
    S_CTX --> S_CP

    S_ASST --> DB_STORE
    S_THREAD --> DB_STORE
    S_TOOL --> DB_STORE
    S_CP --> DB_SAVER

    A_ORCH --> A_GRAPH
    A_GRAPH --> A_TOOLS
    A_GRAPH --> A_SUB
    A_GRAPH --> DB_SAVER
    A_GRAPH --> DB_STORE

    REPO_BASE --> DB_ENGINE
    REPO_USER --> REPO_BASE
    REPO_THREAD --> DB_STORE

    style C_LLM fill:#ff6b6b
    style A_ORCH fill:#ff6b6b
    style A_GRAPH fill:#ff6b6b
    style S_CTX fill:#feca57
    style DB_STORE fill:#feca57
```

**Legend:** Red = High Complexity | Yellow = Medium Complexity

---

## 5. Complexity Hotspots Ranking

### Priority Matrix

| Rank | Component | Complexity Score | Impact | Effort | Key Files |
|------|-----------|------------------|--------|--------|-----------|
| **1** | Agent Construction Pipeline | 9/10 | Critical | High | `src/agents/__init__.py`, `src/controllers/llm.py` |
| **2** | Service Dependency Injection | 8/10 | High | Medium | `src/contexts/service.py` |
| **3** | Database Store Abstraction | 8/10 | High | High | `src/services/db.py`, `src/repos/` |
| **4** | Streaming & Worker Logic | 7/10 | High | Medium | `src/utils/stream.py`, `src/workers/tasks.py` |
| **5** | Error Handling & Retry | 7/10 | Medium | Medium | `src/services/errors.py`, `src/services/checkpoint_resilient.py` |
| **6** | Tool Plugin System | 6/10 | Medium | Medium | `src/tools/` |
| **7** | API Route Organization | 5/10 | Medium | Low | `src/routes/v0/` |
| **8** | Frontend State Management | 5/10 | Medium | Low | `frontend/src/context/` |
| **9** | Testing Infrastructure | 4/10 | Medium | Low | `backend/tests/` |
| **10** | Frontend Components | 3/10 | Low | Low | `frontend/src/components/` |

---

## 6. Detailed Hotspot Analysis

### Hotspot #1: Agent Construction Pipeline (CRITICAL)

**Location:** `backend/src/agents/__init__.py:1-400`

```mermaid
flowchart TD
    CA[construct_agent] --> IT[init_tools]
    CA --> IS[init_subagents]
    CA --> ISP[init_system_prompt]
    CA --> IM[init_middleware]
    CA --> IG[init_graph]

    IT --> DT[default_tools]
    IT --> AT[auth_tools]
    IT --> OT[optional_tools]
    IT --> MCP[load_mcp_tools]
    IT --> A2A[load_a2a_agents]
    IT --> UT[user_tools from DB]

    IS --> SG[Sub-graph creation]
    ISP --> ML[Memory loading]
    ISP --> PF[Prompt formatting]

    IG --> DAG[create_deep_agent]
    DAG --> CS[Checkpoint saver]
    DAG --> ST[Store connection]

    style CA fill:#ff6b6b
    style IT fill:#ff6b6b
    style IG fill:#ff6b6b
```

**Problems:**
1. `construct_agent()` has 6+ responsibilities (violates SRP)
2. `init_tools()` has complex conditional logic for 6 tool sources
3. No clear separation between configuration and execution
4. Hard to test individual parts
5. Middleware initialization is opaque

**Recommended Refactoring:**

```python
# Before: Monolithic function
def construct_agent(request, assistant, config, store, saver):
    tools = init_tools(...)  # 100+ lines
    subagents = init_subagents(...)  # 50+ lines
    prompt = init_system_prompt(...)  # 30+ lines
    middleware = init_middleware(...)  # 20+ lines
    return init_graph(...)

# After: Builder pattern with composable parts
class AgentBuilder:
    def with_tools(self, tool_config: ToolConfig) -> Self
    def with_subagents(self, subagent_defs: list[Assistant]) -> Self
    def with_memory(self, memory_config: MemoryConfig) -> Self
    def with_middleware(self, middleware_chain: list[Middleware]) -> Self
    def build(self) -> Orchestra

# Usage
agent = (AgentBuilder(assistant, config)
    .with_tools(ToolConfig(user=user_tools, mcp=mcp_config))
    .with_subagents(assistant.subagents)
    .with_memory(MemoryConfig(store=store))
    .with_middleware([TracingMiddleware(), RetryMiddleware()])
    .build())
```

---

### Hotspot #2: Service Dependency Injection

**Location:** `backend/src/contexts/service.py`

**Problems:**
1. All services instantiated on every request (even if unused)
2. Circular dependency risk between services
3. No interface contracts (hard to mock)
4. Implicit initialization order

**Current State:**
```python
class ServiceContext:
    def __init__(self, user_id: str, store: AsyncPostgresStore):
        self.assistant_service = AssistantService(store, user_id)
        self.llm_service = LLMService(store, user_id)
        self.tool_service = ToolService(store, user_id)
        # ... 5 more services
```

**Recommended Refactoring:**
```python
# Lazy initialization with protocols
class ServiceContext:
    @cached_property
    def assistant_service(self) -> IAssistantService:
        return AssistantService(self._store, self._user_id)

    @cached_property
    def tool_service(self) -> IToolService:
        return ToolService(self._store, self._user_id)
```

---

### Hotspot #3: Database Store Abstraction

**Location:** `backend/src/services/db.py`, `backend/src/repos/`

**Problems:**
1. Two persistence patterns: SQLAlchemy (users) vs LangGraph Store (everything else)
2. No unified query interface
3. Hard to add new storage backends
4. Semantic search mixed with CRUD operations

**Diagram:**

```mermaid
flowchart LR
    subgraph Current["Current State"]
        SA[SQLAlchemy ORM]
        LS[LangGraph Store]

        SA --> USERS[(users table)]
        LS --> ENTITIES[(entities + vectors)]
    end

    subgraph Target["Target State"]
        IDS[IDataStore Interface]

        IDS --> PG_ADAPTER[PostgresAdapter]
        IDS --> MEM_ADAPTER[InMemoryAdapter]
        IDS --> DUCK_ADAPTER[DuckDBAdapter]
    end
```

---

### Hotspot #4: Streaming & Worker Logic

**Location:** `backend/src/utils/stream.py`, `backend/src/workers/tasks.py`

**Problems:**
1. Two parallel streaming paths (direct vs distributed)
2. SSE formatting mixed with business logic
3. Redis stream management scattered
4. Complex error recovery

**Recommended Refactoring:**
- Create `StreamingPipeline` abstraction
- Extract `RedisStreamManager`
- Unify direct and worker paths through common interface

---

### Hotspot #5: Tool Plugin System

**Location:** `backend/src/tools/`

```mermaid
flowchart TD
    TL[Tool Library] --> DT[Default Tools]
    TL --> AT[Auth Tools]
    TL --> OT[Optional Tools]
    TL --> CT[Custom Tools]
    TL --> MT[MCP Tools]
    TL --> AA[A2A Agents]

    DT --> SEARCH[search.py]
    DT --> CODE[code.py]
    DT --> FIN[finance/]

    AT --> TEAMS[ms_teams/]
    OT --> BASH[bash_tool.py]

    CT --> DB[(Store)]
    MT --> EXT[External MCP Servers]
    AA --> EXT_AGENTS[External Agents]

    style TL fill:#feca57
```

**Problems:**
1. Tool registration scattered across 4+ files
2. No plugin discovery mechanism
3. Manual metadata injection
4. Hard to extend with external packages

---

## 7. Recommended Refactoring Order

```mermaid
gantt
    title Refactoring Roadmap
    dateFormat  X
    axisFormat %s

    section Phase 1: Foundation
    Agent Builder Pattern     :a1, 0, 3
    Service DI Container      :a2, 0, 2

    section Phase 2: Data Layer
    DataStore Abstraction     :b1, 3, 4
    Repository Unification    :b2, 4, 2

    section Phase 3: Runtime
    Streaming Pipeline        :c1, 6, 2
    Error Handler Middleware  :c2, 7, 2

    section Phase 4: Extensibility
    Tool Registry             :d1, 9, 2
    Plugin Discovery          :d2, 10, 2

    section Phase 5: Polish
    API Controller Layer      :e1, 11, 1
    Frontend State Refactor   :e2, 11, 2
    Test Infrastructure       :e3, 12, 1
```

---

## 8. Key File Paths Reference

### Critical Files (Start Here)

| Purpose | Path |
|---------|------|
| FastAPI Entry | `backend/main.py` |
| Agent Construction | `backend/src/agents/__init__.py` |
| LLM Controller | `backend/src/controllers/llm.py` |
| Service Context | `backend/src/contexts/service.py` |
| Database Setup | `backend/src/services/db.py` |

### Routes Layer

| Domain | Path |
|--------|------|
| Authentication | `backend/src/routes/v0/auth.py` |
| LLM Execution | `backend/src/routes/v0/llm.py` |
| Threads | `backend/src/routes/v0/thread.py` |
| Assistants | `backend/src/routes/v0/assistant.py` |
| Tools | `backend/src/routes/v0/tool/` |
| Projects | `backend/src/routes/v0/project/` |

### Services Layer

| Service | Path |
|---------|------|
| Assistant | `backend/src/services/assistant.py` |
| Thread | `backend/src/services/thread.py` |
| Tool | `backend/src/services/tool.py` |
| Checkpoint | `backend/src/services/checkpoint.py` |
| Memory | `backend/src/services/memory.py` |
| Streaming | `backend/src/utils/stream.py` |

### Tools

| Tool Category | Path |
|---------------|------|
| Search | `backend/src/tools/search.py` |
| Code Execution | `backend/src/tools/code.py` |
| Bash | `backend/src/tools/bash_tool.py` |
| Finance | `backend/src/tools/finance/` |
| MS Teams | `backend/src/tools/ms_teams/` |
| A2A Protocol | `backend/src/tools/a2a.py` |

### Frontend

| Component | Path |
|-----------|------|
| Chat Page | `frontend/src/pages/chat/` |
| Agent Context | `frontend/src/context/AgentContext.tsx` |
| Chat Context | `frontend/src/context/ChatContext.tsx` |
| API Services | `frontend/src/lib/services/` |

### Configuration

| File | Purpose |
|------|---------|
| `backend/pyproject.toml` | Python dependencies |
| `frontend/package.json` | npm dependencies |
| `docker-compose.yml` | Service orchestration |
| `backend/src/constants/__init__.py` | Environment config |

---

## 9. Metrics for Success

After refactoring, measure:

1. **Test Coverage**: Target 80%+ for critical paths
2. **Cyclomatic Complexity**: Reduce `construct_agent()` from ~15 to <5
3. **Time to Add New Tool**: Should be <30 minutes with plugin system
4. **Request Latency**: Maintain p95 < 200ms for non-LLM operations
5. **Developer Onboarding**: New contributor productive in <1 day

---

## 10. Next Steps

1. **Immediate**: Review `backend/src/agents/__init__.py` - the highest complexity area
2. **Short-term**: Design `AgentBuilder` interface and prototype
3. **Medium-term**: Implement `IDataStore` abstraction for testing
4. **Long-term**: Full plugin system with external tool packages

---

*Generated: 2026-01-25*
*Branch: claude/app-architecture-analysis-XaiKI*
