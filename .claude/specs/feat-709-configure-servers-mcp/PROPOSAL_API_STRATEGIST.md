# PROPOSAL: API Strategy for MCP Server Configuration (Issue #709)

**Author:** AGENT_2 (API_STRATEGIST)
**Date:** 2026-01-30
**Status:** Draft

---

## 1. Executive Summary

This proposal defines the REST API surface, Pydantic schemas, service layer, and route organization required to let users configure MCP servers and assign them to assistants. The codebase already contains a partially-built `server.py` route file at `backend/src/routes/v0/server.py` with full CRUD endpoints and a `Server` SQLAlchemy model reference. However, the Server model does not yet exist in the models package, the route is not registered in `__init__.py`, and there is no `assistant <-> server` linking layer.

The work splits into three API domains:

1. **Server CRUD** -- Already scaffolded, needs: SQLAlchemy model, migration, service extraction, registration.
2. **Assistant-Server Assignment** -- New sub-resource endpoints on the assistant.
3. **Tool Discovery from Servers** -- New endpoint to list tools exposed by assigned MCP servers.

---

## 2. Existing Codebase Patterns (Reference)

| Pattern | Example | Notes |
|---------|---------|-------|
| Route file | `backend/src/routes/v0/assistant.py` | `APIRouter(tags=[...], prefix="/...")`, registered in `__init__.py` |
| Auth dependency | `user: ProtectedUser = Depends(verify_credentials)` | All mutating endpoints use this |
| DB dependency | `db: AsyncSession = Depends(get_async_db)` | For SQL-backed resources (auth module) |
| Store dependency | `store: BaseStore = Depends(get_store)` | For LangGraph store-backed resources (assistants, tools) |
| Service layer | `AssistantService`, `ToolService` | Instantiated per-request with `user_id` + `store` |
| ServiceContext | `src/contexts/service.py` | Aggregates all services; used in LLM controller |
| Repo layer | `BaseRepo`, `ToolRepo` | Thin store wrappers with namespace-based access |
| Response pattern | Return dicts directly or `Response(status_code=...)` | No envelope wrapper; flat JSON |

**Key observation:** The Server route uses `AsyncSession` (SQL), while Assistants use `BaseStore` (LangGraph store). Servers are relational (SQL), assistants are document-store. The linking layer must bridge both.

---

## 3. SQLAlchemy Model: `Server`

**File:** `backend/src/schemas/models/server.py` (new)

```python
import uuid
import re
import sqlalchemy as sa
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.services.db import get_db_base

Base = get_db_base()


class Server(Base):
    __tablename__ = "servers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        index=True,
        server_default=sa.text("uuid_generate_v4()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # "mcp" or "a2a"
    config: Mapped[dict] = mapped_column(JSONB, nullable=False)
    documentation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    documentation_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @staticmethod
    def generate_slug(name: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        return f"{slug}-{uuid.uuid4().hex[:8]}"

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "type": self.type,
            "config": self.config,
            "documentation": self.documentation,
            "documentation_url": self.documentation_url,
            "public": self.public,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
```

**Export in `backend/src/schemas/models/__init__.py`:**
```python
from src.schemas.models.auth import User, ProtectedUser
from src.schemas.models.server import Server

__all__ = ["User", "ProtectedUser", "Server"]
```

---

## 4. Database Migration

**File:** `backend/migrations/versions/0002_add_servers_table.py` (new)

Creates the `servers` table with columns matching the model above. Indexes on `user_id`, `slug`, `type`, and `public`.

---

## 5. API Endpoint Design

### 5.1 Server CRUD (already scaffolded -- finalize and register)

The existing `backend/src/routes/v0/server.py` already defines all needed endpoints. Changes required:

- Register in `backend/src/routes/v0/__init__.py`
- Extract Pydantic schemas to `backend/src/schemas/entities/server.py`
- Extract business logic to `backend/src/services/server.py`

