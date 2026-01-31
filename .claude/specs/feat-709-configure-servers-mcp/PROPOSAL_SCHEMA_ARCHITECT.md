# PROPOSAL: Schema Architecture for GitHub Issue #709
## FEAT: Users should be able to configure Servers (MCP)

**Agent:** AGENT_1 - SCHEMA_ARCHITECT
**Date:** 2026-01-30
**Status:** PROPOSAL

---

## 1. Executive Summary

This proposal defines the data model and migration strategy for allowing users to create reusable MCP server configurations, assign them to assistants, and select tools from those servers. The system currently uses LangGraph's `BaseStore` (a key-value/document store) for assistants and tools -- not traditional SQL tables. The only SQL-backed entities are `users` and `tokens`. This architectural reality fundamentally shapes the approach.

**Key insight:** Assistants and tools live in a namespace-scoped document store (`(user_id, "assistants")`, `(user_id, "tools")`). MCP server configurations should follow the same pattern for consistency, using the store with a new `"mcp_servers"` entity type. The assistant-to-server relationship is best expressed as a field on the Assistant document rather than a junction table.

---

## 2. Architectural Analysis

### 2.1 Current Data Architecture

The codebase uses a **hybrid storage** model:

| Layer | Storage | Entities |
|-------|---------|----------|
| SQL (Alembic/SQLAlchemy) | PostgreSQL tables | `users`, `tokens` |
| Document Store (LangGraph BaseStore) | PostgreSQL-backed KV store | `assistants`, `tools`, `projects`, `sources`, `documents`, `api_tokens` |

**Assistants** are stored as JSON documents in the LangGraph store under namespace `(user_id, "assistants")` with a UUID key. The `Assistant` Pydantic model already has an `mcp: Optional[dict] = {}` field that holds inline MCP server configs as `dict[str, McpServer]`.

**Tools** follow the same store pattern under `(user_id, "tools")`. The `SavedTool` model supports `type="mcp"` with `config.mcp_tool` holding server connection details.

### 2.2 Current MCP Flow

Today, MCP configs are embedded directly in the Assistant's `mcp` field as a dict of `{server_name: {transport, url, headers}}`. This is passed to `MultiServerMCPClient` at inference time. There is no reusability -- each assistant carries its own copy of the config.

### 2.3 Existing Patterns

- **Repos** extend `BaseRepo` which wraps the LangGraph store with `_get_namespace()`, `_set()`, `_get()`, `_search()`, `_delete()`.
- **Services** instantiate repos and add business logic.
- **Controllers** handle HTTP request/response.
- **Routes** define FastAPI endpoints.
- **Schemas** are Pydantic models in `src/schemas/entities/`.

---

## 3. Implementation Strategy

### 3.1 New Pydantic Entity: `McpServerConfig`

Location: `/backend/src/schemas/entities/mcp.py`

```python
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class McpServerConfig(BaseModel):
    """A reusable, named MCP server configuration owned by a user."""
    id: Optional[str] = None
    name: str = Field(..., description="Unique display name for this server config")
    description: Optional[str] = Field(default="", description="What this server provides")
    transport: Literal["sse", "streamable_http", "stdio"] = Field(
        default="sse", description="MCP transport protocol"
    )
    url: str = Field(..., description="Server URL or command path")
    headers: dict[str, str] = Field(default_factory=dict, description="Auth/custom headers")
    env: Optional[dict[str, str]] = Field(
        default=None, description="Environment variables (encrypted at rest)"
    )
    metadata: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    disabled: bool = Field(default=False)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
```

**Design rationale:**
- Matches the shape of `McpServer` from `a2a.py` (transport, url, headers) but adds identity fields (id, name, description) for reusability.
- `env` field mirrors the `SavedTool.env` pattern and will be encrypted using the existing `encrypt_value`/`decrypt_value` utilities.
- `tags` and `metadata` follow the `SavedTool` convention.

### 3.2 New Pydantic Entity: `McpServerConfigCreate` / `McpServerConfigUpdate`

```python
class McpServerConfigCreate(BaseModel):
    """Request body for creating an MCP server config."""
    name: str
    description: Optional[str] = ""
    transport: Literal["sse", "streamable_http", "stdio"] = "sse"
    url: str
    headers: dict[str, str] = Field(default_factory=dict)
    env: Optional[dict[str, str]] = None
    metadata: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class McpServerConfigUpdate(BaseModel):
    """Request body for updating an MCP server config. All fields optional."""
    name: Optional[str] = None
    description: Optional[str] = None
    transport: Optional[Literal["sse", "streamable_http", "stdio"]] = None
    url: Optional[str] = None
    headers: Optional[dict[str, str]] = None
    env: Optional[dict[str, str]] = None
    metadata: Optional[dict] = None
    tags: Optional[list[str]] = None
    disabled: Optional[bool] = None
```

