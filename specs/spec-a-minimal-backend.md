# Spec A: OpenShell DeepAgent -- Minimal Backend Provider

## Approach Summary

Add OpenShell as a third sandbox backend option alongside Daytona and State, following the exact existing provider patterns. The integration is "minimal" in the sense that it mirrors the structure of the Daytona integration: a conditional import guard, a factory function, registration in `_SANDBOX_FACTORIES`, extension of the auto-fallback chain, and exposure through the existing user settings and frontend sandbox selector. No new APIs, no new database columns, no new routes -- just a new backend choice threaded through existing wiring.

**Fallback chain (auto mode):** Daytona -> OpenShell -> State

---

## Files to Modify

### 1. `backend/pyproject.toml`

**Change:** Add `openshell` to project dependencies.

```toml
# In [project] dependencies list, add after the "daytona" line:
    "openshell>=0.0.10",
```

**Rationale:** The reference implementation uses `openshell>=0.0.7`; pinning to `>=0.0.10` matches the latest wheel available in the reference project. The package is published by NVIDIA and requires Python 3.12+, which Orchestra already targets.

**Note:** The `openshell` wheel may not yet be on PyPI. If not, add it as a local wheel dependency:
```toml
    "openshell @ file:///path/to/wheels/openshell-0.0.10-py3-none-manylinux_2_35_x86_64.whl",
```
Or configure an extra index URL. Determine availability before implementation.

---

### 2. `backend/src/constants/__init__.py`

**Change:** Add `OPENSHELL_GATEWAY` and `OPENSHELL_SANDBOX_NAME` env var constants, and add `OPENSHELL_API_KEY` to the `UserTokenKey` enum (used for provider key management / visibility gating in the frontend).

```python
# Add to UserTokenKey enum (after DAYTONA_API_KEY):
    OPENSHELL_API_KEY = "OPENSHELL_API_KEY"

# Add after DAYTONA_API_KEY constant:
OPENSHELL_API_KEY = os.getenv(UserTokenKey.OPENSHELL_API_KEY.value)
OPENSHELL_GATEWAY = os.getenv("OPENSHELL_GATEWAY")
OPENSHELL_SANDBOX_NAME = os.getenv("OPENSHELL_SANDBOX_NAME")
```

**Design decision -- `OPENSHELL_API_KEY`:** OpenShell itself authenticates via mTLS certificates stored in `~/.config/openshell/gateways/<cluster>/mtls/`, not via an API key. However, Orchestra's frontend visibility-gating pattern uses `UserTokenKey` entries (e.g., `DAYTONA_API_KEY`) to decide whether to show a sandbox option. Adding `OPENSHELL_API_KEY` as a sentinel lets users "enable" the OpenShell option by setting any truthy value (e.g., `OPENSHELL_API_KEY=enabled`) through Settings > Provider Keys. This reuses the existing pattern without requiring new gating infrastructure.

---

### 3. `backend/src/agents/__init__.py`

**Changes:**
1. Add conditional import guard for `openshell` (mirrors Daytona pattern).
2. Add `create_openshell_backend()` factory function.
3. Add `_create_openshell_backend_checked()` inner factory (mirrors `_create_daytona_backend_checked()`).
4. Register `"openshell"` in `_SANDBOX_FACTORIES`.
5. Update `resolve_sandbox_backend()` auto-fallback chain: Daytona -> OpenShell -> State.

#### 3a. Conditional import (after Daytona conditional import block, line ~31)

```python
# Conditional import for OpenShell sandbox support
try:
    from openshell import SandboxClient, SandboxSession, SandboxError
    _OPENSHELL_AVAILABLE = True
except ImportError:
    SandboxClient = None  # type: ignore[assignment,misc]
    SandboxSession = None  # type: ignore[assignment,misc]
    SandboxError = None  # type: ignore[assignment,misc]
    _OPENSHELL_AVAILABLE = False
```

#### 3b. Import constants (update existing import line ~33)

```python
from src.constants import APP_ENV, DAYTONA_API_KEY, OPENSHELL_GATEWAY, OPENSHELL_SANDBOX_NAME
```

#### 3c. OpenShell error checker (after `is_daytona_error()`)

```python
def is_openshell_error(exc: Exception) -> bool:
    """Check if an exception is a SandboxError from openshell."""
    if SandboxError is None:
        return False
    return isinstance(exc, SandboxError)
```

#### 3d. `create_openshell_backend()` factory (after `create_daytona_backend()`)

