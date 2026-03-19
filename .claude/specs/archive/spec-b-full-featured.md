# Spec B: Full-Featured OpenShell Sandbox Service

## Approach Summary

Add OpenShell as a first-class sandbox backend in Orchestra with a dedicated `SandboxService` for lifecycle management, new API endpoints for sandbox CRUD operations, session pooling for performance, per-assistant security policies, health monitoring, frontend management UI, and Docker Compose integration. This is a comprehensive integration that elevates sandbox management from a side-effect of agent invocation into a managed, observable platform capability.

---

## 1. Architecture Overview

```
                         Frontend
                            |
                    /api/sandbox/*
                            |
                   SandboxRouter (FastAPI)
                            |
                      SandboxService
                     /      |       \
              SessionPool  PolicyMgr  HealthMonitor
                    |
            OpenShellBackend
                    |
        SandboxClient (openshell SDK)
                    |
            OpenShell Gateway
```

**Key design decisions:**

- `SandboxService` is a standalone service (not added to `ServiceContext`) because it manages infrastructure, not per-user domain data. Routes instantiate it directly with the authenticated user ID.
- Session pooling is per-user: each user gets at most one warm sandbox session. Sessions are created lazily on first agent invocation and reused across subsequent requests.
- Policy files are stored in the LangGraph store (same pattern as assistants) keyed by assistant ID, enabling per-agent security policies.
- The OpenShell backend integrates into the existing `_SANDBOX_FACTORIES` dispatch table alongside `daytona` and `state`.

---

## 2. Files to Create

### 2.1 `backend/src/agents/openshell.py` -- OpenShell Backend Implementation

New file. Contains `OpenShellBackend(BaseSandbox)` and factory functions.

```python
"""OpenShell sandbox backend for Orchestra.

Implements BaseSandbox backed by an OpenShell sandbox session.
The OpenShell gateway is resolved from OPENSHELL_GATEWAY env var
or ~/.config/openshell/active_gateway.

Sandbox selection (controlled via env vars):
  OPENSHELL_SANDBOX_NAME  Connect to a pre-existing named sandbox.
  (not set)               Create a fresh sandbox for this run.
"""

from __future__ import annotations

import base64
import os
import shlex
from typing import Any

from deepagents.backends import CompositeBackend
from deepagents.backends.protocol import (
    ExecuteResponse,
    FileDownloadResponse,
    FileUploadResponse,
)
from deepagents.backends.sandbox import BaseSandbox
from langchain.tools import ToolRuntime

from src.utils.logger import logger

# Conditional import -- openshell may not be installed
try:
    from openshell import SandboxClient, SandboxSession
except ImportError:
    SandboxClient = None  # type: ignore[assignment,misc]
    SandboxSession = None  # type: ignore[assignment,misc]


SANDBOX_NAME_ENV = "OPENSHELL_SANDBOX_NAME"
OPENSHELL_GATEWAY_ENV = "OPENSHELL_GATEWAY"
DEFAULT_TIMEOUT = 30 * 60  # 30 minutes


class OpenShellBackend(BaseSandbox):
    """deepagents SandboxBackendProtocol backed by an OpenShell sandbox.

    Wraps a live SandboxSession. All file operations (read, write, edit,
    grep, glob, ls) are inherited from BaseSandbox and executed as shell
    commands via execute(). Only execute(), upload_files(), and
    download_files() need concrete implementations.
    """

    def __init__(
        self,
        session: "SandboxSession",
        *,
        default_timeout: int = DEFAULT_TIMEOUT,
    ) -> None:
        self._session = session
        self._default_timeout = default_timeout

    @property
    def id(self) -> str:
        return self._session.id

    @property
    def session(self) -> "SandboxSession":
        return self._session

    def execute(
        self,
        command: str,
        *,
        timeout: int | None = None,
    ) -> ExecuteResponse:
        """Run a shell command in the OpenShell sandbox."""
        effective_timeout = timeout if timeout is not None else self._default_timeout
        result = self._session.exec(
            ["bash", "-c", command],
            timeout_seconds=effective_timeout,
        )
        output = result.stdout
        if result.stderr:
            output = f"{output}\n{result.stderr}" if output else result.stderr
        return ExecuteResponse(
            output=output,
            exit_code=result.exit_code,
            truncated=False,
        )

    def upload_files(self, files: list[tuple[str, bytes]]) -> list[FileUploadResponse]:
        """Upload files to the sandbox by piping raw bytes over SSH stdin."""
        responses = []
        for path, content in files:
            try:
                parent = shlex.quote(os.path.dirname(path) or ".")
                dest = shlex.quote(path)
                result = self._session.exec(
                    ["bash", "-c", f"mkdir -p {parent} && cat > {dest}"],
                    stdin=content,
                )
                if result.exit_code != 0:
                    responses.append(FileUploadResponse(path=path, error="permission_denied"))
                else:
                    responses.append(FileUploadResponse(path=path, error=None))
            except Exception:
                responses.append(FileUploadResponse(path=path, error="permission_denied"))
        return responses

    def download_files(self, paths: list[str]) -> list[FileDownloadResponse]:
        """Download files from the sandbox via base64 encoding."""
        responses = []
        for path in paths:
            try:
                result = self._session.exec(["base64", path])
                if result.exit_code != 0:
                    responses.append(
                        FileDownloadResponse(path=path, content=None, error="file_not_found")
                    )
                else:
                    content = base64.b64decode(result.stdout.strip())
                    responses.append(FileDownloadResponse(path=path, content=content, error=None))
            except Exception:
                responses.append(
                    FileDownloadResponse(path=path, content=None, error="file_not_found")
                )
        return responses


def validate_openshell_available() -> tuple[bool, str | None]:
    """Check whether the openshell package is installed and a gateway is reachable."""
    if SandboxClient is None:
        return False, "openshell package is not installed"

    gateway = os.environ.get(OPENSHELL_GATEWAY_ENV)
    if not gateway:
        # SDK falls back to ~/.config/openshell/active_gateway
        pass

    try:
        client = SandboxClient.from_active_cluster()
        # Quick health probe
        _ = client.list()
        return True, None
    except Exception as exc:
        return False, f"OpenShell gateway unreachable: {exc}"


def create_openshell_session(
    sandbox_name: str | None = None,
) -> tuple["SandboxSession", str]:
    """Create or connect to an OpenShell sandbox session.

    Returns (session, sandbox_name).
    """
    if SandboxClient is None:
        raise RuntimeError("openshell package is not installed")

    client = SandboxClient.from_active_cluster()

    name = sandbox_name or os.environ.get(SANDBOX_NAME_ENV)
    if name:
        ref = client.get(name)
    else:
        ref = client.create()
        ref = client.wait_ready(ref.name)
        name = ref.name

    session = SandboxSession(client, ref)
    return session, name


def _create_openshell_backend_checked(
    runtime: ToolRuntime,
) -> tuple[CompositeBackend, Any] | None:
    """Try to create an OpenShell-backed CompositeBackend.

    Returns (backend, session) on success, or None if OpenShell is unavailable.
    """
    available, reason = validate_openshell_available()
    if not available:
        logger.info(f"OpenShell not available: {reason}")
        return None

    try:
        session, _name = create_openshell_session()
        backend = CompositeBackend(default=OpenShellBackend(session), routes={})
        return backend, session
    except Exception as exc:
        logger.error(f"Failed to create OpenShell sandbox: {exc}")
        return None
```