### 3.3 New Repository: `McpServerRepo`

Location: `/backend/src/repos/mcp_server_repo.py`

Follows `ToolRepo` pattern (which does not extend `BaseRepo` but directly wraps the store). Key design:

- **Namespace:** `(user_id, "mcp_servers")`
- **Key:** `server_config.name` (unique per user, used as store key -- matching how `ToolRepo` uses `tool.name`)
- **Encryption:** `env` field encrypted on write, decrypted on read (same as `ToolRepo.env`)
- **Methods:** `create()`, `get()`, `update()`, `delete()`, `search()`, `get_as_mcp_dict()` (returns `dict[str, McpServer]` format for `MultiServerMCPClient`)

### 3.4 Assistant Schema Changes

The `Assistant` model already has `mcp: Optional[dict] = {}`. The proposal is to add a parallel field:

```python
class Assistant(BaseModel):
    # ... existing fields ...
    mcp: Optional[dict] = {}                    # Keep for backward compat (inline configs)
    mcp_servers: Optional[list[str]] = Field(   # NEW: references to saved configs by name
        default_factory=list,
        description="Names of saved MCP server configs assigned to this assistant"
    )
```

**Why `list[str]` of names, not IDs?**
- The store keys MCP configs by name (matching the `ToolRepo` pattern where tools are keyed by name).
- Names are human-readable and match how `MultiServerMCPClient` expects its dict keys.
- At runtime, the service resolves names to full configs from the store.

**Backward compatibility:** The existing `mcp` field stays. At inference time, the service merges inline `mcp` configs with resolved `mcp_servers` configs, giving precedence to inline overrides. This allows a gradual migration.

### 3.5 Service Layer: `McpServerService`

Location: `/backend/src/services/mcp_server.py`

```
McpServerService
  +-- create(config: McpServerConfigCreate) -> McpServerConfig
  +-- get(name: str) -> McpServerConfig | None
  +-- update(name: str, data: McpServerConfigUpdate) -> bool
  +-- delete(name: str) -> bool
  +-- list(limit, offset) -> list[McpServerConfig]
  +-- resolve_for_assistant(assistant: Assistant) -> dict[str, McpServer]
  +-- discover_tools(server_names: list[str]) -> dict[str, list[ToolInfo]]
```

The `resolve_for_assistant()` method merges `assistant.mcp` (inline) with resolved `assistant.mcp_servers` (saved configs), producing the final `dict[str, McpServer]` that `MultiServerMCPClient` expects.

The `discover_tools()` method connects to the specified servers and returns available tools for UI selection.

### 3.6 No SQL Migration Needed

Because this feature uses the LangGraph document store (same as assistants and tools), **no Alembic migration is required**. The store already handles arbitrary namespaces. This is a significant advantage -- zero schema migration risk.

### 3.7 API Endpoints

New route file: `/backend/src/routes/mcp_server.py`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/mcp-servers` | Create a new MCP server config |
| `GET` | `/api/mcp-servers` | List all user's MCP server configs |
| `GET` | `/api/mcp-servers/{name}` | Get a specific config by name |
| `PUT` | `/api/mcp-servers/{name}` | Update a config |
| `DELETE` | `/api/mcp-servers/{name}` | Delete a config |
| `POST` | `/api/mcp-servers/discover` | Discover tools from specified server configs |
| `POST` | `/api/mcp-servers/{name}/test` | Test connectivity to a server |

### 3.8 Updated `_format` in BaseRepo

If `McpServerRepo` extends `BaseRepo`, add an `"mcp_servers"` case to `BaseRepo._format()`. Alternatively, follow the `ToolRepo` standalone pattern (recommended, since `ToolRepo` already does this).

---

## 4. Data Flow: End-to-End

```
1. User creates MCP server config
   POST /api/mcp-servers { name: "github", transport: "sse", url: "...", headers: {...} }
   -> Stored in LangGraph store at (user_id, "mcp_servers", "github")

2. User assigns server to assistant
   PUT /api/assistants/{id} { mcp_servers: ["github", "slack"] }
   -> Assistant document updated with mcp_servers field