```python
def create_openshell_backend():
    """Create an OpenShell sandbox and return (session, backend).

    Returns ``(None, None)`` when the package is not installed, the gateway
    is not configured, or sandbox creation fails for any reason.

    Sandbox selection:
    - If OPENSHELL_SANDBOX_NAME is set: connect to that pre-existing named sandbox.
    - Otherwise: create a fresh sandbox and wait for it to be ready.

    The active gateway is resolved from:
    1. OPENSHELL_GATEWAY env var
    2. ~/.config/openshell/active_gateway (set by: openshell gateway select <name>)
    """
    if not _OPENSHELL_AVAILABLE:
        return None, None

    try:
        from src.agents.openshell import OpenShellBackend

        client = SandboxClient.from_active_cluster(
            cluster=OPENSHELL_GATEWAY or None,
        )

        sandbox_name = OPENSHELL_SANDBOX_NAME
        if sandbox_name:
            ref = client.get(sandbox_name)
        else:
            ref = client.create()
            ref = client.wait_ready(ref.name)

        session = SandboxSession(client, ref)
        backend = OpenShellBackend(session)
        return session, backend
    except Exception as exc:
        logger.error(f"Failed to create OpenShell sandbox: {exc}")
        return None, None
```

#### 3e. `_create_openshell_backend_checked()` (after `_create_daytona_backend_checked()`)

```python
def _create_openshell_backend_checked(
    runtime: ToolRuntime,
) -> tuple[CompositeBackend, Any] | None:
    """Try to create an OpenShell-backed CompositeBackend.

    Returns ``(backend, session)`` on success, or ``None`` if OpenShell is
    unavailable or not capable.
    """
    session, openshell_backend = create_openshell_backend()
    if openshell_backend is not None:
        # Validate execute capability (same pattern as Daytona)
        if callable(getattr(openshell_backend, "execute", None)):
            backend = CompositeBackend(default=openshell_backend, routes={})
            return backend, session

        # Not capable -- clean up
        if session is not None:
            try:
                session.delete()
            except Exception:
                pass

    return None
```

#### 3f. Update `_SANDBOX_FACTORIES` (line ~313)

```python
_SANDBOX_FACTORIES: dict[str, Callable] = {
    "daytona": _create_daytona_backend_checked,
    "openshell": _create_openshell_backend_checked,
    "state": _create_state_backend,
}
```

#### 3g. Update `resolve_sandbox_backend()` (replace entire function)

```python
def resolve_sandbox_backend(
    runtime: ToolRuntime,
    sandbox_type: str | None = None,
) -> tuple[CompositeBackend, Any, str]:
    """Resolve a sandbox backend based on *sandbox_type*.

    Dispatch rules:
    * ``None`` / ``"auto"`` -- try Daytona first, then OpenShell, fall back to State.
    * ``"state"`` -- use StateBackend directly (never attempts remote sandboxes).
    * ``"daytona"`` -- try Daytona, fall back to State if unavailable.
    * ``"openshell"`` -- try OpenShell, fall back to State if unavailable.
    * Any unknown value -- treated as ``"auto"``.

    Returns ``(backend, sandbox_or_session_or_None, effective_type)``
    where effective_type is ``"daytona"``, ``"openshell"``, or ``"state"``.
    """
    effective = sandbox_type if sandbox_type in _SANDBOX_FACTORIES else None

    if effective == "state":
        backend, sandbox = _create_state_backend(runtime)
        return backend, sandbox, "state"

    if effective == "openshell":
        result = _create_openshell_backend_checked(runtime)
        if result is not None:
            return result[0], result[1], "openshell"
        # Fallback to State
        backend, sandbox = _create_state_backend(runtime)
        return backend, sandbox, "state"

    # "daytona" or auto (None) -- try Daytona first
    result = _create_daytona_backend_checked(runtime)
    if result is not None:
        return result[0], result[1], "daytona"

    # Auto mode: try OpenShell as second preference
    if effective is None:  # auto mode
        result = _create_openshell_backend_checked(runtime)
        if result is not None:
            return result[0], result[1], "openshell"

    # Fallback: plain StateBackend (silent, no messages)
    backend, sandbox = _create_state_backend(runtime)
    return backend, sandbox, "state"
```

---

### 4. `backend/src/agents/openshell.py` (NEW FILE)

**Purpose:** Contains the `OpenShellBackend` class, mirroring how `backend/src/agents/daytona.py` holds Daytona-specific helpers. Ported directly from the reference implementation with minor adjustments for Orchestra's import style.