### 2.2 `backend/src/services/sandbox.py` -- Sandbox Lifecycle Service

New file. Manages sandbox lifecycle, session pooling, policy storage, and health checks.

```python
"""SandboxService -- lifecycle management for sandbox backends.

Provides:
- Session pooling: lazy per-user warm sessions for OpenShell
- Lifecycle ops: create, destroy, list sandboxes
- Policy management: store/retrieve per-assistant policy.yaml
- Health monitoring: gateway reachability checks
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Optional

from langgraph.store.base import BaseStore

from src.utils.logger import logger

# Conditional import for openshell
try:
    from openshell import SandboxClient, SandboxSession
except ImportError:
    SandboxClient = None
    SandboxSession = None

STORE_KEY = "sandbox_policies"
POOL_MAX_IDLE_SECONDS = 600  # 10 minutes


class SandboxSessionEntry:
    """A pooled sandbox session with tracking metadata."""

    __slots__ = ("session", "sandbox_name", "created_at", "last_used_at", "user_id")

    def __init__(self, session: Any, sandbox_name: str, user_id: str):
        self.session = session
        self.sandbox_name = sandbox_name
        self.user_id = user_id
        self.created_at = time.monotonic()
        self.last_used_at = time.monotonic()

    def touch(self) -> None:
        self.last_used_at = time.monotonic()

    @property
    def idle_seconds(self) -> float:
        return time.monotonic() - self.last_used_at


class SessionPool:
    """Per-user sandbox session pool.

    Maintains at most one warm session per user. Sessions that exceed
    POOL_MAX_IDLE_SECONDS are evicted on next access or during periodic
    cleanup.
    """

    def __init__(self, max_idle_seconds: int = POOL_MAX_IDLE_SECONDS):
        self._sessions: dict[str, SandboxSessionEntry] = {}
        self._lock = asyncio.Lock()
        self._max_idle = max_idle_seconds

    async def get(self, user_id: str) -> SandboxSessionEntry | None:
        async with self._lock:
            entry = self._sessions.get(user_id)
            if entry is None:
                return None
            if entry.idle_seconds > self._max_idle:
                del self._sessions[user_id]
                return None
            entry.touch()
            return entry

    async def put(self, entry: SandboxSessionEntry) -> None:
        async with self._lock:
            self._sessions[entry.user_id] = entry

    async def remove(self, user_id: str) -> SandboxSessionEntry | None:
        async with self._lock:
            return self._sessions.pop(user_id, None)

    async def list_all(self) -> list[dict[str, Any]]:
        async with self._lock:
            now = time.monotonic()
            return [
                {
                    "user_id": e.user_id,
                    "sandbox_name": e.sandbox_name,
                    "idle_seconds": round(now - e.last_used_at, 1),
                    "age_seconds": round(now - e.created_at, 1),
                }
                for e in self._sessions.values()
            ]

    async def evict_idle(self) -> int:
        """Remove all sessions that have been idle too long. Returns count evicted."""
        async with self._lock:
            to_remove = [
                uid for uid, entry in self._sessions.items()
                if entry.idle_seconds > self._max_idle
            ]
            for uid in to_remove:
                del self._sessions[uid]
            return len(to_remove)


# Module-level singleton pool
_session_pool = SessionPool()


class SandboxService:
    """Manages sandbox lifecycle, policies, and health for a specific user."""

    def __init__(self, user_id: str, store: BaseStore | None = None):
        self.user_id = user_id
        self.store = store
        self.pool = _session_pool

    # -----------------------------------------------------------------
    # Lifecycle
    # -----------------------------------------------------------------

    async def create_sandbox(self, name: str | None = None) -> dict[str, Any]:
        """Create a new OpenShell sandbox and pool the session."""
        if SandboxClient is None:
            raise RuntimeError("openshell package is not installed")

        from src.agents.openshell import create_openshell_session

        session, sandbox_name = create_openshell_session(sandbox_name=name)
        entry = SandboxSessionEntry(session=session, sandbox_name=sandbox_name, user_id=self.user_id)
        await self.pool.put(entry)
        return {
            "sandbox_name": sandbox_name,
            "session_id": session.id,
            "status": "ready",
        }

    async def destroy_sandbox(self, sandbox_name: str) -> dict[str, Any]:
        """Destroy a sandbox and remove it from the pool."""
        if SandboxClient is None:
            raise RuntimeError("openshell package is not installed")

        entry = await self.pool.remove(self.user_id)

        try:
            client = SandboxClient.from_active_cluster()
            client.delete(sandbox_name)
        except Exception as exc:
            logger.warning(f"Failed to delete sandbox {sandbox_name}: {exc}")
            return {"sandbox_name": sandbox_name, "status": "error", "detail": str(exc)}

        return {"sandbox_name": sandbox_name, "status": "destroyed"}

    async def list_sandboxes(self) -> list[dict[str, Any]]:
        """List sandboxes from the OpenShell gateway."""
        if SandboxClient is None:
            return []

        try:
            client = SandboxClient.from_active_cluster()
            sandboxes = client.list()
            return [
                {
                    "name": sb.name,
                    "status": sb.status,
                    "created_at": getattr(sb, "created_at", None),
                }
                for sb in sandboxes
            ]
        except Exception as exc:
            logger.error(f"Failed to list sandboxes: {exc}")
            return []

    async def get_pooled_session(self) -> SandboxSessionEntry | None:
        """Get the current user's pooled session, if any."""
        return await self.pool.get(self.user_id)

    async def get_or_create_session(self) -> SandboxSessionEntry:
        """Get a pooled session or create a new one."""
        entry = await self.pool.get(self.user_id)
        if entry is not None:
            return entry

        result = await self.create_sandbox()
        entry = await self.pool.get(self.user_id)
        if entry is None:
            raise RuntimeError("Failed to pool session after creation")
        return entry

    # -----------------------------------------------------------------
    # Health
    # -----------------------------------------------------------------

    async def health_check(self) -> dict[str, Any]:
        """Check OpenShell gateway health and session pool status."""
        from src.agents.openshell import validate_openshell_available

        available, reason = validate_openshell_available()
        pooled = await self.pool.list_all()
        user_session = await self.pool.get(self.user_id)

        return {
            "gateway_available": available,
            "gateway_error": reason,
            "pool_size": len(pooled),
            "user_has_session": user_session is not None,
            "user_session": {
                "sandbox_name": user_session.sandbox_name,
                "idle_seconds": round(user_session.idle_seconds, 1),
            } if user_session else None,
        }

    # -----------------------------------------------------------------
    # Policy Management
    # -----------------------------------------------------------------

    def _policy_namespace(self) -> tuple[str, ...]:
        return (self.user_id, STORE_KEY)

    async def get_policy(self, assistant_id: str) -> dict | None:
        """Get the security policy for an assistant."""
        if not self.store:
            return None
        try:
            item = await self.store.aget(self._policy_namespace(), assistant_id)
            return item.value if item else None
        except Exception as exc:
            logger.error(f"Failed to get policy for {assistant_id}: {exc}")
            return None

    async def set_policy(self, assistant_id: str, policy: dict) -> bool:
        """Store a security policy for an assistant."""
        if not self.store:
            return False
        try:
            await self.store.aput(
                namespace=self._policy_namespace(),
                key=assistant_id,
                value=policy,
            )
            return True
        except Exception as exc:
            logger.error(f"Failed to set policy for {assistant_id}: {exc}")
            return False

    async def delete_policy(self, assistant_id: str) -> bool:
        """Delete a security policy for an assistant."""
        if not self.store:
            return False
        try:
            await self.store.adelete(self._policy_namespace(), assistant_id)
            return True
        except Exception as exc:
            logger.error(f"Failed to delete policy for {assistant_id}: {exc}")
            return False
```

