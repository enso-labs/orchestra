# PRD: MCP Server Configuration

## Introduction

Allow users to configure, persist, and manage MCP (Model Context Protocol) server connections through the Orchestra platform. Currently, MCP server configs are ephemeral and must be re-entered each session. This feature adds a `servers` PostgreSQL table so users can create reusable server configurations, assign them to assistants, discover available tools, and share configs across multiple assistants. The implementation spans database schema, backend CRUD APIs, runtime tool resolution, and full frontend management UI.

**Issue:** #709
**Branch:** `feat/709-users-should-be-able-to-configure-servers-mcp`

## Goals

- Persist MCP server configurations in PostgreSQL with encryption for secrets
- Provide full CRUD API at `/api/servers` for managing server configs
- Allow assigning multiple saved servers to any assistant
- Resolve assigned servers at runtime in LLMService for tool availability
- Enable tool discovery and connection testing before saving
- Build frontend UI for server management and assistant assignment
- Enforce security: SSRF validation, DNS rebinding protection, stdio transport blocked, credential redaction

## User Stories

### US-001: Create Server SQLAlchemy model and Alembic migration

**Description:** As a developer, I need the `servers` database table and SQLAlchemy model so that server configurations can be persisted.

**Acceptance Criteria:**
- [ ] Server SQLAlchemy model created with fields: id (UUID), name, slug (auto-generated), url, transport (enum: sse, streamable_http), config (encrypted JSON), user_id, created_at, updated_at
- [ ] Model exported from models package `__init__.py`
- [ ] Alembic migration generated and applies cleanly
- [ ] stdio transport is not allowed in the model/enum
- [ ] Typecheck passes

**Files:** `app/models/server.py`, `app/models/__init__.py`, `alembic/versions/<new_migration>.py`

---

### US-002: Create Server Pydantic schemas

**Description:** As a developer, I need request/response schemas for the server API so that input validation and response serialization are handled.

**Acceptance Criteria:**
- [ ] ServerCreate, ServerUpdate, ServerResponse Pydantic schemas defined
- [ ] Config secrets are redacted in ServerResponse
- [ ] Transport field only allows "sse" and "streamable_http"
- [ ] URL field has SSRF validation (block private IPs, localhost)
- [ ] Typecheck passes

**Files:** `app/schemas/server.py`, `app/schemas/__init__.py`

---

### US-003: Create ServerService with CRUD operations

**Description:** As a developer, I need a service layer for server CRUD so that the API routes have clean business logic.

**Acceptance Criteria:**
- [ ] ServerService with create, get_by_id, list_by_user, update, delete methods
- [ ] Config secrets encrypted with Fernet before storage, decrypted on read
- [ ] Name uniqueness enforced per user
- [ ] Typecheck passes

**Files:** `app/services/server_service.py`, `app/services/__init__.py`

---

### US-004: Register server API routes

**Description:** As a developer, I need REST endpoints at `/api/servers` so that the frontend can manage server configurations.

**Acceptance Criteria:**
- [ ] POST /api/servers - create server config
- [ ] GET /api/servers - list user's servers
- [ ] GET /api/servers/{id} - get single server
- [ ] PUT /api/servers/{id} - update server config
- [ ] DELETE /api/servers/{id} - delete server config
- [ ] Routes registered in app router
- [ ] Typecheck passes

**Files:** `app/api/routes/servers.py`, `app/api/routes/__init__.py`

---

### US-005: Add server_ids field to Assistant model

**Description:** As a developer, I need the Assistant model to reference server configurations so that assistants can have MCP servers assigned.

**Acceptance Criteria:**
- [ ] `server_ids` column added to Assistant model (JSON array of UUIDs)
- [ ] Alembic migration for the new column
- [ ] Assistant Pydantic schemas updated with optional server_ids field
- [ ] Typecheck passes

**Files:** `app/models/assistant.py`, `alembic/versions/<new_migration>.py`, `app/schemas/assistant.py`

---

### US-006: Create server assignment endpoints

**Description:** As a developer, I need API endpoints to assign and unassign servers to assistants so that the frontend can manage the relationship.