```python
"""OpenShell sandbox backend for deepagents.

Implements the BaseSandbox protocol backed by an OpenShell sandbox session.
All file operations (read, write, edit, grep, glob, ls) are inherited from
BaseSandbox and executed as shell commands via execute().
"""

from __future__ import annotations

import base64
import os
import shlex
from typing import Any

from deepagents.backends.protocol import (
    ExecuteResponse,
    FileDownloadResponse,
    FileUploadResponse,
)
from deepagents.backends.sandbox import BaseSandbox


class OpenShellBackend(BaseSandbox):
    """deepagents SandboxBackendProtocol backed by an OpenShell sandbox.

    Wraps a live SandboxSession. Only execute(), upload_files(), and
    download_files() need concrete implementations.
    """

    def __init__(
        self,
        session: Any,  # openshell.SandboxSession
        *,
        default_timeout: int = 30 * 60,
    ) -> None:
        self._session = session
        self._default_timeout = default_timeout

    @property
    def id(self) -> str:
        return self._session.id

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
```

---

### 5. `backend/src/schemas/entities/settings.py`

**Change:** Add `OPENSHELL` to the `SandboxType` enum.

```python
class SandboxType(str, Enum):
    """Supported sandbox backend types."""

    DAYTONA = "daytona"
    OPENSHELL = "openshell"
    STATE = "state"
```

This single change cascades through the validation in `UserSettingsRepo.set_default_sandbox()` and `UserSettingsRepo.patch_defaults()`, which both validate against `[e.value for e in SandboxType]`.

---

### 6. `backend/src/controllers/llm.py`

**Change:** Add OpenShell error handling in the `llm_invoke` exception handler, mirroring the existing Daytona error handling pattern.

Add import at top:
```python
from src.agents import (
    construct_agent,
    init_config,
    is_daytona_error,
    is_openshell_error,
    prepare_memory_files,
    resolve_sandbox_backend,
    _create_state_backend,
)
```

In the `except Exception as e:` block of `llm_invoke()`, add an OpenShell error branch after the Daytona error block:

```python
            if is_openshell_error(e):
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

---

### 7. `backend/src/utils/stream.py`

**Change:** Add OpenShell error handling in `stream_generator()`, mirroring the Daytona error pattern.

Add `is_openshell_error` to imports:
```python
from src.agents import (
    construct_agent,
    resolve_sandbox_backend,
    prepare_memory_files,
    is_daytona_error,
    is_openshell_error,
    _create_state_backend,
)
```

In the `except Exception as e:` block of `stream_generator()`, add an OpenShell branch after the Daytona handling (identical pattern, different error check and log messages):

```python
            elif is_openshell_error(e):
                if sandbox_type == "openshell":
                    logger.error(f"OpenShell sandbox error (openshell mode): {e}")
                    error_msg = ujson.dumps(("error", f"OpenShell sandbox error: {e}"))
                    yield f"data: {error_msg}\n\n"
                elif sandbox_type in (None, "auto") and effective_type == "openshell":
                    logger.warning(f"OpenShell sandbox error in auto mode, falling back to local: {e}")
                    try:
                        fallback_backend, _ = _create_state_backend(runtime)
                        agent = await construct_agent(
                            instructions=instructions,
                            system_prompt=system_prompt,
                            model=model,
                            tools=tools,
                            subagents=subagents,
                            checkpointer=checkpointer,
                            backend=fallback_backend,
                            service_context=service_context,
                            api_key=api_key,
                            memory=memory_sources,
                        )
                        async for chunk in agent.astream(input, **astream_kwargs):
                            sse_line = _process_and_format_chunk(chunk, agent.model, state)
                            if sse_line:
                                yield sse_line
                    except Exception as fallback_err:
                        logger.exception("Fallback also failed in stream_generator: %s", fallback_err)
                        error_msg = ujson.dumps(("error", str(fallback_err)))
                        yield f"data: {error_msg}\n\n"
                else:
                    logger.exception("Error in stream_generator: %s", e)
                    error_msg = ujson.dumps(("error", str(e)))
                    yield f"data: {error_msg}\n\n"
```

---

### 8. `backend/src/workers/tasks.py`

**Change:** Add OpenShell error handling in `_execute_agent_stream()`, mirroring the Daytona error pattern.

Add `is_openshell_error` to imports:
```python
    from src.agents import (
        construct_agent,
        resolve_sandbox_backend,
        prepare_memory_files,
        is_daytona_error,
        is_openshell_error,
        _create_state_backend,
    )