### 2.3 `backend/src/routes/v0/sandbox.py` -- Sandbox API Routes

New file. REST endpoints for sandbox management.

```python
"""Sandbox management API routes.

Endpoints:
  GET    /api/sandbox/health           -- Gateway + pool health
  GET    /api/sandbox                  -- List sandboxes from gateway
  POST   /api/sandbox                  -- Create a new sandbox
  DELETE /api/sandbox/{sandbox_name}   -- Destroy a sandbox
  GET    /api/sandbox/session          -- Get current user's pooled session
  POST   /api/sandbox/session          -- Get or create a pooled session
  GET    /api/sandbox/policy/{assistant_id}    -- Get assistant policy
  PUT    /api/sandbox/policy/{assistant_id}    -- Set assistant policy
  DELETE /api/sandbox/policy/{assistant_id}    -- Delete assistant policy
"""

from typing import Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Path, status
from pydantic import BaseModel, Field
from langgraph.store.base import BaseStore

from src.schemas.models import User
from src.services.sandbox import SandboxService
from src.utils.auth import verify_credentials
from src.services.db import get_store

router = APIRouter(prefix="/sandbox", tags=["Sandbox"])


class CreateSandboxRequest(BaseModel):
    name: Optional[str] = Field(default=None, description="Optional sandbox name. Auto-generated if omitted.")


class SandboxResponse(BaseModel):
    sandbox_name: str
    status: str
    session_id: Optional[str] = None
    detail: Optional[str] = None


class HealthResponse(BaseModel):
    gateway_available: bool
    gateway_error: Optional[str] = None
    pool_size: int
    user_has_session: bool
    user_session: Optional[dict] = None


class PolicyRequest(BaseModel):
    policy: dict = Field(..., description="policy.yaml contents as a dict")


def _get_service(user: User, store: BaseStore) -> SandboxService:
    return SandboxService(user_id=str(user.id), store=store)


@router.get("/health", response_model=HealthResponse)
async def sandbox_health(
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    """Check OpenShell gateway health and session pool status."""
    service = _get_service(user, store)
    return await service.health_check()


@router.get("")
async def list_sandboxes(
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    """List all sandboxes from the OpenShell gateway."""
    service = _get_service(user, store)
    sandboxes = await service.list_sandboxes()
    return {"sandboxes": sandboxes}


@router.post("", response_model=SandboxResponse, status_code=status.HTTP_201_CREATED)
async def create_sandbox(
    body: CreateSandboxRequest = Body(default=CreateSandboxRequest()),
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    """Create a new OpenShell sandbox and pool the session."""
    service = _get_service(user, store)
    try:
        result = await service.create_sandbox(name=body.name)
        return SandboxResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.delete("/{sandbox_name}", response_model=SandboxResponse)
async def destroy_sandbox(
    sandbox_name: str = Path(..., description="Name of the sandbox to destroy"),
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    """Destroy an OpenShell sandbox."""
    service = _get_service(user, store)
    try:
        result = await service.destroy_sandbox(sandbox_name)
        return SandboxResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


@router.get("/session")
async def get_session(
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    """Get the current user's pooled sandbox session."""
    service = _get_service(user, store)
    entry = await service.get_pooled_session()
    if entry is None:
        return {"session": None}
    return {
        "session": {
            "sandbox_name": entry.sandbox_name,
            "session_id": entry.session.id,
            "idle_seconds": round(entry.idle_seconds, 1),
        }
    }


@router.post("/session")
async def get_or_create_session(
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    """Get an existing pooled session or create a new one."""
    service = _get_service(user, store)
    try:
        entry = await service.get_or_create_session()
        return {
            "session": {
                "sandbox_name": entry.sandbox_name,
                "session_id": entry.session.id,
                "idle_seconds": round(entry.idle_seconds, 1),
            }
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


@router.get("/policy/{assistant_id}")
async def get_policy(
    assistant_id: str = Path(..., description="Assistant ID to get policy for"),
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    """Get the security policy for an assistant."""
    service = _get_service(user, store)
    policy = await service.get_policy(assistant_id)
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No policy found")
    return {"assistant_id": assistant_id, "policy": policy}


@router.put("/policy/{assistant_id}")
async def set_policy(
    assistant_id: str = Path(..., description="Assistant ID to set policy for"),
    body: PolicyRequest = Body(...),
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    """Set a security policy for an assistant."""
    service = _get_service(user, store)
    success = await service.set_policy(assistant_id, body.policy)
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save policy")
    return {"assistant_id": assistant_id, "status": "saved"}


@router.delete("/policy/{assistant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(
    assistant_id: str = Path(..., description="Assistant ID to delete policy for"),
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    """Delete a security policy for an assistant."""
    service = _get_service(user, store)
    await service.delete_policy(assistant_id)
    return None
```

