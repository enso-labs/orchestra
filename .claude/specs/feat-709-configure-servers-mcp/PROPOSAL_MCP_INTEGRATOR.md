# Proposal: MCP Server Configuration (Issue #709) -- MCP Integrator Perspective

## Executive Summary

The codebase already has substantial MCP infrastructure in place. The backend uses `langchain_mcp_adapters.client.MultiServerMCPClient` to connect to MCP servers and discover tools (`ToolService.mcp_tools()`). The frontend has a `McpServerPanel` component with inline server configuration and tool discovery. A `Server` CRUD route exists at `/api/servers` with full REST endpoints. **The core gap is bridging persisted server configs to the assistant workflow** -- currently assistants embed raw MCP JSON inline rather than referencing saved server records by ID.

## Current State Analysis

### What Already Exists

1. **MCP Client Integration** (`backend/src/services/tool.py:61-68`): `MultiServerMCPClient` from `langchain_mcp_adapters` connects to MCP servers and returns LangChain `StructuredTool` objects. This is production-ready.

2. **Server CRUD Routes** (`backend/src/routes/v0/server.py`): Full CRUD for server configs (create, read, update, delete, validate, test-connection). Supports `mcp` and `a2a` types. Uses SQLAlchemy `Server` model.

3. **Server SQLAlchemy Model**: The route imports `from src.schemas.models import Server` but the model is **not yet exported** from `src/schemas/models/__init__.py` and likely needs to be created or wired in. The route code assumes columns: `id`, `user_id`, `name`, `slug`, `description`, `type`, `config` (JSON), `documentation`, `documentation_url`, `public`, `created_at`, `updated_at`.

4. **MCP Entity Schema** (`backend/src/schemas/entities/a2a.py:15-28`): `McpServer` Pydantic model with `transport`, `url`, `headers` fields. `McpServers` wraps a dict of named servers.

5. **Assistant Model** (`backend/src/schemas/entities/llm.py:91-164`): `Assistant.mcp` is `Optional[dict] = {}` -- stores raw MCP config inline as `{"server-name": {"transport": "sse", "url": "...", "headers": {...}}}`.

6. **LLM Service Tool Init** (`backend/src/services/llm.py:95-117`): `init_tools()` calls `self.tool_service.mcp_tools(mcp)` where `mcp` is the raw dict from the assistant config.

7. **Frontend Tool Selection Modal** (`frontend/src/components/modals/ToolSelectionModal/McpServerPanel.tsx`): Users can add MCP servers inline, fetch tools, and select them. Currently does not reference saved server configs.

8. **Frontend MCP Hook** (`frontend/src/hooks/useMcpHook.ts`): Manages MCP state, calls `/tools/mcp/info` to discover tools, has `fetchMCPServers` and `fetchMyServers` functions that call `listPublicServers`/`listServers`.

### What Is Missing

| Gap | Description |
|-----|-------------|
| Server model wiring | `Server` SQLAlchemy model needs to be created/exported properly |
| Server-to-assistant reference | Assistants store raw MCP JSON; need to reference server IDs instead |
| Tool discovery from saved servers | No endpoint to list tools for a saved server by ID |
| Real connection testing | `test-connection` endpoint is a mock with random results |
| Server picker in assistant form | Frontend needs a server selector that loads saved configs |

## MCP Protocol Integration Design

### Connection Architecture

The existing `MultiServerMCPClient` handles the MCP protocol layer. The architecture should remain:

```
User saves Server config (DB)
    |
    v
User assigns Server IDs to Assistant
    |
    v
At inference time: resolve Server IDs -> build MCP config dict -> MultiServerMCPClient
    |
    v
MultiServerMCPClient connects (SSE/streamable_http) -> discovers tools -> returns StructuredTools
```

### Transport Support

Current `McpServer` schema supports `sse`, `streamable_http`, and `stdio`. The `Server` route validation only allows `sse`. This should be expanded:

- **SSE** (Server-Sent Events): Primary transport for remote MCP servers. Fully supported by `MultiServerMCPClient`.
- **Streamable HTTP**: Newer MCP transport. Supported by `langchain_mcp_adapters`.
- **STDIO**: For local process-based servers. **Not recommended for a web platform** -- requires spawning local processes on the backend server, which is a security risk. Should be excluded or gated behind an admin flag.

### Recommendation

Keep SSE and streamable_http as supported transports. Do not support STDIO in the web platform (it requires local process execution which is inappropriate for a multi-tenant service).

