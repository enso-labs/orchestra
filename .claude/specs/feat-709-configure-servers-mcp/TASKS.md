# Implementation Tasks: MCP Server Configuration (Issue #709)

## Pre-Implementation

- [ ] **T0.1** Verify existing scaffolding compiles without errors
  - Files: `backend/src/routes/v0/server.py`, `backend/src/schemas/models/__init__.py`
  - Acceptance: `server.py` route imports `Server` from models -- currently this import fails because the `Server` SQLAlchemy model does not exist yet. Confirm the import error to establish baseline.

---

## Phase 1: Backend -- Server Model & Migration

- [ ] **T1.1** Create `Server` SQLAlchemy model
  - Files: `backend/src/schemas/models/server.py` (NEW)
  - Acceptance: Model defines columns `id` (UUID PK), `user_id` (UUID FK to users), `name` (String), `slug` (String, unique per user), `description` (Text, nullable), `type` (String, "mcp" or "a2a"), `config` (JSONB), `documentation` (Text, nullable), `documentation_url` (String, nullable), `public` (Boolean, default false), `created_at` (DateTime), `updated_at` (DateTime). Includes `to_dict()` method and `generate_slug()` static method consistent with existing route usage.

- [ ] **T1.2** Export `Server` model from `__init__.py`
  - Files: `backend/src/schemas/models/__init__.py` (EDIT)
  - Acceptance: `from src.schemas.models import Server` resolves without error. Existing `User` and `ProtectedUser` exports unchanged.

- [ ] **T1.3** Create Alembic migration for `servers` table
  - Files: `backend/migrations/versions/XXXX_add_servers_table.py` (NEW)
  - Acceptance: `make migrate.up` creates `servers` table with all columns, indexes on `user_id`, `slug`, `type`, and `public`. `make migrate.down` drops the table cleanly.

- [ ] **T1.4** Add SSRF URL validation utility
  - Files: `backend/src/utils/url_validation.py` (NEW)
  - Acceptance: Function `validate_server_url(url: str) -> None` raises `ValueError` for: private/reserved IPs (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, ::1, fc00::/7), non-http(s) schemes, and URLs without a valid hostname. Passes for valid public HTTPS URLs.

- [ ] **T1.5** Add unit tests for URL validation
  - Files: `backend/tests/unit/test_url_validation.py` (NEW)
  - Acceptance: Tests cover private IPs blocked, localhost blocked, valid HTTPS allowed, non-http schemes blocked, missing hostname blocked. All pass via `make test`.

- [ ] **T1.6** Add config encryption/decryption to server route
  - Files: `backend/src/routes/v0/server.py` (EDIT)
  - Acceptance: On create/update, `config.headers` values are encrypted using `encrypt_value` from `src/utils/security.py` before DB write. On read (list/get), headers are redacted in responses (replaced with `"***"`). The `test-connection` endpoint decrypts headers for actual use.

- [ ] **T1.7** Add `streamable_http` transport support and block `stdio`
  - Files: `backend/src/routes/v0/server.py` (EDIT)
  - Acceptance: Validation in `validate_server_config` accepts `"sse"` and `"streamable_http"` transports for MCP type. Rejects `"stdio"` with a clear error message. Update the transport check from `["sse"]` to `["sse", "streamable_http"]`.

- [ ] **T1.8** Add SSRF validation to server create/update
  - Files: `backend/src/routes/v0/server.py` (EDIT)
  - Acceptance: `validate_server_config` calls `validate_server_url` on `config.url` (MCP) or `config.base_url` (A2A). Returns validation error for private/blocked URLs.

- [ ] **T1.9** Register server router in the API
  - Files: `backend/src/routes/v0/__init__.py` (EDIT)
  - Acceptance: `from .server import router as server` is imported. `app.include_router(server, prefix=prefix)` is added to `create_api_router`. `GET /api/servers` returns 200 (with auth).

---

## Phase 2: Backend -- Assistant-Server Binding

- [ ] **T2.1** Add `server_ids` field to `Assistant` Pydantic model
  - Files: `backend/src/schemas/entities/llm.py` (EDIT)
  - Acceptance: `Assistant` model has `server_ids: Optional[list[str]] = Field(default_factory=list)`. Field is serialized/deserialized correctly. Existing assistants without `server_ids` default to empty list.

- [ ] **T2.2** Add `server_ids` to `LLMRequest` model
  - Files: `backend/src/schemas/entities/llm.py` (EDIT)
  - Acceptance: `LLMRequest` includes `server_ids: Optional[list[str]] = Field(default_factory=list)`. `to_llm_request()` on Assistant passes `server_ids` through.