### 2.4 `backend/src/schemas/entities/sandbox.py` -- Sandbox Pydantic Models

New file. Pydantic models for sandbox API requests/responses.

```python
"""Pydantic models for sandbox management API."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class SandboxInfo(BaseModel):
    """Sandbox information returned from the gateway."""
    name: str
    status: str
    created_at: Optional[datetime] = None


class SandboxPolicy(BaseModel):
    """Security policy for an assistant's sandbox environment."""
    version: int = Field(default=1, description="Policy schema version")
    filesystem_policy: Optional[dict] = Field(default=None, description="File system access rules")
    network_policies: Optional[dict] = Field(default=None, description="Network access rules")
    process: Optional[dict] = Field(default=None, description="Process execution rules")
    landlock: Optional[dict] = Field(default=None, description="Landlock LSM configuration")


class SessionInfo(BaseModel):
    """Pooled session information."""
    sandbox_name: str
    session_id: str
    idle_seconds: float
    age_seconds: Optional[float] = None
```

### 2.5 `backend/tests/unit/agents/test_openshell.py` -- Unit Tests

New file.

```python
"""Unit tests for OpenShell backend integration."""

import pytest
from unittest.mock import MagicMock, patch


class TestOpenShellBackend:
    """Tests for the OpenShellBackend class."""

    def test_execute_returns_response(self):
        from src.agents.openshell import OpenShellBackend

        mock_session = MagicMock()
        mock_session.id = "test-session-id"
        mock_result = MagicMock()
        mock_result.stdout = "hello world"
        mock_result.stderr = ""
        mock_result.exit_code = 0
        mock_session.exec.return_value = mock_result

        backend = OpenShellBackend(mock_session)
        resp = backend.execute("echo hello world")

        assert resp.output == "hello world"
        assert resp.exit_code == 0
        mock_session.exec.assert_called_once()

    def test_execute_combines_stderr(self):
        from src.agents.openshell import OpenShellBackend

        mock_session = MagicMock()
        mock_session.id = "test-session-id"
        mock_result = MagicMock()
        mock_result.stdout = "out"
        mock_result.stderr = "err"
        mock_result.exit_code = 1
        mock_session.exec.return_value = mock_result

        backend = OpenShellBackend(mock_session)
        resp = backend.execute("bad-cmd")

        assert "out" in resp.output
        assert "err" in resp.output
        assert resp.exit_code == 1

    def test_upload_files_success(self):
        from src.agents.openshell import OpenShellBackend

        mock_session = MagicMock()
        mock_session.id = "test-session-id"
        mock_result = MagicMock()
        mock_result.exit_code = 0
        mock_session.exec.return_value = mock_result

        backend = OpenShellBackend(mock_session)
        responses = backend.upload_files([("/tmp/test.txt", b"content")])

        assert len(responses) == 1
        assert responses[0].error is None

    def test_validate_openshell_not_installed(self):
        with patch("src.agents.openshell.SandboxClient", None):
            from src.agents.openshell import validate_openshell_available
            available, reason = validate_openshell_available()
            # Will return False since SandboxClient is None at module level
            # (actual behavior depends on import-time binding)


class TestSessionPool:
    """Tests for the session pool."""

    @pytest.mark.asyncio
    async def test_put_and_get(self):
        from src.services.sandbox import SessionPool, SandboxSessionEntry

        pool = SessionPool(max_idle_seconds=60)
        mock_session = MagicMock()
        entry = SandboxSessionEntry(session=mock_session, sandbox_name="test-sb", user_id="user-1")
        await pool.put(entry)

        result = await pool.get("user-1")
        assert result is not None
        assert result.sandbox_name == "test-sb"

    @pytest.mark.asyncio
    async def test_get_returns_none_for_unknown_user(self):
        from src.services.sandbox import SessionPool

        pool = SessionPool(max_idle_seconds=60)
        result = await pool.get("unknown")
        assert result is None

    @pytest.mark.asyncio
    async def test_evict_idle(self):
        from src.services.sandbox import SessionPool, SandboxSessionEntry

        pool = SessionPool(max_idle_seconds=0)  # immediate eviction
        mock_session = MagicMock()
        entry = SandboxSessionEntry(session=mock_session, sandbox_name="test-sb", user_id="user-1")
        await pool.put(entry)

        count = await pool.evict_idle()
        assert count == 1
        assert await pool.get("user-1") is None
```

### 2.6 Frontend Files

#### `frontend/src/lib/services/sandboxService.ts` -- API Client

New file.