**Acceptance Criteria:**
- [ ] POST /api/assistants/{id}/servers - assign server_ids to assistant
- [ ] GET /api/assistants/{id}/servers - list assigned servers
- [ ] DELETE /api/assistants/{id}/servers/{server_id} - unassign a server
- [ ] Removing assignment does not delete the server config
- [ ] Typecheck passes

**Files:** `app/api/routes/assistants.py` (or `servers.py`)

---

### US-007: Resolve server_ids at runtime in LLMService

**Description:** As a developer, I need LLMService to load MCP server configs at runtime so that assigned servers are available as tool providers during inference.

**Acceptance Criteria:**
- [ ] LLMService.init_tools() reads server_ids from the assistant/request
- [ ] Server configs fetched from DB and decrypted
- [ ] MultiServerMCPClient initialized with resolved server configs
- [ ] Works with SSE and streamable_http transports
- [ ] Typecheck passes

**Files:** `app/services/llm_service.py`

---

### US-008: Add test-connection and tool discovery endpoints

**Description:** As a developer, I need endpoints to test server connectivity and discover available tools so that users can verify configs before saving.

**Acceptance Criteria:**
- [ ] POST /api/servers/test-connection - tests connectivity to a server URL
- [ ] GET /api/servers/{id}/tools - discovers and returns available tools from a saved server
- [ ] DNS rebinding protection applied to connection targets
- [ ] Rate limiting on test-connection endpoint
- [ ] Typecheck passes

**Files:** `app/api/routes/servers.py`

---

### US-009: Add TypeScript types and API service for servers

**Description:** As a frontend developer, I need TypeScript types and API service functions for servers so that UI components can interact with the backend.

**Acceptance Criteria:**
- [ ] Server TypeScript interface defined (id, name, slug, url, transport, config, tools)
- [ ] API service functions: createServer, getServers, getServer, updateServer, deleteServer, testConnection, discoverTools
- [ ] useServer hook created following existing hook patterns
- [ ] Typecheck passes

**Files:** `src/types/server.ts`, `src/services/serverService.ts`, `src/hooks/useServer.ts`

---

### US-010: Create ServerForm component

**Description:** As a frontend developer, I need a form component for creating and editing server configurations so that users can input server details.

**Acceptance Criteria:**
- [ ] ServerForm with fields: name, URL, transport dropdown (SSE / streamable_http), config JSON editor
- [ ] Test Connection button that calls the test-connection API
- [ ] Form validation (required fields, URL format)
- [ ] Works for both create and edit modes
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

**Files:** `src/components/servers/ServerForm.tsx`

---

### US-011: Create ServerCard and ServersIndexPage

**Description:** As a frontend developer, I need a server list page so that users can view, search, and manage their saved server configurations.

**Acceptance Criteria:**
- [ ] ServerCard component showing name, URL, transport, action buttons (edit, delete)
- [ ] ServersIndexPage listing all user servers with search/filter by name
- [ ] Delete confirmation dialog
- [ ] Route registered and navigation link added
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

**Files:** `src/components/servers/ServerCard.tsx`, `src/pages/ServersIndexPage.tsx`, `src/routes.tsx` (or equivalent)

---

### US-012: Add MCP Servers section to assistant form

**Description:** As a frontend developer, I need an MCP Servers section in the assistant create/edit form so that users can assign saved servers to an assistant.

**Acceptance Criteria:**
- [ ] ServerSelectionModal component for browsing and selecting saved servers
- [ ] MCP Servers section in assistant form showing assigned servers
- [ ] Can add/remove server assignments
- [ ] "Import from Saved" option in McpServerPanel
- [ ] Changes persisted via assignment API on save
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

**Files:** `src/components/servers/ServerSelectionModal.tsx`, `src/components/assistants/McpServerPanel.tsx` (or equivalent assistant form file)

---

### US-013: Backend integration tests

**Description:** As a developer, I need integration tests for the server CRUD and assignment APIs to ensure correctness.