## Tool Discovery Architecture

### Current Flow

1. Frontend sends raw MCP config JSON to `POST /tools/mcp/info`
2. Backend creates `MultiServerMCPClient(mcp_config)`, calls `get_tools()`
3. Returns tool metadata (name, description, args_schema) to frontend

### Proposed Flow

Add a new endpoint that resolves saved servers:

```
POST /servers/{server_id}/tools
```

This endpoint:
1. Loads the `Server` record by ID
2. Builds the MCP config dict from `server.config`
3. Calls `MultiServerMCPClient` to discover tools
4. Returns tool list with metadata

### Tool Metadata Caching

Tool discovery requires an active connection to the MCP server. For performance:

- **Do not cache tool lists in the database** -- MCP servers can change their tool offerings at any time.
- **Cache in-memory with short TTL** (30-60 seconds) using the existing `@cache(expire=30)` pattern seen on the tools endpoint.
- Tool discovery is only triggered on explicit user action ("Fetch Tools" button) or when loading the assistant editor.

### Tool Selection Storage

Currently tools are stored as `list[str]` on the `Assistant` model (tool names). MCP tools should be stored the same way -- by name. The distinction between platform tools and MCP tools is made at resolution time based on whether the tool name matches a known platform tool or comes from an MCP server.

However, to avoid name collisions, MCP tools should be namespaced:

```
Assistant.tools = ["web_search", "python_repl", "mcp:github-server:create_issue", "mcp:slack-server:send_message"]
```

**Alternative (simpler, recommended):** Keep the current approach where MCP tools are resolved dynamically at inference time from the server configs. The assistant stores server references (IDs), and ALL tools from those servers are available unless the user explicitly deselects some. Store deselected tools rather than selected ones:

```python
# On the Assistant model
mcp_servers: list[str] = []  # Server IDs
mcp_excluded_tools: list[str] = []  # Tool names to exclude
```

## Connection Management

### Server Resolution at Inference Time

When `LLMService.init_tools()` is called:

1. Load the assistant's `mcp_servers` list (server IDs)
2. Query the `Server` table for those IDs
3. Build the MCP config dict: `{server.slug: server.config for server in servers}`
4. Pass to `MultiServerMCPClient` as today

This keeps backward compatibility -- the existing inline `mcp` dict still works. The new server references are an additive feature.

### Connection Lifecycle

`MultiServerMCPClient` manages its own connection lifecycle. Key considerations:

- **Connections are per-request**: Each LLM invocation creates a new `MultiServerMCPClient`. This is correct for SSE transport where connections are lightweight.
- **Timeout handling**: `MultiServerMCPClient` should have a connection timeout. The existing code does not set one explicitly -- rely on the library defaults but add a configurable timeout.
- **Parallel server connections**: When multiple MCP servers are assigned, `MultiServerMCPClient` connects to all of them. If one fails, it should not block the others.

### Real Connection Testing

Replace the mock `test-connection` endpoint:

```python
@router.post("/{server_id}/test-connection")
async def test_connection(server_id: uuid.UUID, ...):
    server = await get_server(server_id)
    config = {server.slug: server.config}

    start = time.monotonic()
    try:
        async with asyncio.timeout(10):
            client = MultiServerMCPClient(config)
            tools = await client.get_tools()
        latency = int((time.monotonic() - start) * 1000)
        return {"success": True, "latency_ms": latency, "tool_count": len(tools)}
    except asyncio.TimeoutError:
        return {"success": False, "error": "Connection timed out after 10s"}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

## Error Handling Strategy

### Connection Errors

| Error | Cause | Handling |
|-------|-------|----------|
| Connection refused | Server down or wrong URL | Return error, mark server status as unreachable in UI |
| Timeout | Server slow or network issue | 10s timeout, return partial results from other servers |
| Auth failure | Bad API key/token | Return 401-like error message to frontend |
| Invalid transport | Unsupported transport type | Validate at config save time |
| Tool discovery failure | Server up but tools endpoint broken | Log error, return empty tool list for that server |

### Graceful Degradation at Inference Time

If an MCP server is unreachable during inference:

1. Log the error
2. Continue with tools from other servers and platform tools
3. Do NOT fail the entire request
4. Include a warning in the response metadata

This is already handled by the existing `try/except` in `ToolService.mcp_tools()` which returns `[]` on error.

### Validation Errors

The existing `/servers/validate` endpoint checks config structure. Extend it to:

1. Validate transport is `sse` or `streamable_http` (not `stdio`)
2. Validate URL format (must be valid HTTP/HTTPS URL)
3. Validate headers are string key-value pairs
4. Optionally test connectivity (separate from validation)

## Implementation Plan

### Phase 1: Server Model and CRUD (Story 1) -- Already ~90% Done

1. **Create the `Server` SQLAlchemy model** in `backend/src/schemas/models/server.py`
   - Columns: id (UUID), user_id (FK), name, slug, description, type, config (JSONB), documentation, documentation_url, public, created_at, updated_at
   - Add unique constraint on (user_id, slug)
   - Export from `src/schemas/models/__init__.py`

2. **Create Alembic migration** for the `servers` table

3. **Update validation** in the server route to support `streamable_http` transport

**Estimated complexity: Low** -- most code exists, just needs model + migration.

### Phase 2: Server-to-Assistant Binding (Stories 2 + 4)

1. **Add `mcp_servers` field to `Assistant`**: `mcp_servers: Optional[list[str]] = []` (list of server IDs)

2. **Update `LLMService.init_tools()`** to resolve server IDs:
   ```python
   async def init_tools(self, tools, a2a, mcp, mcp_server_ids=None):
       # Resolve saved server configs
       if mcp_server_ids:
           resolved_mcp = await self._resolve_mcp_servers(mcp_server_ids)
           mcp = {**mcp, **resolved_mcp}  # Merge inline + saved
       # ... rest of existing logic
   ```

3. **Add `_resolve_mcp_servers()` helper**:
   - Query `Server` table for given IDs
   - Build config dict from results
   - Handle missing/deleted servers gracefully

**Estimated complexity: Medium** -- touches core inference path.

### Phase 3: Tool Discovery from Saved Servers (Story 3)

1. **Add `POST /servers/{server_id}/tools` endpoint**: Connects to the server and returns available tools.

2. **Update `test-connection` endpoint** with real implementation.

3. **Frontend: Update McpServerPanel** to show a server picker that loads from saved servers instead of (or in addition to) inline config.

**Estimated complexity: Medium** -- new endpoint + frontend integration.

### Phase 4: Frontend Integration

1. **Server picker component** in assistant create/edit form
2. **Tool selection** from discovered MCP tools
3. **Merge UI** showing both platform tools and MCP server tools in the ToolSelectionModal

**Estimated complexity: Medium-High** -- significant frontend work.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| MCP server unreachable at inference time | High | Medium | Graceful degradation (already handled) |
| Tool name collisions between servers | Medium | Low | Tools are namespaced by server in MultiServerMCPClient |
| Server config contains secrets (API keys) | High | High | Do not expose config in public server listings; encrypt headers at rest |
| Deleted server still referenced by assistant | Medium | Low | Handle missing servers gracefully; return warning |
| MultiServerMCPClient memory/connection leaks | Low | Medium | Connections are per-request; monitor resource usage |
| Migration breaks existing inline MCP configs | Low | High | Keep backward compat -- inline `mcp` dict still works alongside `mcp_servers` |

## Security Considerations

1. **Secret storage**: Server configs contain API keys in headers. These should be encrypted at rest in the database (JSONB with application-level encryption for the headers field, or use a vault).

2. **Access control**: Server configs are user-scoped. The existing route enforces `server.user_id == user.id`. Public servers expose config to all users -- consider redacting headers in public listings.

3. **SSRF risk**: Users provide arbitrary URLs for MCP servers. The backend connects to those URLs at discovery/inference time. This is an SSRF vector. Mitigate with:
   - URL allowlist/blocklist (optional, for enterprise deployments)
   - Disallow private IP ranges (10.x, 172.16-31.x, 192.168.x, localhost)
   - Connection timeout limits

## Complexity Estimate

| Component | Effort | Notes |
|-----------|--------|-------|
| Server SQLAlchemy model + migration | 2-3 hours | Straightforward |
| Wire model into existing CRUD routes | 1 hour | Already written, just needs model |
| Real test-connection endpoint | 2 hours | Replace mock |
| Assistant mcp_servers field + resolution | 3-4 hours | Core integration point |
| Tool discovery endpoint | 2 hours | New endpoint |
| Frontend server picker | 4-6 hours | New component |
| Frontend tool selection integration | 3-4 hours | Extend existing modal |
| Testing | 4-6 hours | Unit + integration |
| **Total** | **~20-28 hours** | ~3-4 dev days |