| Method | Path | Operation ID | Description |
|--------|------|-------------|-------------|
| `GET` | `/api/servers` | `ruska_list_servers` | List user's servers (paginated, filterable by type) |
| `GET` | `/api/servers/public` | `ruska_list_public_servers` | List public servers (no auth) |
| `GET` | `/api/servers/{server_id}` | `ruska_get_server` | Get server by ID |
| `GET` | `/api/servers/by-slug/{slug}` | `ruska_get_server_by_slug` | Get server by slug |
| `POST` | `/api/servers` | `ruska_create_server` | Create server config |
| `PUT` | `/api/servers/{server_id}` | `ruska_update_server` | Full update |
| `PATCH` | `/api/servers/{server_id}` | `ruska_patch_server` | Partial update |
| `DELETE` | `/api/servers/{server_id}` | `ruska_delete_server` | Delete server |
| `POST` | `/api/servers/validate` | `ruska_validate_server` | Validate config without saving |
| `POST` | `/api/servers/{server_id}/test-connection` | `ruska_test_server_connection` | Test connectivity |

### 5.2 Assistant-Server Assignment (new endpoints)

These endpoints manage the many-to-many relationship between assistants and servers. Since assistants live in the LangGraph store (not SQL), the assignment is stored as a `server_ids: list[str]` field on the Assistant schema, and optionally also via a SQL join table for query efficiency.

**Approach A (Recommended): Store `server_ids` on the Assistant document**

This is the simplest approach, consistent with how `tools`, `mcp`, and `a2a` are already stored as fields on the Assistant Pydantic model. No join table needed.

| Method | Path | Operation ID | Description |
|--------|------|-------------|-------------|
| `PUT` | `/api/assistants/{assistant_id}/servers` | `ruska_assign_servers_to_assistant` | Set the full list of server IDs assigned to an assistant |
| `GET` | `/api/assistants/{assistant_id}/servers` | `ruska_get_assistant_servers` | Get full server objects for an assistant's assigned servers |
| `DELETE` | `/api/assistants/{assistant_id}/servers/{server_id}` | `ruska_remove_server_from_assistant` | Remove one server from an assistant |

### 5.3 Tool Discovery from Assigned Servers (new endpoint)

| Method | Path | Operation ID | Description |
|--------|------|-------------|-------------|
| `GET` | `/api/assistants/{assistant_id}/servers/{server_id}/tools` | `ruska_list_server_tools` | Connect to an MCP server and list its available tools |
| `POST` | `/api/servers/{server_id}/tools` | `ruska_discover_server_tools` | Discover tools from a server (standalone, not assistant-scoped) |

---

## 6. Pydantic Schemas

**File:** `backend/src/schemas/entities/server.py` (new)

```python
from typing import List, Optional
from pydantic import BaseModel, Field


class ServerConfigBase(BaseModel):
    type: str = Field(..., description="Server type: 'mcp' or 'a2a'", pattern="^(mcp|a2a)$")
    config: dict


class ServerCreate(ServerConfigBase):
    name: str
    description: Optional[str] = None
    documentation: Optional[str] = None
    documentation_url: Optional[str] = None
    public: bool = False


class ServerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    config: Optional[dict] = None
    documentation: Optional[str] = None
    documentation_url: Optional[str] = None
    public: Optional[bool] = None


class ServerResponse(BaseModel):
    id: str
    user_id: str
    name: str
    slug: str
    description: Optional[str] = None
    type: str
    config: dict
    documentation: Optional[str] = None
    documentation_url: Optional[str] = None
    public: bool
    created_at: str
    updated_at: str


class ServerListResponse(BaseModel):
    servers: List[ServerResponse]
    total: int
    limit: int
    offset: int


class ServerValidationResponse(BaseModel):
    valid: bool
    errors: List[dict] = []


class ConnectionTestResponse(BaseModel):
    success: bool
    latency_ms: Optional[int] = None
    message: Optional[str] = None
    error: Optional[str] = None
    details: Optional[dict] = None


class AssignServersRequest(BaseModel):
    server_ids: List[str] = Field(..., description="List of server UUIDs to assign")


class ServerToolResponse(BaseModel):
    name: str
    description: str
    input_schema: Optional[dict] = None
    server_id: str
    server_name: str


class ServerToolsListResponse(BaseModel):
    tools: List[ServerToolResponse]
    server_id: str
    server_name: str
```

**Update to Assistant schema** (`backend/src/schemas/entities/llm.py`):

Add a new optional field to the `Assistant` class:

```python
class Assistant(BaseModel):
    # ... existing fields ...
    server_ids: Optional[list[str]] = Field(
        default_factory=list,
        description="List of MCP/A2A server configuration IDs assigned to this assistant",
    )
```

This field replaces the need for the freeform `mcp: Optional[dict]` when using configured servers. The existing `mcp` field remains for backward compatibility with inline MCP configs.

---

## 7. Service Layer

### 7.1 ServerService

**File:** `backend/src/services/server.py` (new)

```python
class ServerService:
    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id

    async def list(self, type: str = None, limit: int = 20, offset: int = 0) -> tuple[list[Server], int]:
        """List servers for the current user with pagination."""

    async def get(self, server_id: str) -> Server:
        """Get a single server, enforcing ownership or public access."""

    async def get_by_slug(self, slug: str) -> Server:
        """Get a server by slug."""

    async def create(self, data: ServerCreate) -> Server:
        """Create a new server config. Validates before saving."""

    async def update(self, server_id: str, data: ServerCreate) -> Server:
        """Full update of a server config."""

    async def partial_update(self, server_id: str, data: ServerUpdate) -> Server:
        """Partial update of a server config."""

    async def delete(self, server_id: str) -> None:
        """Delete a server config. Must check no assistants reference it (optional)."""

    async def validate_config(self, data: ServerConfigBase) -> ServerValidationResponse:
        """Validate a server config without persisting."""

    async def test_connection(self, server_id: str) -> ConnectionTestResponse:
        """Attempt to connect to the server and report status."""

    async def get_multiple(self, server_ids: list[str]) -> list[Server]:
        """Fetch multiple servers by ID, filtering to owned or public."""

    async def discover_tools(self, server_id: str) -> list[ServerToolResponse]:
        """Connect to an MCP server and return its tool listing."""
```

### 7.2 AssistantServerService (or extend AssistantService)

Since the assistant lives in the LangGraph store, server assignment is handled by updating the `server_ids` field on the assistant document. This can be a thin set of methods added to `AssistantService` or a small dedicated service.

```python
# In AssistantService or a new AssistantServerService
async def assign_servers(self, assistant_id: str, server_ids: list[str]) -> bool:
    """Set the server_ids on an assistant. Validates all IDs exist."""

async def get_assigned_servers(self, assistant_id: str, db: AsyncSession) -> list[Server]:
    """Read assistant.server_ids, then fetch full Server objects from SQL."""

async def remove_server(self, assistant_id: str, server_id: str) -> bool:
    """Remove a single server_id from the assistant's list."""
```

---

## 8. Route Organization

### 8.1 Registration

Update `backend/src/routes/v0/__init__.py`:

```python
from .server import router as server
# ... in create_api_router():
app.include_router(server, prefix=prefix)
```

### 8.2 New Route File for Assistant-Server Linking

**File:** `backend/src/routes/v0/assistant_server.py` (new)

Or add these endpoints directly in `backend/src/routes/v0/assistant.py` under a new section, which is more consistent with how publish/unpublish are organized on the assistant router.

Recommended: add to `assistant.py` since these are sub-resources of assistants.

```python
################################################################################
### Assistant Server Assignment
################################################################################

@router.put(
    "/{assistant_id}/servers",
    name="Assign Servers to Assistant",
    operation_id="ruska_assign_servers_to_assistant",
)
async def assign_servers(
    assistant_id: str = Path(...),
    body: AssignServersRequest = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
    db: AsyncSession = Depends(get_async_db),
):
    # 1. Validate all server_ids exist and are owned by user or public
    # 2. Update assistant.server_ids in the store
    # 3. Return updated assignment
    ...

@router.get(
    "/{assistant_id}/servers",
    name="Get Assistant Servers",
    operation_id="ruska_get_assistant_servers",
)
async def get_assistant_servers(
    assistant_id: str = Path(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
    db: AsyncSession = Depends(get_async_db),
):
    # 1. Get assistant from store
    # 2. Read server_ids
    # 3. Fetch full Server objects from SQL
    ...

@router.get(
    "/{assistant_id}/servers/{server_id}/tools",
    name="List Server Tools for Assistant",
    operation_id="ruska_list_server_tools",
)
async def list_server_tools(
    assistant_id: str = Path(...),
    server_id: str = Path(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
    db: AsyncSession = Depends(get_async_db),
):
    # 1. Verify server is assigned to assistant
    # 2. Connect to MCP server using config
    # 3. Return tool listing
    ...
```