**Acceptance Criteria:**
- [ ] Tests for server CRUD lifecycle (create, read, update, delete)
- [ ] Tests for server assignment to assistants
- [ ] Tests for SSRF validation (blocked URLs rejected)
- [ ] Tests for transport restriction (stdio rejected)
- [ ] Tests for config encryption/decryption round-trip
- [ ] Typecheck passes

**Files:** `tests/test_servers.py`

---

### US-014: Frontend tests and full formatting pass

**Description:** As a developer, I need frontend component tests and a final formatting/lint pass to ensure quality.

**Acceptance Criteria:**
- [ ] Tests for ServerForm, ServerCard, ServerSelectionModal components
- [ ] Full test suite passes
- [ ] Linting and formatting pass
- [ ] Typecheck passes

**Files:** `src/components/servers/__tests__/`

## Functional Requirements

- FR-1: The system must store MCP server configurations in a `servers` PostgreSQL table with UUID primary key and auto-generated slug
- FR-2: The system must encrypt server config secrets using Fernet encryption before persisting to the database
- FR-3: The system must redact config secrets in all API responses (ServerResponse schema)
- FR-4: The system must reject server configurations using stdio transport; only SSE and streamable_http are allowed
- FR-5: The system must validate server URLs against SSRF attacks (block private IPs, localhost, link-local addresses)
- FR-6: The system must enforce unique server names per user
- FR-7: The system must provide CRUD endpoints at `/api/servers` (POST, GET list, GET by id, PUT, DELETE)
- FR-8: The system must allow assigning multiple server configs to an assistant via `server_ids` JSON array field
- FR-9: The system must provide assignment endpoints: POST/GET/DELETE at `/api/assistants/{id}/servers`
- FR-10: Deleting a server assignment must not delete the underlying server config
- FR-11: LLMService.init_tools() must resolve server_ids from the assistant, fetch and decrypt configs, and initialize MultiServerMCPClient
- FR-12: The system must provide a POST `/api/servers/test-connection` endpoint with DNS rebinding protection and rate limiting
- FR-13: The system must provide a GET `/api/servers/{id}/tools` endpoint that discovers available tools via MultiServerMCPClient
- FR-14: The frontend must provide ServerForm, ServerCard, ServersIndexPage, and ServerSelectionModal components
- FR-15: The frontend must add an MCP Servers section to the assistant create/edit form with "Import from Saved" capability

## Non-Goals

- No stdio transport support (security risk in hosted environment)
- No server-to-server sharing between users (configs are per-user only)
- No automatic tool selection or recommendation
- No MCP server health monitoring or uptime tracking
- No OAuth/token refresh flows for MCP server authentication (manual config only)
- No bulk import/export of server configurations

## Technical Considerations

- **Database:** PostgreSQL with Alembic migrations. Two migrations: one for `servers` table, one for `server_ids` on `assistants`.
- **Encryption:** Fernet symmetric encryption from the `cryptography` package for config secrets at rest.
- **Security:** SSRF validation on URLs (block RFC 1918, loopback, link-local). DNS rebinding checks on test-connection. Credential redaction in responses.
- **Runtime resolution:** server_ids resolved lazily in LLMService.init_tools() -- configs fetched from DB, decrypted, and passed to MultiServerMCPClient.
- **Existing patterns:** Follow existing route registration, service layer, and Pydantic schema patterns in the codebase. Frontend follows existing hook/service/component conventions.
- **Dependency order:** US-001 through US-004 (schema + backend CRUD) must complete before US-005 through US-008 (assignment + runtime). Frontend stories (US-009 through US-012) depend on backend APIs being available.

## Success Metrics

- Users can create, edit, and delete MCP server configurations in under 3 clicks each
- Server configs persist across sessions and are reusable across multiple assistants
- Test-connection provides clear pass/fail feedback before saving
- Tool discovery returns the correct tool list from connected MCP servers
- No plaintext secrets exposed in API responses or browser network tab
- All typechecks and tests pass

## Open Questions

- Should there be a limit on the number of servers per user or per assistant?
- Should server configs support environment variable references for secrets (instead of direct values)?
- Should tool discovery results be cached, and if so, for how long?
- How should the system handle a server that was reachable at config time but is unreachable at inference time?