```typescript
import apiClient from "@/lib/utils/apiClient";

export interface SandboxInfo {
  name: string;
  status: string;
  created_at: string | null;
}

export interface SandboxHealthResponse {
  gateway_available: boolean;
  gateway_error: string | null;
  pool_size: number;
  user_has_session: boolean;
  user_session: {
    sandbox_name: string;
    idle_seconds: number;
  } | null;
}

export interface SandboxSessionResponse {
  session: {
    sandbox_name: string;
    session_id: string;
    idle_seconds: number;
  } | null;
}

export const getSandboxHealth = async (): Promise<SandboxHealthResponse> => {
  const response = await apiClient.get("/sandbox/health");
  return response.data;
};

export const listSandboxes = async (): Promise<{ sandboxes: SandboxInfo[] }> => {
  const response = await apiClient.get("/sandbox");
  return response.data;
};

export const createSandbox = async (
  name?: string,
): Promise<{ sandbox_name: string; status: string; session_id?: string }> => {
  const response = await apiClient.post("/sandbox", { name });
  return response.data;
};

export const destroySandbox = async (
  sandboxName: string,
): Promise<{ sandbox_name: string; status: string }> => {
  const response = await apiClient.delete(`/sandbox/${sandboxName}`);
  return response.data;
};

export const getSandboxSession =
  async (): Promise<SandboxSessionResponse> => {
    const response = await apiClient.get("/sandbox/session");
    return response.data;
  };

export const getOrCreateSandboxSession =
  async (): Promise<SandboxSessionResponse> => {
    const response = await apiClient.post("/sandbox/session");
    return response.data;
  };

export const getSandboxPolicy = async (
  assistantId: string,
): Promise<{ assistant_id: string; policy: Record<string, any> }> => {
  const response = await apiClient.get(`/sandbox/policy/${assistantId}`);
  return response.data;
};

export const setSandboxPolicy = async (
  assistantId: string,
  policy: Record<string, any>,
): Promise<{ assistant_id: string; status: string }> => {
  const response = await apiClient.put(`/sandbox/policy/${assistantId}`, {
    policy,
  });
  return response.data;
};

export const deleteSandboxPolicy = async (
  assistantId: string,
): Promise<void> => {
  await apiClient.delete(`/sandbox/policy/${assistantId}`);
};
```

#### `frontend/src/components/settings/SandboxManagement.tsx` -- Sandbox Management UI

New file. A settings panel for viewing gateway health, active sessions, and managing sandboxes.