```

In the `except Exception as e:` block within `_execute_agent_stream()`, add an OpenShell branch after the Daytona block (same pattern: surface error if explicit mode, fallback if auto mode).

---

### 9. `frontend/src/lib/services/userSettingsService.ts`

**Change:** Add `"openshell"` to the `SandboxType` union.

```typescript
export type SandboxType = "daytona" | "openshell" | "state";
```

---

### 10. `frontend/src/lib/config/sandbox.ts`

**Change:** Add OpenShell option to `SANDBOX_OPTIONS` and update `normalizeSandboxValue()`.

```typescript
export const SANDBOX_OPTIONS: readonly SandboxOption[] = [
    {
        value: "state",
        label: "State (Default)",
        shortLabel: "State",
        description: "Run agent code with the state sandbox backend.",
    },
    {
        value: "daytona",
        label: "Daytona",
        shortLabel: "Daytona",
        description: "Run agent code in the Daytona sandbox backend.",
    },
    {
        value: "openshell",
        label: "OpenShell",
        shortLabel: "OpenShell",
        description: "Run agent code in an NVIDIA OpenShell sandbox.",
    },
] as const;

export function normalizeSandboxValue(
    value: string | null | undefined,
): SandboxType {
    if (value === "daytona" || value === "openshell") {
        return value;
    }

    // "auto", null, undefined, and any unknown value all resolve to "state"
    return DEFAULT_SANDBOX;
}
```

---

### 11. `frontend/src/components/settings/SandboxSettings.tsx`

**Change:** Update the `visibleOptions` filter to also check for `OPENSHELL_API_KEY`.

```typescript
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
                    (k) => k.provider === "OPENSHELL_API_KEY" && k.is_set,
                );
            }
            return true;
        }),
    [providerKeys],
);
```

---

### 12. `frontend/src/components/status/ThreadSandboxStatus.tsx`

**Change:** Same `visibleOptions` filter update as SandboxSettings above.

```typescript
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
                    (k) => k.provider === "OPENSHELL_API_KEY" && k.is_set,
                );
            }
            return true;
        }),
    [providerKeys],
);
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENSHELL_API_KEY` | No | `None` | Sentinel value to enable OpenShell in the UI. Set to any truthy value (e.g., `enabled`). The actual auth is mTLS-based via `~/.config/openshell/`. |
| `OPENSHELL_GATEWAY` | No | `None` | Override the active OpenShell gateway cluster name. Falls back to `~/.config/openshell/active_gateway`. |
| `OPENSHELL_SANDBOX_NAME` | No | `None` | Connect to a pre-existing named sandbox instead of creating a fresh one each run. |

---

## Dependencies

| Package | Version | Source | Notes |
|---------|---------|--------|-------|
| `openshell` | `>=0.0.10` | PyPI or local wheel | NVIDIA OpenShell SDK. Requires Python 3.12+, `grpcio>=1.60`, `protobuf>=4.25`. Linux/macOS only. |

**Transitive dependencies added:** `cloudpickle>=3.0`, `grpcio>=1.60`, `protobuf>=4.25` (likely already present via other LangChain deps).

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `backend/pyproject.toml` | Modify | Add `openshell>=0.0.10` dependency |
| `backend/src/constants/__init__.py` | Modify | Add `OPENSHELL_API_KEY`, `OPENSHELL_GATEWAY`, `OPENSHELL_SANDBOX_NAME` constants and `UserTokenKey` entry |
| `backend/src/agents/__init__.py` | Modify | Conditional import, factory functions, updated fallback chain |
| `backend/src/agents/openshell.py` | **Create** | `OpenShellBackend(BaseSandbox)` class |
| `backend/src/schemas/entities/settings.py` | Modify | Add `OPENSHELL` to `SandboxType` enum |
| `backend/src/controllers/llm.py` | Modify | OpenShell error handling in `llm_invoke()` |
| `backend/src/utils/stream.py` | Modify | OpenShell error handling in `stream_generator()` |
| `backend/src/workers/tasks.py` | Modify | OpenShell error handling in `_execute_agent_stream()` |
| `frontend/src/lib/services/userSettingsService.ts` | Modify | Add `"openshell"` to `SandboxType` union |
| `frontend/src/lib/config/sandbox.ts` | Modify | Add OpenShell option, update normalizer |
| `frontend/src/components/settings/SandboxSettings.tsx` | Modify | Filter for `OPENSHELL_API_KEY` visibility |
| `frontend/src/components/status/ThreadSandboxStatus.tsx` | Modify | Filter for `OPENSHELL_API_KEY` visibility |

---

## Risk Assessment

### Low Risk
- **Schema change** (`SandboxType` enum): Additive-only, backward compatible. Existing "daytona" and "state" values unchanged.
- **Frontend changes**: Purely additive -- new option in dropdown, hidden by default until `OPENSHELL_API_KEY` is set.
- **Auto fallback chain**: OpenShell failure silently falls through to State, just like Daytona failures do today.

### Medium Risk
- **`openshell` package availability**: The package is published by NVIDIA but may not be on PyPI yet (the reference uses a local `.whl`). If not on PyPI, requires a local wheel or private index. **Mitigation:** Use a conditional extra dependency group (`[openshell]`) so the main install is unaffected.
- **gRPC dependency conflicts**: `openshell` requires `grpcio>=1.60` and `protobuf>=4.25`. These should be compatible with the existing stack but need verification. **Mitigation:** Run `uv lock` and check for conflicts before merging.
- **Synchronous `SandboxClient` calls**: `openshell` uses synchronous gRPC. `create_openshell_backend()` is called during request handling, which blocks the async event loop. This is the same pattern used by `create_daytona_backend()` (which also makes sync HTTP calls). **Mitigation:** Acceptable for now; could be wrapped in `asyncio.to_thread()` in a follow-up if latency is an issue.
- **Sandbox lifecycle**: In auto mode, fresh sandboxes are created per-request. `wait_ready()` can block for up to 300 seconds. **Mitigation:** Use `OPENSHELL_SANDBOX_NAME` for production to connect to a pre-created persistent sandbox.

### High Risk
- **None identified.** This is a pure additive change following an established pattern.

---

## Estimated Complexity

| Area | Lines Changed | Lines Added | Total |
|------|---------------|-------------|-------|
| `backend/pyproject.toml` | 0 | 1 | 1 |
| `backend/src/constants/__init__.py` | 0 | 6 | 6 |
| `backend/src/agents/__init__.py` | ~10 | ~70 | ~80 |
| `backend/src/agents/openshell.py` (new) | 0 | ~95 | 95 |
| `backend/src/schemas/entities/settings.py` | 0 | 1 | 1 |
| `backend/src/controllers/llm.py` | ~2 | ~25 | ~27 |
| `backend/src/utils/stream.py` | ~2 | ~25 | ~27 |
| `backend/src/workers/tasks.py` | ~2 | ~25 | ~27 |
| `frontend/src/lib/services/userSettingsService.ts` | 1 | 0 | 1 |
| `frontend/src/lib/config/sandbox.ts` | ~5 | ~8 | ~13 |
| `frontend/src/components/settings/SandboxSettings.tsx` | ~4 | ~4 | ~8 |
| `frontend/src/components/status/ThreadSandboxStatus.tsx` | ~4 | ~4 | ~8 |
| **Total** | **~30** | **~264** | **~294** |

**Estimated effort:** ~2-3 hours for a developer familiar with the codebase, including manual testing.

---

## Testing Plan

### Unit Tests

1. **`tests/unit/agents/test_openshell_backend.py`** (new):
   - Mock `SandboxSession` and verify `OpenShellBackend.execute()` returns correct `ExecuteResponse`.
   - Verify `upload_files()` handles success and failure cases.
   - Verify `download_files()` handles success and file-not-found cases.

2. **`tests/unit/agents/test_resolve_sandbox.py`** (extend existing or new):
   - Test `resolve_sandbox_backend()` with `sandbox_type="openshell"` when OpenShell is available.
   - Test `resolve_sandbox_backend()` with `sandbox_type="openshell"` when OpenShell is unavailable (falls back to State).
   - Test auto mode tries Daytona -> OpenShell -> State.
   - Test `sandbox_type="state"` never tries OpenShell.

3. **`tests/unit/schemas/test_settings.py`** (extend):
   - Verify `SandboxType.OPENSHELL.value == "openshell"`.
   - Verify `UserSettingsRepo.set_default_sandbox("openshell")` succeeds.
   - Verify `UserSettingsRepo.set_default_sandbox("invalid")` raises `ValueError`.

### Integration Tests

1. With `OPENSHELL_GATEWAY` set and an active cluster:
   - Verify `create_openshell_backend()` returns a valid session and backend.
   - Verify a full agent invoke with `sandbox_type="openshell"`.

### Frontend Tests

1. Verify `normalizeSandboxValue("openshell")` returns `"openshell"`.
2. Verify `SANDBOX_OPTIONS` contains the OpenShell entry.
3. Verify `SandboxSettings` shows OpenShell option when `OPENSHELL_API_KEY` is set.
4. Verify `ThreadSandboxStatus` shows OpenShell option when `OPENSHELL_API_KEY` is set.

---

## Migration Notes

- No database migration needed. The `SandboxType` enum is used only for validation; the actual value stored in the `UserSettings` entity is a plain string.
- Existing users with `default_sandbox` set to `"daytona"` or `"state"` are unaffected.
- The `openshell` package is optional at runtime; if not installed, the import guard returns `None` and the factory is skipped silently.