- [ ] **T2.3** Add assistant-server assignment endpoints
  - Files: `backend/src/routes/v0/assistant.py` (EDIT)
  - Acceptance: Three new endpoints exist:
    - `PUT /api/assistants/{id}/servers` -- body `{"server_ids": [...]}`, updates assistant's `server_ids` field, returns updated assistant
    - `GET /api/assistants/{id}/servers` -- returns list of full `ServerResponse` objects for the assistant's `server_ids`
    - `DELETE /api/assistants/{id}/servers/{server_id}` -- removes one server_id, returns 204

- [ ] **T2.4** Resolve `server_ids` at runtime in `LLMService.init_tools()`
  - Files: `backend/src/services/llm.py` (EDIT)
  - Acceptance: `init_tools` accepts `server_ids` parameter (or reads from request). For each server_id, queries the `Server` table, decrypts config headers, builds an MCP config dict entry. Merges resolved server configs with inline `mcp` dict (inline takes precedence on key conflicts). Missing/deleted servers are skipped with a log warning.

---

## Phase 3: Backend -- Tool Discovery & Connection Testing

- [ ] **T3.1** Implement real `test-connection` endpoint
  - Files: `backend/src/routes/v0/server.py` (EDIT)
  - Acceptance: `POST /api/servers/{server_id}/test-connection` actually connects to the MCP/A2A server URL with a 10-second timeout. Returns real `success`, `latency_ms`, and error details. Remove mock implementation. Remove `include_in_schema=False`.

- [ ] **T3.2** Add tool discovery endpoint
  - Files: `backend/src/routes/v0/server.py` (EDIT)
  - Acceptance: `POST /api/servers/{server_id}/tools` connects to the MCP server using `MultiServerMCPClient`, lists available tools, returns tool names and descriptions. Uses 30-second timeout. User-scoped authorization enforced.

- [ ] **T3.3** Add DNS rebinding check to connection-time validation
  - Files: `backend/src/utils/url_validation.py` (EDIT)
  - Acceptance: Function `validate_resolved_url(url: str) -> None` resolves the hostname via DNS and checks the resolved IP is not private/reserved. Called in test-connection and tool-discovery endpoints before making the outbound request.

- [ ] **T3.4** Add unit tests for server connection and tool discovery
  - Files: `backend/tests/unit/test_server_routes.py` (NEW)
  - Acceptance: Tests cover: test-connection success/failure/timeout, tool discovery success/failure, SSRF blocked at connection time, auth enforcement. Mocks external MCP connections.

---

## Phase 4: Frontend -- Server Management Pages

- [ ] **T4.1** Add `Server` TypeScript entity type (if incomplete)
  - Files: `frontend/src/lib/entities/index.ts` (EDIT)
  - Acceptance: `Server` type includes all fields: `id`, `user_id`, `name`, `slug`, `description`, `type`, `config`, `documentation`, `documentation_url`, `public`, `created_at`, `updated_at`. Matches `ServerResponse` from backend.

- [ ] **T4.2** Extend `serverService.ts` with test-connection and tool-discovery calls
  - Files: `frontend/src/lib/services/serverService.ts` (EDIT)
  - Acceptance: Exports `testConnection(serverId: string)` and `discoverTools(serverId: string)` functions that call the corresponding backend endpoints.

- [ ] **T4.3** Create `ServerForm` component
  - Files: `frontend/src/components/forms/servers/server-form.tsx` (NEW)
  - Acceptance: Form with fields: name, description, type (mcp/a2a), transport (sse/streamable_http for mcp), URL, headers (key-value editor), documentation, documentation_url, public toggle. Zod validation. Supports create and edit modes.

- [ ] **T4.4** Create `ServerCard` component
  - Files: `frontend/src/components/cards/ServerCard.tsx` (NEW)
  - Acceptance: Displays server name, type badge, description, connection status indicator, and action buttons (edit, delete, test connection). Follows existing card component patterns.

- [ ] **T4.5** Create Servers index page
  - Files: `frontend/src/pages/servers/index.tsx` (NEW)
  - Acceptance: Page at `/servers` route lists user's servers using `ServerCard` components. Includes "Create Server" button that opens `ServerForm`. Supports delete with confirmation. Follows existing page patterns (e.g., SettingsPage or agents index).

- [ ] **T4.6** Register `/servers` route in AppRoutes
  - Files: `frontend/src/routes/AppRoutes.tsx` (EDIT)
  - Acceptance: `/servers` route exists, renders `ServersIndexPage`, requires authentication. Route is accessible via browser navigation.