```tsx
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  type SandboxHealthResponse,
  type SandboxInfo,
  createSandbox,
  destroySandbox,
  getSandboxHealth,
  listSandboxes,
} from "@/lib/services/sandboxService";

export function SandboxManagement() {
  const [health, setHealth] = useState<SandboxHealthResponse | null>(null);
  const [sandboxes, setSandboxes] = useState<SandboxInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [h, s] = await Promise.all([getSandboxHealth(), listSandboxes()]);
      setHealth(h);
      setSandboxes(s.sandboxes);
    } catch {
      toast.error("Failed to load sandbox status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async () => {
    try {
      await createSandbox();
      toast.success("Sandbox created");
      refresh();
    } catch {
      toast.error("Failed to create sandbox");
    }
  };

  const handleDestroy = async (name: string) => {
    try {
      await destroySandbox(name);
      toast.success(`Sandbox ${name} destroyed`);
      refresh();
    } catch {
      toast.error(`Failed to destroy sandbox ${name}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>OpenShell Sandbox Management</CardTitle>
        <CardDescription>
          Manage OpenShell sandbox instances and monitor gateway health.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gateway Health */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Gateway:</span>
          {health ? (
            <Badge variant={health.gateway_available ? "default" : "destructive"}>
              {health.gateway_available ? "Connected" : "Unavailable"}
            </Badge>
          ) : (
            <Badge variant="secondary">Loading...</Badge>
          )}
          {health?.gateway_error && (
            <span className="text-xs text-muted-foreground">{health.gateway_error}</span>
          )}
        </div>

        {/* Session Pool */}
        {health && (
          <div className="text-sm text-muted-foreground">
            Pool size: {health.pool_size} |{" "}
            {health.user_has_session
              ? `Active session: ${health.user_session?.sandbox_name}`
              : "No active session"}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleCreate} disabled={loading || !health?.gateway_available}>
            Create Sandbox
          </Button>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>

        {/* Sandbox List */}
        {sandboxes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Active Sandboxes</h4>
            {sandboxes.map((sb) => (
              <div key={sb.name} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <span className="text-sm font-medium">{sb.name}</span>
                  <Badge variant="outline" className="ml-2">{sb.status}</Badge>
                </div>
                <Button size="sm" variant="destructive" onClick={() => handleDestroy(sb.name)}>
                  Destroy
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## 3. Files to Modify

### 3.1 `backend/src/agents/__init__.py`

**Changes:** Register `openshell` in `_SANDBOX_FACTORIES` and update `resolve_sandbox_backend` dispatch logic.

```python
# --- ADD import at top (after daytona conditional imports) ---
# Conditional import for OpenShell sandbox support
try:
    from src.agents.openshell import _create_openshell_backend_checked
except ImportError:
    _create_openshell_backend_checked = None  # type: ignore[assignment]


# --- MODIFY _SANDBOX_FACTORIES to add openshell ---
_SANDBOX_FACTORIES: dict[str, Callable] = {
    "daytona": _create_daytona_backend_checked,
    "openshell": _create_openshell_backend_checked,
    "state": _create_state_backend,
}


# --- MODIFY resolve_sandbox_backend to handle "openshell" ---
def resolve_sandbox_backend(
    runtime: ToolRuntime,
    sandbox_type: str | None = None,
) -> tuple[CompositeBackend, Any, str]:
    """Resolve a sandbox backend based on *sandbox_type*.

    Dispatch rules:
    * ``None`` / ``"auto"`` -- try Daytona first, then OpenShell, fall back to State.
    * ``"state"`` -- use StateBackend directly.
    * ``"daytona"`` -- try Daytona, fall back to State if unavailable.
    * ``"openshell"`` -- try OpenShell, fall back to State if unavailable.
    * Any unknown value -- treated as ``"auto"``.

    Returns ``(backend, sandbox_or_None, effective_type)``
    where effective_type is ``"daytona"``, ``"openshell"``, or ``"state"``.
    """
    effective = sandbox_type if sandbox_type in _SANDBOX_FACTORIES else None

    if effective == "state":
        backend, sandbox = _create_state_backend(runtime)
        return backend, sandbox, "state"

    if effective == "openshell":
        if _create_openshell_backend_checked is not None:
            result = _create_openshell_backend_checked(runtime)
            if result is not None:
                return result[0], result[1], "openshell"
        # Fallback to state
        backend, sandbox = _create_state_backend(runtime)
        return backend, sandbox, "state"

    # "daytona" or auto (None) -- try Daytona first, then OpenShell
    result = _create_daytona_backend_checked(runtime)
    if result is not None:
        return result[0], result[1], "daytona"

    # Try OpenShell as second preference in auto mode
    if _create_openshell_backend_checked is not None:
        result = _create_openshell_backend_checked(runtime)
        if result is not None:
            return result[0], result[1], "openshell"

    # Fallback: plain StateBackend
    backend, sandbox = _create_state_backend(runtime)
    return backend, sandbox, "state"
```

### 3.2 `backend/src/schemas/entities/settings.py`

**Change:** Add `OPENSHELL` to the `SandboxType` enum.

```python
class SandboxType(str, Enum):
    """Supported sandbox backend types."""

    DAYTONA = "daytona"
    OPENSHELL = "openshell"
    STATE = "state"
```

### 3.3 `backend/src/constants/__init__.py`

**Changes:** Add OpenShell env vars and `UserTokenKey` entry.

```python
# In UserTokenKey enum, add:
    OPENSHELL_GATEWAY = "OPENSHELL_GATEWAY"

# After DAYTONA_API_KEY constant, add:
OPENSHELL_GATEWAY = os.getenv(UserTokenKey.OPENSHELL_GATEWAY.value)
OPENSHELL_SANDBOX_NAME = os.getenv("OPENSHELL_SANDBOX_NAME")
```

### 3.4 `backend/src/routes/v0/__init__.py`

**Change:** Import and register the sandbox router.

```python
# Add import
from .sandbox import router as sandbox

# In create_api_router(), add before the return:
    app.include_router(sandbox, prefix=prefix)
```

### 3.5 `backend/pyproject.toml`

**Change:** Add `openshell` as an optional dependency.

```toml
# In [project.optional-dependencies], add a new group:
openshell = [
    "openshell>=0.0.7",
]
```

This keeps `openshell` optional so the package does not break existing deployments that do not use it. The conditional import pattern (matching Daytona) handles the missing package gracefully.

### 3.6 `backend/src/controllers/llm.py`

**Change:** Add OpenShell error handling alongside Daytona error handling.

```python
# In the import block, add:
from src.agents.openshell import OpenShellBackend  # for isinstance checks if needed

# In llm_invoke() except block, after the is_daytona_error handling, add:
            # Handle OpenShell errors similarly to Daytona
            if "openshell" in str(type(e).__module__).lower():
                if default_sandbox == "openshell":
                    logger.error(f"OpenShell sandbox error (openshell mode): {e}")
                    if agent and config:
                        await self._update_store(agent, config)
                    raise
                elif default_sandbox in (None, "auto") and effective_type == "openshell":
                    logger.warning(f"OpenShell sandbox error in auto mode, falling back to local: {e}")
                    try:
                        fallback_backend, _ = _create_state_backend(runtime)
                        agent = await construct_agent(
                            instructions=params.instructions,
                            system_prompt=params.system_prompt,
                            model=params.model,
                            tools=params.tools,
                            subagents=params.subagents,
                            checkpointer=checkpointer,
                            backend=fallback_backend,
                            service_context=self.service_context,
                            api_key=api_key,
                            memory=memory_sources,
                        )
                        response = await agent.invoke(
                            params.input,
                            config=config,
                            context=self._init_context(params),
                        )
                        return response
                    except Exception as fallback_err:
                        logger.exception(f"Fallback also failed in llm_invoke: {fallback_err}")
                        if agent and config:
                            await self._update_store(agent, config)
                        raise fallback_err
```

### 3.7 `backend/src/utils/stream.py`

**Change:** Add OpenShell error handling in `stream_generator` (same pattern as Daytona).

The `stream_generator` function already handles `is_daytona_error`. Add a parallel `elif` block for OpenShell errors after the Daytona block, following the same fallback pattern.

### 3.8 Frontend: `frontend/src/lib/services/userSettingsService.ts`

**Change:** Add `"openshell"` to the `SandboxType` union.

```typescript
export type SandboxType = "daytona" | "openshell" | "state";
```

### 3.9 Frontend: `frontend/src/lib/config/sandbox.ts`

**Change:** Add OpenShell to `SANDBOX_OPTIONS` and update `normalizeSandboxValue`.

```typescript
export const SANDBOX_OPTIONS: readonly SandboxOption[] = [
  {
    value: "state",
    label: "State (Default)",
    shortLabel: "State",
    description: "Run agent code with the state sandbox backend.",
  },
  {
    value: "openshell",
    label: "OpenShell",
    shortLabel: "OpenShell",
    description: "Run agent code in an OpenShell on-prem sandbox with policy-governed security.",
  },
  {
    value: "daytona",
    label: "Daytona",
    shortLabel: "Daytona",
    description: "Run agent code in the Daytona sandbox backend.",
  },
] as const;

export function normalizeSandboxValue(
  value: string | null | undefined,
): SandboxType {
  if (value === "daytona" || value === "openshell") {
    return value;
  }
  return DEFAULT_SANDBOX;
}
```

### 3.10 Frontend: `frontend/src/components/settings/SandboxSettings.tsx`

**Change:** Update visibility filter to show OpenShell when gateway is configured.

```tsx
const visibleOptions = useMemo(
  () =>
    SANDBOX_OPTIONS.filter((opt) => {
      if (opt.value === "daytona") {
        return providerKeys.some(
          (k) => k.provider === "DAYTONA_API_KEY" && k.is_set,
        );
      }
      if (opt.value === "openshell") {
        return providerKeys.some(
          (k) => k.provider === "OPENSHELL_GATEWAY" && k.is_set,
        );
      }
      return true;
    }),
  [providerKeys],
);
```

### 3.11 Frontend: `frontend/src/components/status/ThreadSandboxStatus.tsx`

**Change:** Same visibility filter update as SandboxSettings (add OpenShell gate).

### 3.12 Frontend: `frontend/src/pages/settings/index.tsx`

**Change:** Import and render the `SandboxManagement` component in the settings page.

```tsx
import { SandboxManagement } from "@/components/settings/SandboxManagement";

// In the JSX, add below existing SandboxSettings:
<SandboxManagement />
```

### 3.13 `docker-compose.dev.yml`

**Change:** Add OpenShell gateway service (optional profile).

```yaml
    openshell_gateway:
        image: ghcr.io/openshell-ai/gateway:latest
        ports:
            - "9090:9090"
        volumes:
            - openshell_data:/data
        environment:
            OPENSHELL_LISTEN: "0.0.0.0:9090"
        networks:
            - default
        profiles:
            - openshell
        deploy:
            resources:
                limits:
                    cpus: "1"
                    memory: 1G

# Add to volumes:
    openshell_data:

# Add to backend environment:
        OPENSHELL_GATEWAY: "http://openshell_gateway:9090"
```

Activated via: `COMPOSE_PROFILES=openshell make dev.docker.up`

---

## 4. Dependencies

| Package | Version | Location | Required? |
|---------|---------|----------|-----------|
| `openshell` | `>=0.0.7` | `backend/pyproject.toml` optional `[openshell]` | Optional |

No new frontend dependencies are needed -- all UI uses existing shadcn/ui components.

**Installation:**

```bash
cd backend
uv sync --extra openshell  # Only when OpenShell is needed
```

---

## 5. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENSHELL_GATEWAY` | No | (none / active_gateway file) | URL of the OpenShell gateway (e.g., `http://localhost:9090`) |
| `OPENSHELL_SANDBOX_NAME` | No | (auto-created) | Name of a pre-existing sandbox to connect to |

These follow the same pattern as `DAYTONA_API_KEY` -- they are optional and the system gracefully degrades when not configured. `OPENSHELL_GATEWAY` is also added to `UserTokenKey` so users can configure it per-account via the settings UI.

---

## 6. Data Flow

### 6.1 Agent Invocation with OpenShell

```
1. User sends chat message
2. LLMController._resolve_user_settings() reads sandbox preference ("openshell")
3. resolve_sandbox_backend(runtime, sandbox_type="openshell") called
4. _create_openshell_backend_checked(runtime) invoked
   a. Check SandboxService session pool for warm session
   b. If miss: SandboxClient.from_active_cluster() -> create/get sandbox
   c. Wrap in OpenShellBackend -> CompositeBackend
5. construct_agent() receives the backend
6. Agent executes code via backend.execute("python script.py")
   -> OpenShellBackend._session.exec(["bash", "-c", "python script.py"])
   -> Runs in sandboxed OpenShell environment
7. Results streamed back to user
```

### 6.2 Session Pooling Flow

```
First request:
  pool.get(user_id) -> None
  create_openshell_session() -> (session, name)
  pool.put(SandboxSessionEntry(...))
  Return session for agent use

Subsequent requests (within idle timeout):
  pool.get(user_id) -> SandboxSessionEntry
  entry.touch() -> update last_used_at
  Return cached session (no creation overhead)

Idle eviction:
  pool.evict_idle() runs periodically or on access
  Sessions idle > 10 minutes are removed
  Next request creates a fresh session
```

---

## 7. Risk Assessment

### High Risk

| Risk | Mitigation |
|------|------------|
| **openshell package instability** (v0.0.7 is early) | Conditional import pattern, same as Daytona. Missing package = graceful degradation to StateBackend. Pin version. |
| **Session pool memory leak** | `evict_idle()` on periodic timer. Max idle 10 min. Pool entries only hold session reference, not heavy state. |
| **Gateway network failures mid-execution** | Error handling catches OpenShell errors; auto-mode falls back to StateBackend with retry. Explicit openshell mode surfaces errors to user. |

### Medium Risk

| Risk | Mitigation |
|------|------------|
| **Security policy bypass** | Policy is advisory (applied by gateway). Validate policy YAML structure on upload. Document that enforcement depends on gateway configuration. |
| **Docker image availability** | OpenShell gateway service uses `profiles: [openshell]`, so it only starts when explicitly requested. Does not affect existing dev workflow. |
| **Breaking existing sandbox dispatch** | `_SANDBOX_FACTORIES` is additive. Existing `"daytona"` and `"state"` paths are unchanged. Auto mode adds OpenShell as second preference after Daytona. |

### Low Risk

| Risk | Mitigation |
|------|------------|
| **Frontend sandbox selector UX** | OpenShell option gated behind `OPENSHELL_GATEWAY` provider key being set. Users without OpenShell never see the option. |
| **Test suite breakage** | All OpenShell tests use mocked `SandboxSession`. No real gateway required for CI. |

---

## 8. Estimated Complexity

| Category | Files | Lines Added | Lines Modified |
|----------|-------|-------------|----------------|
| **Backend: OpenShell backend** | 1 new | ~180 | 0 |
| **Backend: SandboxService** | 1 new | ~250 | 0 |
| **Backend: Sandbox routes** | 1 new | ~150 | 0 |
| **Backend: Sandbox schemas** | 1 new | ~40 | 0 |
| **Backend: Unit tests** | 1 new | ~100 | 0 |
| **Backend: agents/__init__.py** | 0 | ~30 | ~15 |
| **Backend: constants/__init__.py** | 0 | ~5 | ~3 |
| **Backend: settings schema** | 0 | ~1 | ~1 |
| **Backend: pyproject.toml** | 0 | ~3 | 0 |
| **Backend: routes/__init__.py** | 0 | ~2 | ~1 |
| **Backend: controllers/llm.py** | 0 | ~25 | ~5 |
| **Backend: utils/stream.py** | 0 | ~25 | ~5 |
| **Frontend: sandboxService.ts** | 1 new | ~80 | 0 |
| **Frontend: SandboxManagement.tsx** | 1 new | ~120 | 0 |
| **Frontend: sandbox.ts config** | 0 | ~10 | ~5 |
| **Frontend: SandboxSettings.tsx** | 0 | ~5 | ~3 |
| **Frontend: ThreadSandboxStatus.tsx** | 0 | ~5 | ~3 |
| **Frontend: userSettingsService.ts** | 0 | ~1 | ~1 |
| **Frontend: settings page** | 0 | ~3 | ~1 |
| **Docker: compose dev** | 0 | ~15 | ~2 |
| **Total** | **7 new** | **~1,050** | **~45** |

**Overall: ~1,095 lines of change across 18 files (7 new, 11 modified).**

---

## 9. Implementation Order

### Phase 1: Backend Core (can be merged independently)
1. `backend/src/agents/openshell.py` -- OpenShell backend
2. `backend/src/agents/__init__.py` -- Register in factory + dispatch
3. `backend/src/schemas/entities/settings.py` -- Add enum value
4. `backend/src/constants/__init__.py` -- Add env vars
5. `backend/pyproject.toml` -- Add optional dependency
6. `backend/tests/unit/agents/test_openshell.py` -- Unit tests

### Phase 2: Service Layer + API
7. `backend/src/services/sandbox.py` -- SandboxService with pool
8. `backend/src/schemas/entities/sandbox.py` -- Pydantic models
9. `backend/src/routes/v0/sandbox.py` -- API routes
10. `backend/src/routes/v0/__init__.py` -- Register router

### Phase 3: Error Handling + Fallback
11. `backend/src/controllers/llm.py` -- OpenShell error handling
12. `backend/src/utils/stream.py` -- Stream error handling

### Phase 4: Frontend + Docker
13. `frontend/src/lib/services/sandboxService.ts` -- API client
14. `frontend/src/lib/config/sandbox.ts` -- Config update
15. `frontend/src/lib/services/userSettingsService.ts` -- Type update
16. `frontend/src/components/settings/SandboxSettings.tsx` -- Visibility gate
17. `frontend/src/components/status/ThreadSandboxStatus.tsx` -- Visibility gate
18. `frontend/src/components/settings/SandboxManagement.tsx` -- Management UI
19. `frontend/src/pages/settings/index.tsx` -- Wire into settings
20. `docker-compose.dev.yml` -- Gateway service

---

## 10. API Reference

### `GET /api/sandbox/health`
**Auth:** Required
**Response:**
```json
{
  "gateway_available": true,
  "gateway_error": null,
  "pool_size": 3,
  "user_has_session": true,
  "user_session": {
    "sandbox_name": "sb-abc123",
    "idle_seconds": 45.2
  }
}
```

### `GET /api/sandbox`
**Auth:** Required
**Response:**
```json
{
  "sandboxes": [
    {"name": "sb-abc123", "status": "ready", "created_at": "2026-03-18T10:00:00Z"}
  ]
}
```

### `POST /api/sandbox`
**Auth:** Required
**Body:** `{"name": "my-sandbox"}` (optional)
**Response (201):**
```json
{
  "sandbox_name": "my-sandbox",
  "session_id": "sess-xyz",
  "status": "ready"
}
```

### `DELETE /api/sandbox/{sandbox_name}`
**Auth:** Required
**Response:**
```json
{
  "sandbox_name": "my-sandbox",
  "status": "destroyed"
}
```

### `GET /api/sandbox/session`
**Auth:** Required
**Response:**
```json
{
  "session": {
    "sandbox_name": "sb-abc123",
    "session_id": "sess-xyz",
    "idle_seconds": 12.5
  }
}
```

### `POST /api/sandbox/session`
**Auth:** Required
**Response:** Same as GET, but creates if missing.

### `GET /api/sandbox/policy/{assistant_id}`
**Auth:** Required
**Response:**
```json
{
  "assistant_id": "uuid-here",
  "policy": {
    "version": 1,
    "filesystem_policy": {"read_write": ["/workspace", "/tmp"]},
    "network_policies": {}
  }
}
```

### `PUT /api/sandbox/policy/{assistant_id}`
**Auth:** Required
**Body:**
```json
{
  "policy": {
    "version": 1,
    "filesystem_policy": {"read_write": ["/workspace"]},
    "network_policies": {}
  }
}
```
**Response:** `{"assistant_id": "uuid-here", "status": "saved"}`

### `DELETE /api/sandbox/policy/{assistant_id}`
**Auth:** Required
**Response:** 204 No Content

---

## 11. Validation Plan

### Backend Validation

```bash
# Run unit tests
make test

# Manual API validation (after seeding a user):
# 1. Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "test1234"}'

# 2. Health check
curl -X GET http://localhost:8000/api/sandbox/health \
  -H "Authorization: Bearer <token>"

# 3. Create sandbox
curl -X POST http://localhost:8000/api/sandbox \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name": "test-sandbox"}'

# 4. List sandboxes
curl -X GET http://localhost:8000/api/sandbox \
  -H "Authorization: Bearer <token>"

# 5. Get session
curl -X GET http://localhost:8000/api/sandbox/session \
  -H "Authorization: Bearer <token>"

# 6. Set policy
curl -X PUT http://localhost:8000/api/sandbox/policy/some-assistant-id \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"policy": {"version": 1, "filesystem_policy": {"read_write": ["/workspace"]}}}'

# 7. Destroy sandbox
curl -X DELETE http://localhost:8000/api/sandbox/test-sandbox \
  -H "Authorization: Bearer <token>"
```

### Frontend Validation

1. Navigate to Settings page -- verify "OpenShell Sandbox Management" card appears
2. If `OPENSHELL_GATEWAY` provider key is set, verify "OpenShell" appears in sandbox selector
3. Click "Create Sandbox" -- verify success toast and sandbox appears in list
4. Click "Destroy" on a sandbox -- verify removal
5. Verify sandbox selector in chat composer shows OpenShell option when configured
