# ELITE COUNCIL REVIEW: GitHub Issue #709 -- MCP Server Configuration

**Date:** 2026-01-31
**Reviewers:** Elite Council (Schema Architect, API Strategist, UI Craftsman, MCP Integrator, Security Sentinel)
**Status:** FINAL REVIEW

---

## 1. Proposal Comparison Matrix

| Dimension | Schema Architect | API Strategist | UI Craftsman | MCP Integrator | Security Sentinel |
|-----------|-----------------|----------------|--------------|----------------|-------------------|
| **Storage** | LangGraph store (document) | SQL table (PostgreSQL) | Agnostic (uses existing serverService) | SQL table (PostgreSQL) | LangGraph store (document) |
| **Server Identity** | Name-based keys | UUID + slug | UUID (from existing Server entity) | UUID (from existing Server entity) | UUID (generated server-side) |
| **Assistant Linking** | `mcp_servers: list[str]` (names) on Assistant | `server_ids: list[str]` (UUIDs) on Assistant | Converts servers to `agent.mcp` inline dict | `mcp_servers: list[str]` (UUIDs) on Assistant | Copies resolved config into `assistant.mcp` inline |
| **Encryption** | `env` + `headers` encrypted via Fernet | `config` field encrypted | Not addressed (defers to backend) | Headers encrypted at rest | Headers encrypted via Fernet; redacted in responses |
| **SSRF Prevention** | Not addressed | Not addressed | Not addressed | URL allowlist, block private IPs | Multi-layer: Pydantic validator + DNS rebinding check |
| **stdio Transport** | Included in schema | Not discussed | Included in form | Explicitly excluded (security risk) | Explicitly blocked in cloud |
| **Backward Compat** | Merge inline `mcp` + saved `mcp_servers` | Keep inline `mcp`; `server_ids` additive | Convert saved servers back to `agent.mcp` format | Merge inline `mcp` + resolved servers | Copy resolved configs into `assistant.mcp` |
| **Migration Required** | None (store-based) | Yes (Alembic for `servers` table) | None (backend already scaffolded) | Yes (Alembic for `servers` table) | None (store-based) |
| **Estimated Effort** | 3-5 days | 10-15 files, medium | 12-16 hours frontend | 3-4 days total | 2-3 days backend |
| **Architecture** | Clean, consistent with store pattern | More traditional SQL, richer querying | Pragmatic, reuses existing code | Production-focused, protocol-aware | Defense-in-depth |
| **Maintainability** | High (follows existing patterns) | High (SQL conventions well understood) | High (follows existing UI patterns) | High (leverages existing MCP infra) | High (security patterns documented) |
| **Risk Level** | Low | Medium (migration + hybrid storage) | Low | Medium (touches inference path) | Low (adds safety without complexity) |
| **Completeness** | Backend schema + service only | Full API surface + service layer | Full frontend architecture | Full backend + protocol integration | Security layer only |

---

## 2. Consensus Points

All five proposals agree on the following:

1. **The feature is feasible and well-scoped.** Significant infrastructure already exists (MCP client, server CRUD routes, frontend service layer, tool discovery flow).

2. **Backward compatibility with `assistant.mcp` is mandatory.** The existing inline MCP config dict must continue to work. The new server references are additive.

3. **A "test connection" endpoint is needed.** The current mock must be replaced with real MCP server connectivity checks.

4. **Tool discovery uses `MultiServerMCPClient`.** All proposals agree the existing `langchain_mcp_adapters` client is the right integration point.

5. **Server configs should be user-scoped.** No cross-user sharing in v1. Organization/team sharing deferred.

6. **Credentials (headers, API keys) must be encrypted at rest.** All proposals that address storage agree on using the existing Fernet-based `encrypt_value`/`decrypt_value` utilities.

7. **The assistant-to-server relationship is stored as a list field on the Assistant entity.** No proposal suggests a separate junction table.

8. **Connection timeouts are essential.** MCP servers are external and unreliable; 10-second timeouts with graceful degradation.

9. **Implementation follows existing codebase patterns** (repo/service/controller/route layering, Pydantic schemas, FastAPI dependencies).

---

## 3. Divergence Analysis

### 3.1 Storage Backend: LangGraph Store vs SQL Table

**Schema Architect + Security Sentinel:** Use LangGraph document store with `(user_id, "mcp_servers")` namespace. No migration needed. Consistent with assistants/tools.

