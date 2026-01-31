# PROPOSAL: Security Architecture for MCP Server Configuration (Issue #709)

**Agent:** AGENT_5 SECURITY_SENTINEL
**Date:** 2026-01-30
**Status:** Draft

---

## Executive Summary

This proposal covers the security architecture for allowing users to store, manage, and assign MCP server configurations to assistants. The feature introduces a new user-scoped entity (`mcp_servers`) in the LangGraph store, CRUD routes protected by existing JWT/API-key authentication, encrypted credential storage using the existing Fernet-based `encrypt_value`/`decrypt_value` pattern, URL validation to prevent SSRF, and strict tenant isolation via the `(user_id, "mcp_servers")` namespace pattern already used throughout the codebase.

---

## 1. Security Architecture

### 1.1 Threat Model

| Threat | Impact | Mitigation |
|--------|--------|------------|
| Unauthorized access to another user's MCP server configs | High - credential leakage | Namespace isolation via `(user_id, "mcp_servers")` |
| Credential theft from stored MCP server auth tokens | Critical | Fernet encryption at rest (existing `encrypt_value`) |
| SSRF via user-provided MCP server URLs | High | URL allowlist validation, block private/internal IPs |
| Injection via server name or metadata fields | Medium | Pydantic validation, length limits, character restrictions |
| Privilege escalation through shared configs | Medium | No cross-user sharing; configs are copied, not referenced |

### 1.2 Authentication

All MCP server configuration endpoints MUST require authentication via `verify_credentials` (the existing FastAPI dependency). This is consistent with how `/assistants`, `/tools`, and other user-scoped routes work.

```python
user: ProtectedUser = Depends(verify_credentials)
```

No anonymous or optional-auth access is appropriate for this feature.

### 1.3 Authorization

There is no role-based access control in the current codebase. All resources are scoped to the authenticated user via namespace isolation. The MCP server feature follows this same pattern -- a user can only read, update, and delete their own server configurations.

If organization/team scoping is added later, the namespace can be extended from `(user_id, "mcp_servers")` to `(org_id, "mcp_servers")` without schema changes.

---

## 2. Access Control and Data Isolation

### 2.1 Namespace Strategy

Following the existing pattern from `BaseRepo`, `ToolRepo`, and `AssistantService`:

```python
def _get_namespace(self):
    return (self.user_id, "mcp_servers")
```

This guarantees:
- User A cannot read User B's MCP server configs.
- Store operations are always scoped by the authenticated `user_id` injected from `verify_credentials`.
- No `user_id` parameter is accepted from the request body -- it is always derived from the JWT/API token.

### 2.2 Assistant Assignment Isolation