---

## 9. Request/Response Examples

### Create Server
```
POST /api/servers
{
    "name": "My MCP Server",
    "type": "mcp",
    "config": {
        "transport": "sse",
        "url": "https://mcp.example.com/sse",
        "headers": {"Authorization": "Bearer xxx"}
    },
    "description": "Production MCP server",
    "public": false
}

Response 201:
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "...",
    "name": "My MCP Server",
    "slug": "my-mcp-server-a1b2c3d4",
    "type": "mcp",
    "config": {...},
    "description": "Production MCP server",
    "documentation": null,
    "documentation_url": null,
    "public": false,
    "created_at": "2026-01-30T...",
    "updated_at": "2026-01-30T..."
}
```

### Assign Servers to Assistant
```
PUT /api/assistants/{assistant_id}/servers
{
    "server_ids": [
        "550e8400-e29b-41d4-a716-446655440000",
        "660e8400-e29b-41d4-a716-446655440001"
    ]
}

Response 200:
{
    "assistant_id": "...",
    "server_ids": ["550e...", "660e..."]
}
```

### Discover Tools from Server
```
GET /api/assistants/{assistant_id}/servers/{server_id}/tools

Response 200:
{
    "tools": [
        {
            "name": "search_web",
            "description": "Search the web for information",
            "input_schema": {"type": "object", "properties": {...}},
            "server_id": "550e...",
            "server_name": "My MCP Server"
        }
    ],
    "server_id": "550e...",
    "server_name": "My MCP Server"
}
```

---

## 10. Data Flow: End-to-End User Journey

```
1. User creates server config     POST /api/servers
2. User creates/edits assistant    POST /api/assistants
3. User assigns servers            PUT  /api/assistants/{id}/servers
4. User discovers tools            GET  /api/assistants/{id}/servers/{sid}/tools
5. User selects tools              PUT  /api/assistants/{id}  (update tools list)
6. User invokes assistant          POST /api/llm/invoke
   -> LLMService reads assistant.server_ids
   -> Fetches server configs from SQL
   -> Initializes MCP clients
   -> Loads selected tools
```

---

## 11. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| MCP server connection timeout during tool discovery | Medium | Set 10s timeout on MCP client; return partial results with errors |
| Stale server_ids on assistant after server deletion | Medium | On server delete, optionally scan assistants and remove references; or handle gracefully at load time |
| Config contains secrets (API keys in headers) | High | Encrypt `config` field at rest using existing `encrypt_value`/`decrypt_value` utilities from `src/utils/security` |
| SQL + Store hybrid queries (assistant in store, server in SQL) | Low | Accept the two-datasource read; both are fast lookups |
| Backward compatibility with inline `mcp` field | Low | Keep existing `mcp` field; `server_ids` is additive. LLMService merges both at runtime |

---

## 12. Complexity Estimate

| Component | Effort | Files |
|-----------|--------|-------|
| Server SQLAlchemy model | Small | 1 new file + 1 edit |
| Migration | Small | 1 new file |
| Extract schemas from route to entities | Small | 1 new file + 1 edit |
| ServerService | Medium | 1 new file |
| Register server route | Trivial | 1 edit |
| Add `server_ids` to Assistant schema | Trivial | 1 edit |
| Assistant-server assignment endpoints | Medium | 1 edit (assistant.py) |
| Tool discovery endpoint | Medium | 1 edit |
| LLMService integration (load tools from assigned servers) | Medium | 1-2 edits |
| Tests | Medium | 2-3 new files |

**Total estimate:** ~10-15 files touched/created. Medium complexity overall. Core CRUD is already scaffolded.

---

## 13. Implementation Order

1. **Server model + migration** -- Unblocks everything
2. **Extract schemas, create ServerService** -- Clean separation
3. **Register server route** -- Server CRUD live
4. **Add `server_ids` to Assistant, assignment endpoints** -- Linking layer
5. **Tool discovery endpoint** -- MCP client integration
6. **LLMService integration** -- Runtime tool loading from assigned servers
7. **Tests**