**API Strategist + MCP Integrator:** Use a SQL table (`servers`) with Alembic migration. The route file already references a SQLAlchemy `Server` model. Supports richer querying, foreign keys, and the `public` flag for shared server discovery.

**Council Decision: SQL Table (PostgreSQL).**

Rationale:
- A partially-built `server.py` route already exists at `backend/src/routes/v0/server.py` that imports a SQL-based `Server` model. Building on this existing scaffolding is more efficient than creating a parallel store-based system.
- The `public` server feature (browsable server marketplace) requires cross-user queries that the namespace-scoped document store cannot efficiently support.
- The `type` field supporting both `mcp` and `a2a` servers suggests this is a first-class entity that benefits from SQL constraints, indexing, and relational integrity.
- The migration cost is low (one table, straightforward schema).

### 3.2 Server Identity: Name-based vs UUID-based

**Schema Architect:** Use server `name` as the key (matching `ToolRepo` pattern).

**All others:** Use UUID as the primary identifier, with `slug` for human-readable URLs.

**Council Decision: UUID primary key with slug for URLs.**

Rationale:
- UUIDs are immutable identifiers. Name-based keys create cascading update problems when a user renames a server.
- The existing route scaffolding already uses UUID-based paths (`/servers/{server_id}`).
- Slugs provide human-readable URLs without coupling identity to display names.

### 3.3 Assistant Linking Strategy: Reference vs Copy

**Schema Architect, API Strategist, MCP Integrator:** Store server IDs/names on the Assistant. Resolve at runtime.

**UI Craftsman:** Convert saved servers to inline `agent.mcp` format on the frontend. No backend linking needed.

**Security Sentinel:** Copy resolved config into `assistant.mcp` on assignment. No runtime resolution.

**Council Decision: Store `server_ids: list[str]` on the Assistant. Resolve at runtime in `LLMService`.**

Rationale:
- Reference-based linking means server config updates (URL changes, credential rotation) automatically propagate to all assistants using that server. This is the primary value of reusable configs.
- Copying configs (Security Sentinel / UI Craftsman approach) defeats the reusability goal and creates credential duplication.
- The hybrid data source concern (Assistant in store, Server in SQL) is manageable -- both are fast lookups. The MCP Integrator's `_resolve_mcp_servers()` pattern is clean.
- Graceful handling of deleted/missing servers is straightforward (skip with warning).

### 3.4 stdio Transport Support

**Schema Architect:** Includes stdio in the schema.

**MCP Integrator + Security Sentinel:** Block stdio in cloud deployments (process execution risk).

**Council Decision: Exclude stdio transport in v1.**

Rationale:
- stdio requires spawning local processes on the backend server, which is a security risk in a multi-tenant cloud environment.
- Add it later behind an admin flag if self-hosted deployments need it.

### 3.5 API Path Convention

**Schema Architect:** `/api/mcp-servers` (dedicated MCP-specific resource).

**API Strategist + MCP Integrator + UI Craftsman:** `/api/servers` (generic, supports both MCP and A2A types).

**Security Sentinel:** `/api/v0/mcp-servers` (MCP-specific with version prefix).

**Council Decision: `/api/servers` (generic, with `type` filter).**

Rationale:
- The existing route scaffolding uses `/api/servers`. Reuse it.
- Supporting both `mcp` and `a2a` types in a single resource is cleaner than separate endpoints.
- The `type` query parameter handles filtering.

### 3.6 Credential Storage in Assistant Entity

**Security Sentinel:** Flags that `assistant.mcp` stores credentials in plaintext as a gap.

**Council Decision: Address this gap.** Encrypt headers within `assistant.mcp` on write and decrypt on read, matching the `ToolRepo.env` pattern. However, with the reference-based linking decision (store `server_ids`, resolve at runtime), the `assistant.mcp` field will only contain inline overrides, reducing the credential duplication concern. Still, encrypt any headers in inline `mcp` configs.

---

## 4. Unified Implementation Plan

### Architecture Summary

```
Storage:        SQL table `servers` (PostgreSQL, Alembic migration)
Identity:       UUID primary key, auto-generated slug
Assistant Link: `server_ids: list[str]` field on Assistant (LangGraph store)
Resolution:     Runtime in LLMService.init_tools() -- query Server table, build MCP config dict
Transport:      SSE and streamable_http only (no stdio in v1)
Security:       Fernet encryption for config secrets, SSRF validation, credential redaction
API:            /api/servers (existing scaffolding)
```

### Phase 1: Server Model and CRUD (Days 1-2)