When assigning MCP servers to an assistant, the system MUST verify:
1. The MCP server config belongs to the authenticated user (read from user's namespace).
2. The assistant belongs to the authenticated user (read from user's assistant namespace).

The assignment should copy the resolved MCP config into the assistant's `mcp` dict (the existing `Assistant.mcp: Optional[dict]` field), not store a foreign-key reference. This avoids cross-namespace lookups at runtime and prevents broken references if a server config is deleted.

### 2.3 Public Assistants

When an assistant is published (via `/assistants/{id}/publish`), the `mcp` config is already included in the published data. The `PublicAssistant` projection intentionally excludes `mcp`, `tools`, `a2a`, `files`, and other sensitive fields. This is correct and should remain unchanged. No MCP credentials should ever appear in the public namespace.

---

## 3. Credential Management

### 3.1 Storage Model

MCP servers typically require authentication headers (Bearer tokens, API keys). The proposed `McpServerConfig` entity:

```python
class McpServerConfig(BaseModel):
    name: str                                          # Display name
    transport: Literal["sse", "streamable_http", "stdio"]
    url: str                                           # Server endpoint URL
    headers: Optional[dict[str, str]] = {}             # Auth headers (encrypted at rest)
    metadata: Optional[dict] = {}                      # User-defined tags/notes
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
```

### 3.2 Encryption at Rest

Follow the exact pattern from `ToolRepo.create()`:

```python
# On write
if config.headers:
    config_data["headers"] = encrypt_value(config_data["headers"])

# On read
if "headers" in config_data:
    config_data["headers"] = decrypt_value(config_data["headers"])
```

This uses the existing Fernet symmetric encryption backed by `APP_SECRET_KEY`. The encrypted blob is stored as a string in the LangGraph store value dict.

### 3.3 Credential Display

API responses for listing/searching MCP server configs MUST redact credentials:

```python
def redact_headers(headers: dict) -> dict:
    return {k: "***" for k in headers} if headers else {}
```

Full headers are only decrypted when:
- Loading tools from the MCP server at assistant runtime.
- Explicitly requested via a dedicated "test connection" endpoint (authenticated).

### 3.4 Key Rotation

The existing `APP_SECRET_KEY` / Fernet approach does not support transparent key rotation. This is a pre-existing limitation. If key rotation is needed in the future, a migration script would re-encrypt all stored values. This is out of scope for this feature but should be documented.

---

## 4. Input Validation

### 4.1 URL Validation

The `url` field on `McpServerConfig` MUST be validated to prevent SSRF:

```python
from pydantic import field_validator
from urllib.parse import urlparse
import ipaddress

BLOCKED_SCHEMES = {"file", "ftp", "gopher", "data", "javascript"}
ALLOWED_SCHEMES = {"http", "https"}

@field_validator("url")
@classmethod
def validate_url(cls, v: str) -> str:
    parsed = urlparse(v)

    # 1. Scheme check
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise ValueError(f"URL scheme must be http or https, got: {parsed.scheme}")

    # 2. Host check - block empty
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL must include a hostname")

    # 3. Block private/reserved IPs
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local:
            raise ValueError("URLs pointing to private/internal networks are not allowed")
    except ValueError as e:
        if "not allowed" in str(e):
            raise
        # hostname is not an IP literal -- allow DNS names
        pass

    # 4. Block known internal hostnames
    blocked_hosts = {"localhost", "127.0.0.1", "0.0.0.0", "metadata.google.internal",
                     "169.254.169.254", "[::1]"}
    if hostname.lower() in blocked_hosts:
        raise ValueError("URLs pointing to internal services are not allowed")

    # 5. Length limit
    if len(v) > 2048:
        raise ValueError("URL exceeds maximum length of 2048 characters")

    return v
```

### 4.2 DNS Rebinding Prevention

At connection time (when tools are loaded from the MCP server), the resolved IP should be checked again. This is a runtime check in the MCP client initialization:

```python
import socket

def resolve_and_validate(hostname: str) -> str:
    """Resolve hostname and verify it does not point to a private IP."""
    try:
        resolved = socket.getaddrinfo(hostname, None)
        for family, _, _, _, sockaddr in resolved:
            ip = ipaddress.ip_address(sockaddr[0])
            if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local:
                raise ValueError(f"Resolved IP {ip} is private/internal -- connection blocked")
    except socket.gaierror:
        raise ValueError(f"Could not resolve hostname: {hostname}")
```

### 4.3 Name and Metadata Validation

```python
@field_validator("name")
@classmethod
def validate_name(cls, v: str) -> str:
    if not v or len(v) > 128:
        raise ValueError("Name must be 1-128 characters")
    if not re.match(r'^[a-zA-Z0-9_\-\s.]+$', v):
        raise ValueError("Name contains invalid characters")
    return v.strip()
```

### 4.4 Transport Validation

The `transport` field is already constrained by `Literal["sse", "streamable_http", "stdio"]`. For `stdio` transport, the `url` field would represent a command path. **STDIO transport should be disallowed in the cloud-hosted environment** since it implies local process execution:

```python
@model_validator(mode="after")
def block_stdio_in_cloud(self):
    if self.transport == "stdio":
        raise ValueError("stdio transport is not supported in cloud deployments")
    return self
```

---

## 5. SSRF Prevention Summary

| Layer | Control |
|-------|---------|
| Input validation | Pydantic validator blocks private IPs, internal hostnames, non-http schemes |
| DNS resolution | Runtime check after DNS resolution to catch rebinding |
| Network policy | (Infrastructure) Egress firewall rules limiting backend outbound to known ports |
| Transport restriction | Block `stdio` transport type in cloud deployments |
| Timeout | Connection timeout on MCP client (e.g., 10 seconds) to limit slow-loris style attacks |

---

## 6. Proposed API Endpoints

All under `/api/v0/mcp-servers`, all requiring `verify_credentials`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/mcp-servers` | Create a new MCP server config |
| POST | `/mcp-servers/search` | List/search user's MCP server configs (follows existing search pattern) |
| GET | `/mcp-servers/{server_id}` | Get a single MCP server config (headers redacted) |
| PUT | `/mcp-servers/{server_id}` | Update an MCP server config |
| DELETE | `/mcp-servers/{server_id}` | Delete an MCP server config |
| POST | `/mcp-servers/{server_id}/test` | Test connectivity to the MCP server (returns available tools list) |

### 6.1 Server ID Format

Use `uuid4` for server IDs, generated server-side. Do not accept user-provided IDs. Validate format on path parameters:

```python
@field_validator("server_id")
def validate_server_id(cls, v):
    uuid.UUID(v, version=4)  # Raises ValueError if invalid
    return v
```

---

## 7. Data Flow: Assign MCP Server to Assistant

```
1. User selects MCP server config(s) from their saved list
2. Frontend sends PUT /assistants/{id} with mcp dict populated from saved configs
3. Backend reads MCP server configs from (user_id, "mcp_servers") namespace
4. Backend decrypts headers
5. Backend writes the full MCP config (with decrypted headers) into assistant's mcp field
6. Assistant mcp field is stored in (user_id, "assistants") namespace
7. At runtime, LLM service reads assistant.mcp and passes to MultiServerMCPClient
```

Key security note: The assistant's `mcp` dict already stores server configs inline. This means credentials are stored in two places: the `mcp_servers` entity (encrypted) and the assistant entity (as part of the mcp dict). The assistant entity storage should also encrypt the headers within the mcp dict. This is a gap in the current implementation that should be addressed.

**Recommendation:** Add encryption of `assistant.mcp` headers on write and decryption on read in `AssistantService`, consistent with how `ToolRepo` handles `env`.

---

## 8. Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Stored credentials leaked via API response | High | Medium | Redact headers in list/get responses |
| SSRF to internal services | High | Medium | Multi-layer URL validation + DNS check |
| Cross-tenant data access | Critical | Low | Namespace isolation (proven pattern) |
| Credential loss on APP_SECRET_KEY rotation | Medium | Low | Document migration procedure |
| MCP server impersonation | Medium | Low | TLS verification on outbound connections |
| Denial of service via slow MCP server | Low | Medium | Connection/read timeouts |

---

## 9. Complexity Estimate

| Component | Effort | Notes |
|-----------|--------|-------|
| `McpServerConfig` Pydantic model + validators | Small | ~100 LOC |
| `McpServerRepo` (store CRUD) | Small | ~80 LOC, follows `BaseRepo` pattern |
| `McpServerService` | Small | ~60 LOC |
| Route file `/routes/v0/mcp_servers.py` | Medium | ~150 LOC, 6 endpoints |
| URL/SSRF validation utilities | Small | ~50 LOC |
| Integration into `ServiceContext` | Trivial | Add one service |
| Integration into `BaseRepo._format` | Trivial | Add one entity type |
| Assistant MCP header encryption | Small | ~30 LOC in `AssistantService` |
| Test connection endpoint | Medium | ~80 LOC, requires async MCP client call |
| Unit tests | Medium | ~200 LOC |
| **Total** | **~750-850 LOC** | **~2-3 days** |

---

## 10. Recommendations

1. **Do not implement org/team sharing in v1.** Keep configs user-scoped. Sharing can be added later by introducing a `(org_id, "mcp_servers")` namespace.

2. **Encrypt MCP headers in assistant.mcp on save.** This closes a gap where credentials in the assistant entity are stored in plaintext.

3. **Block stdio transport.** It implies local process execution which is inappropriate for a cloud deployment.

4. **Add rate limiting to the test-connection endpoint.** Each test initiates an outbound connection. Use the existing rate limiting utilities.

5. **Log all MCP server config mutations** (create, update, delete) with user ID for audit trail. The existing logger pattern is sufficient.

6. **Set connection timeouts** of 10 seconds for MCP server connections and 30 seconds for tool listing operations.

7. **Do not expose raw error messages** from MCP server connections to the client. Wrap in generic "connection failed" errors to prevent information disclosure about internal network topology.