3. User requests tool discovery
   POST /api/mcp-servers/discover { server_names: ["github"] }
   -> Service resolves configs, connects via MultiServerMCPClient, returns tool list

4. User selects tools on assistant
   PUT /api/assistants/{id} { tools: ["existing_tool", "github__create_issue"] }
   -> Standard tool selection (already supported)

5. At inference time
   -> AssistantService/LLMService resolves mcp_servers names to configs
   -> Merges with inline mcp field
   -> Passes to MultiServerMCPClient
```

---

## 5. Design Decisions and Trade-offs

### 5.1 Store vs SQL Table

**Decision:** Use LangGraph document store, not a new SQL table.

**Rationale:**
- All non-auth entities (assistants, tools, projects, sources) use the store.
- The store is already namespace-scoped by user_id -- natural multi-tenancy.
- No migration downtime or risk.
- Consistent with existing patterns.

**Trade-off:** No foreign key constraints or SQL joins. Referential integrity between `assistant.mcp_servers` and actual stored configs must be enforced at the application layer.

### 5.2 Name-based References vs UUID References

**Decision:** Reference MCP server configs by name (string key).

**Rationale:**
- `ToolRepo` already uses tool name as the store key.
- Names are meaningful in the `MultiServerMCPClient` dict format.
- Simpler UX -- users see and manage by name.

**Trade-off:** Renaming a server config requires updating all assistants that reference it. The service layer should handle this cascade.

### 5.3 Separate Entity vs Extending SavedTool

**Decision:** Create a new `McpServerConfig` entity rather than reusing `SavedTool` with `type="mcp"`.

**Rationale:**
- `SavedTool` represents a tool definition with invocation config. An MCP server config is a connection definition that yields multiple tools.
- Different lifecycle: a server config is stable; tools discovered from it are dynamic.
- Cleaner separation of concerns.

### 5.4 Encryption of Sensitive Fields

**Decision:** Encrypt `env` and `headers` fields at rest using existing `encrypt_value`/`decrypt_value`.

**Rationale:** Headers often contain API keys or tokens. The `ToolRepo` already encrypts `env` -- same pattern.

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Orphaned references (assistant points to deleted server) | Medium | Low | Service validates on resolve; UI shows warnings |
| Name collision across features | Low | Low | Namespace scoping ensures user isolation |
| MCP connection failures at discovery time | High | Medium | Timeout handling, test endpoint, error reporting |
| Backward compat with inline `mcp` field | Low | Medium | Merge strategy preserves inline configs |
| Store performance with many server configs per user | Very Low | Low | Typical user has <20 configs; store handles this fine |

---

## 7. Estimated Complexity

| Component | Files | Effort |
|-----------|-------|--------|
| Schema: `McpServerConfig` + create/update models | 1 new file | Small |
| Repo: `McpServerRepo` | 1 new file | Small |
| Service: `McpServerService` | 1 new file | Medium |
| Controller: `McpServerController` | 1 new file | Medium |
| Routes: `/api/mcp-servers` | 1 new file | Small |
| Assistant schema update (`mcp_servers` field) | 1 existing file | Trivial |
| LLM service update (resolve mcp_servers at inference) | 1-2 existing files | Medium |
| Tests | 2-3 new files | Medium |
| **Total** | **~10 files** | **Medium** |

Estimated effort: **3-5 days** for backend implementation including tests.

---

## 8. File Inventory

### New Files
- `/backend/src/schemas/entities/mcp.py` -- Pydantic models
- `/backend/src/repos/mcp_server_repo.py` -- Store repository
- `/backend/src/services/mcp_server.py` -- Business logic
- `/backend/src/controllers/mcp_server.py` -- Request handlers
- `/backend/src/routes/mcp_server.py` -- FastAPI route definitions

### Modified Files
- `/backend/src/schemas/entities/llm.py` -- Add `mcp_servers: list[str]` to `Assistant`
- `/backend/src/services/llm.py` -- Resolve `mcp_servers` at inference time
- `/backend/src/services/tool.py` -- Update `mcp_tools()` to accept resolved configs
- `/backend/src/routes/__init__.py` (or main router) -- Register new routes
- `/backend/src/repos/base_repo.py` -- Optionally add `"mcp_servers"` to `_format()` (only if extending BaseRepo)

### No Migration Files Required
The LangGraph document store does not require Alembic migrations for new entity types.