**Goal:** Complete the already-scaffolded server CRUD.

1. Create `Server` SQLAlchemy model at `backend/src/schemas/models/server.py`
   - Columns: id (UUID), user_id (FK to users), name, slug (unique), description, type, config (JSONB), documentation, documentation_url, public, created_at, updated_at
2. Export from `backend/src/schemas/models/__init__.py`
3. Create Alembic migration for `servers` table
4. Create Pydantic schemas at `backend/src/schemas/entities/server.py` (ServerCreate, ServerUpdate, ServerResponse)
5. Create `ServerService` at `backend/src/services/server.py`
6. Register existing route in `backend/src/routes/v0/__init__.py`
7. Add SSRF URL validation (Security Sentinel's multi-layer approach) as a Pydantic validator on the config URL field
8. Add encryption for `config.headers` on write, decryption on read
9. Block `stdio` transport in validation
10. Unit tests for model, service, and URL validation

**Files:**
- NEW: `backend/src/schemas/models/server.py`
- NEW: `backend/migrations/versions/XXXX_add_servers_table.py`
- NEW: `backend/src/schemas/entities/server.py`
- NEW: `backend/src/services/server.py`
- EDIT: `backend/src/schemas/models/__init__.py`
- EDIT: `backend/src/routes/v0/__init__.py`
- EDIT: `backend/src/routes/v0/server.py` (minor fixes if needed)
- NEW: `backend/tests/unit/test_server_service.py`

### Phase 2: Assistant-Server Binding (Days 2-3)

**Goal:** Allow assistants to reference saved server configs.

1. Add `server_ids: Optional[list[str]] = []` to `Assistant` Pydantic model in `backend/src/schemas/entities/llm.py`
2. Add assignment endpoints to `backend/src/routes/v0/assistant.py`:
   - `PUT /api/assistants/{id}/servers` -- set server_ids
   - `GET /api/assistants/{id}/servers` -- get full Server objects
   - `DELETE /api/assistants/{id}/servers/{server_id}` -- remove one
3. Update `LLMService.init_tools()` to resolve `server_ids`:
   - Query `Server` table for IDs
   - Build MCP config dict from `server.config`
   - Merge with inline `assistant.mcp`
   - Pass to `MultiServerMCPClient`
4. Handle missing/deleted servers gracefully (skip with log warning)

**Files:**
- EDIT: `backend/src/schemas/entities/llm.py`
- EDIT: `backend/src/routes/v0/assistant.py`
- EDIT: `backend/src/services/llm.py`
- NEW: `backend/tests/integration/test_assistant_servers.py`

### Phase 3: Tool Discovery and Connection Testing (Days 3-4)

**Goal:** Real tool discovery and connection testing from saved servers.

1. Add `POST /api/servers/{server_id}/tools` endpoint for tool discovery
2. Replace mock `test-connection` with real implementation (MCP Integrator's pattern)
3. Add 10-second connection timeout
4. Add DNS rebinding check at connection time (Security Sentinel)
5. Add rate limiting to test-connection endpoint
6. Short-TTL in-memory cache for tool discovery results (30-60 seconds)

**Files:**
- EDIT: `backend/src/routes/v0/server.py`
- EDIT: `backend/src/services/server.py`
- NEW: `backend/src/utils/url_validation.py` (SSRF + DNS checks)
- NEW: `backend/tests/unit/test_url_validation.py`

### Phase 4: Frontend -- Server Management (Days 4-5)

**Goal:** Servers management page and server form.

1. `ServerForm` component with Zod validation (UI Craftsman's schema)
2. `ServerCard` display component
3. `ServersIndexPage` at `/servers` route (follows SettingsPage pattern)
4. Extend `useServerHook.ts` with full CRUD operations
5. Add route to `AppRoutes.tsx`
6. Add navigation link to sidebar

**Files:**
- NEW: `frontend/src/pages/servers/index.tsx`
- NEW: `frontend/src/components/forms/servers/server-form.tsx`
- NEW: `frontend/src/components/cards/ServerCard.tsx`
- EDIT: `frontend/src/routes/AppRoutes.tsx`
- EDIT: `frontend/src/hooks/useServerHook.ts` (or `useMcpHook.ts`)
- EDIT: Sidebar/nav component

### Phase 5: Frontend -- Assistant Integration (Days 5-6)

**Goal:** Server picker in assistant form, tool discovery from assigned servers.

1. `ServerSelectionModal` component (search, tabs for My/Public servers, checkbox selection)
2. "MCP Servers" section in `agent-create-form.tsx` (between Tools and SubAgents)
3. Wire server assignment to `PUT /api/assistants/{id}/servers`
4. Update `McpServerPanel` in `ToolSelectionModal` to show "Import from Saved" option
5. Tool discovery from assigned servers feeds into existing tool selection flow

**Files:**
- NEW: `frontend/src/components/modals/ServerSelectionModal.tsx`
- EDIT: `frontend/src/components/forms/agents/agent-create-form.tsx`
- EDIT: `frontend/src/components/modals/ToolSelectionModal/McpServerPanel.tsx`
- EDIT: `frontend/src/components/modals/ToolSelectionModal/index.tsx`

### Critical Path

```
Phase 1 (Server CRUD) --> Phase 2 (Assistant binding) --> Phase 3 (Tool discovery)
                                                              |
Phase 4 (Frontend CRUD) ----> Phase 5 (Frontend integration) <-+
```

Phases 1 and 4 can begin in parallel (backend and frontend). Phases 2-3 must follow Phase 1. Phase 5 depends on Phases 2, 3, and 4.

---

## 5. Risk Consolidation

| Risk | Severity | Likelihood | Source | Mitigation |
|------|----------|------------|--------|------------|
| **SSRF via user-provided URLs** | High | Medium | Security Sentinel, MCP Integrator | Multi-layer validation: Pydantic URL validator + DNS rebinding check + block private IPs + connection timeout |
| **Credential leakage in API responses** | High | Medium | Security Sentinel | Redact headers in list/get responses; only decrypt for runtime use and test-connection |
| **MCP server unreachable at inference time** | Medium | High | MCP Integrator, Schema Architect | Graceful degradation (existing pattern); skip failed servers, continue with others |
| **Alembic migration failure** | Medium | Low | API Strategist | Standard migration testing; reversible migration; single-table schema |
| **Orphaned server references on Assistant** | Low | Medium | Schema Architect, MCP Integrator | Validate on resolve; skip missing servers with warning; optional cleanup on server delete |
| **Cross-tenant data access** | Critical | Very Low | Security Sentinel | User-scoped queries with `user_id` from JWT (never from request body); SQL WHERE clause |
| **Backward compatibility break with inline `mcp`** | Medium | Low | All proposals | Keep `mcp` field; merge inline + resolved at runtime; inline overrides take precedence |
| **stdio transport security** | High | Low | MCP Integrator, Security Sentinel | Block stdio in v1; add behind admin flag later |
| **Key rotation breaks encrypted credentials** | Medium | Low | Security Sentinel | Document migration procedure; out of scope for v1 |
| **Hybrid storage complexity (SQL + LangGraph store)** | Low | Low | API Strategist | Both are fast lookups; straightforward service layer bridging |

---

## 6. Final Verdict

### GO -- with conditions

**Confidence Level: HIGH (85%)**

**Conditions:**

1. **Use the SQL-based approach** with the existing `server.py` route scaffolding. Do not create a parallel store-based system.
2. **Implement SSRF prevention** (Security Sentinel's multi-layer approach) before any deployment to production. This is non-negotiable for a feature that makes outbound connections to user-provided URLs.
3. **Block stdio transport** in v1.
4. **Encrypt credentials** (headers) in the `config` JSONB field at the application layer. Redact in API responses.
5. **Do not implement org/team sharing** in v1. Keep user-scoped.
6. **Add connection timeouts** (10s connect, 30s tool listing) to all outbound MCP connections.

**Rationale for GO:**

- The existing infrastructure is substantial. The server CRUD route, frontend service layer, MCP client integration, and tool discovery flow already exist in various stages of completion.
- The feature fills a real user need -- currently MCP configs must be manually re-entered for each assistant.
- The architectural approach (SQL table, UUID identity, reference-based linking, runtime resolution) is well-understood, follows established patterns, and has clear consensus across proposals.
- Estimated total effort is 5-6 developer days (backend + frontend), which is reasonable for the value delivered.
- Risk profile is manageable with the mitigations outlined above.

**What would change this to NO-GO:**

- Discovery that `MultiServerMCPClient` cannot handle concurrent multi-server connections reliably.
- Discovery that the existing `server.py` route scaffolding is fundamentally incompatible with the current auth/store architecture.
- Inability to implement SSRF prevention at the application layer (would require infrastructure-level network policies instead).

---

*Council review complete. This document should be used as the authoritative implementation guide for Issue #709.*