- [ ] **T4.7** Add "Servers" link to navigation
  - Files: `frontend/src/components/nav/ChatNav.tsx` (EDIT) or appropriate sidebar/nav component
  - Acceptance: A "Servers" navigation item appears in the main navigation, links to `/servers`, uses a server/plug icon.

---

## Phase 5: Frontend -- Assistant Integration

- [ ] **T5.1** Create `ServerSelectionModal` component
  - Files: `frontend/src/components/modals/ServerSelectionModal.tsx` (NEW)
  - Acceptance: Modal displays user's saved servers with search/filter. Tabs for "My Servers" and "Public Servers". Checkbox multi-select. Returns selected server IDs on confirm.

- [ ] **T5.2** Add "MCP Servers" section to agent create form
  - Files: `frontend/src/components/forms/agents/agent-create-form.tsx` (EDIT)
  - Acceptance: New section between Tools and SubAgents labeled "MCP Servers". Shows currently assigned servers as chips/tags. "Add Servers" button opens `ServerSelectionModal`. Removing a chip removes the server assignment.

- [ ] **T5.3** Wire server assignment to backend on assistant save
  - Files: `frontend/src/components/forms/agents/agent-create-form.tsx` (EDIT)
  - Acceptance: When saving an assistant, `server_ids` array is included in the payload. On assistant load/edit, `server_ids` are fetched and displayed. Uses `PUT /api/assistants/{id}/servers` endpoint.

- [ ] **T5.4** Add "Import from Saved Servers" option to McpServerPanel
  - Files: `frontend/src/components/modals/ToolSelectionModal/McpServerPanel.tsx` (EDIT)
  - Acceptance: New button "Import from Saved" opens `ServerSelectionModal`. Selecting a server populates the MCP config editor with that server's config. Does not replace the existing inline config workflow -- adds an alternative entry point.

---

## Phase 6: Integration & Testing

- [ ] **T6.1** End-to-end backend test: create server, assign to assistant, resolve at inference
  - Files: `backend/tests/integration/test_server_assistant_integration.py` (NEW)
  - Acceptance: Test creates a server, creates an assistant with `server_ids` referencing it, and verifies `init_tools` resolves the server config correctly. Tests graceful handling of deleted server references.

- [ ] **T6.2** Frontend tests for ServerForm and ServerSelectionModal
  - Files: `frontend/src/tests/servers/ServerForm.test.tsx` (NEW), `frontend/src/tests/servers/ServerSelectionModal.test.tsx` (NEW)
  - Acceptance: Tests cover form validation (required fields, URL format, transport options), create/edit mode switching, modal search/filter, and selection state management.

- [ ] **T6.3** Run full test suite and fix regressions
  - Files: N/A
  - Acceptance: `make test` (backend) and `npm run test` (frontend) pass with zero failures. No regressions in existing functionality.

- [ ] **T6.4** Run formatting and linting
  - Files: N/A
  - Acceptance: `make format` (backend) and `npm run format` (frontend) produce no changes. `npm run lint` has no errors.

---

## Verification

- [ ] All backend tests passing (`make test`)
- [ ] All frontend tests passing (`npm run test`)
- [ ] Linting/formatting clean (`make format`, `npm run format`, `npm run lint`)
- [ ] Server CRUD works end-to-end (create, list, get, update, delete)
- [ ] Assistant-server binding persists and resolves at runtime
- [ ] Test-connection endpoint uses real MCP connection
- [ ] Tool discovery returns real tools from an MCP server
- [ ] Credentials encrypted at rest, redacted in API responses
- [ ] SSRF validation blocks private IPs
- [ ] stdio transport rejected
- [ ] Backward compatibility: existing inline `mcp` config on assistants still works
- [ ] Ready for PR

---

## Completion Signature

- **Total Tasks:** 28
- **Dependencies:**
  - T1.1 -> T1.2 -> T1.3 (model before export before migration)
  - T1.4 -> T1.5 (util before tests)
  - T1.1 + T1.2 + T1.3 -> T1.6, T1.7, T1.8, T1.9 (model must exist before route fixes)
  - Phase 1 -> Phase 2 (server model required for assistant binding)
  - Phase 1 -> Phase 3 (server model required for connection testing)
  - Phase 2 -> T2.4 (endpoints before runtime resolution)
  - T4.1 -> T4.2 -> T4.3, T4.4, T4.5 (types before service before UI)
  - T4.5 -> T4.6, T4.7 (page before route registration)
  - Phase 4 + Phase 2 + Phase 3 -> Phase 5 (all prerequisites for assistant integration)
  - Phase 5 -> Phase 6 (integration tests after all features)
