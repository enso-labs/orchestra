# Spec C: Config-Driven Sandbox Provider Registry with OpenShell Support

## Approach Summary

Refactor the existing monolithic sandbox resolution in `backend/src/agents/__init__.py` into a **config-driven provider registry** pattern. Each sandbox backend (State, Daytona, OpenShell) becomes an independent provider module under a new `backend/src/sandbox/` package. Providers are auto-discovered at startup based on available dependencies and environment variables. The registry exposes a unified `resolve()` method that replaces the current `resolve_sandbox_backend()` function. The frontend gains a dynamic sandbox selector that only shows providers available on the current deployment.

---

## Architecture Overview

```
backend/src/sandbox/
    __init__.py          # Public API: resolve(), get_available_providers()
    registry.py          # SandboxProviderRegistry singleton
    protocol.py          # SandboxProvider protocol (abstract interface)
    providers/
        __init__.py      # Auto-import all provider modules
        state.py         # StateProvider (always available, fallback)
        daytona.py       # DaytonaProvider (requires daytona + API key)
        openshell.py     # OpenShellProvider (requires openshell + gateway)
```

Key design decisions:
- **Protocol, not ABC**: Use `typing.Protocol` so third-party backends can duck-type without inheriting.
- **Priority ordering**: Each provider declares a `priority: int` (lower = preferred in auto mode). State=100, Daytona=10, OpenShell=20.
- **Lazy initialization**: Provider classes are lightweight descriptors. The actual sandbox session is only created when `create_backend()` is called.
- **Backward compatible**: `resolve_sandbox_backend()` is preserved as a thin wrapper that delegates to the registry. Existing callers (`controllers/llm.py`, `utils/stream.py`, `workers/tasks.py`) need zero changes initially.

---

## Files to Create

### 1. `backend/src/sandbox/__init__.py`

Public API surface. All external code imports from here.

```python
"""Config-driven sandbox provider registry.

Usage:
    from src.sandbox import resolve_sandbox_backend, get_available_providers

    # Get list of available providers for API/frontend
    providers = get_available_providers()
    # -> [{"name": "state", "label": "State (Default)", "available": True}, ...]

    # Resolve a backend by type (replaces agents/__init__.py version)
    backend, sandbox, effective_type = resolve_sandbox_backend(runtime, sandbox_type="openshell")
"""

from src.sandbox.registry import SandboxProviderRegistry

_registry = SandboxProviderRegistry()


def get_available_providers() -> list[dict]:
    """Return metadata for all registered providers, with availability status."""
    return _registry.list_providers()


def resolve_sandbox_backend(runtime, sandbox_type: str | None = None):
    """Resolve a sandbox backend. Drop-in replacement for agents.resolve_sandbox_backend.

    Returns (CompositeBackend, sandbox_or_None, effective_type_str).
    """
    return _registry.resolve(runtime, sandbox_type=sandbox_type)
```

### 2. `backend/src/sandbox/protocol.py`

The provider contract.

```python
"""Sandbox provider protocol.

Every provider must implement this interface. The registry uses it to
discover, validate, and instantiate sandbox backends at runtime.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from langchain.tools import ToolRuntime
from deepagents.backends import CompositeBackend


@runtime_checkable
class SandboxProvider(Protocol):
    """Contract that every sandbox provider must satisfy."""

    @property
    def name(self) -> str:
        """Unique identifier used in settings and API (e.g., 'openshell')."""
        ...

    @property
    def label(self) -> str:
        """Human-readable display name for the frontend."""
        ...

    @property
    def short_label(self) -> str:
        """Compact label for toolbar/status bar."""
        ...

    @property
    def description(self) -> str:
        """One-line description for the settings UI."""
        ...

    @property
    def priority(self) -> int:
        """Auto-mode priority. Lower = tried first. State is always 100 (fallback)."""
        ...

    def is_available(self) -> bool:
        """Return True if this provider can be used (deps installed, env vars set)."""
        ...

    def create_backend(
        self,
        runtime: ToolRuntime,
    ) -> tuple[CompositeBackend, Any]:
        """Instantiate and return (backend, sandbox_handle_or_None).

        Raises on failure so the registry can fall back to the next provider.
        """
        ...

    def cleanup(self, sandbox: Any) -> None:
        """Optional cleanup when a sandbox is no longer needed (e.g., stop Daytona)."""
        ...
```

### 3. `backend/src/sandbox/registry.py`

The registry singleton that auto-discovers providers.

```python
"""Sandbox provider registry.

Discovers and manages sandbox providers. Providers register themselves
by being importable from src.sandbox.providers.
"""

from __future__ import annotations

from typing import Any

from langchain.tools import ToolRuntime
from deepagents.backends import CompositeBackend

from src.sandbox.protocol import SandboxProvider
from src.utils.logger import logger


class SandboxProviderRegistry:
    """Central registry for sandbox providers."""

    def __init__(self) -> None:
        self._providers: dict[str, SandboxProvider] = {}
        self._discover()

    def _discover(self) -> None:
        """Import all provider modules and register available providers."""
        from src.sandbox.providers.state import StateProvider
        from src.sandbox.providers.daytona import DaytonaProvider
        from src.sandbox.providers.openshell import OpenShellProvider

        for cls in (StateProvider, DaytonaProvider, OpenShellProvider):
            try:
                provider = cls()
                self._providers[provider.name] = provider
                logger.info(
                    "sandbox_provider_registered name=%s available=%s priority=%d",
                    provider.name,
                    provider.is_available(),
                    provider.priority,
                )
            except Exception as exc:
                logger.warning("sandbox_provider_init_failed cls=%s error=%s", cls.__name__, exc)

    def get(self, name: str) -> SandboxProvider | None:
        return self._providers.get(name)

    def list_providers(self) -> list[dict]:
        """Return provider metadata sorted by priority, for the frontend/API."""
        result = []
        for p in sorted(self._providers.values(), key=lambda p: p.priority):
            result.append(
                {
                    "name": p.name,
                    "label": p.label,
                    "short_label": p.short_label,
                    "description": p.description,
                    "available": p.is_available(),
                }
            )
        return result

    def resolve(
        self,
        runtime: ToolRuntime,
        sandbox_type: str | None = None,
    ) -> tuple[CompositeBackend, Any, str]:
        """Resolve a sandbox backend.

        Dispatch rules:
        - None / "auto" : try available providers in priority order, fall back to state.
        - "state"       : use StateProvider directly.
        - "<name>"      : try that provider, fall back to state if unavailable.

        Returns (backend, sandbox_handle_or_None, effective_type).
        """
        # Explicit "state" - skip auto-discovery
        if sandbox_type == "state":
            return self._create_from("state", runtime)

        # Explicit provider name
        if sandbox_type and sandbox_type != "auto":
            provider = self.get(sandbox_type)
            if provider and provider.is_available():
                try:
                    backend, sandbox = provider.create_backend(runtime)
                    return backend, sandbox, provider.name
                except Exception as exc:
                    logger.warning(
                        "sandbox_provider_create_failed name=%s error=%s, falling back to state",
                        sandbox_type,
                        exc,
                    )
            # Fall through to state
            return self._create_from("state", runtime)

        # Auto mode: try providers in priority order (excluding state)
        candidates = sorted(
            (p for p in self._providers.values() if p.name != "state"),
            key=lambda p: p.priority,
        )
        for provider in candidates:
            if not provider.is_available():
                continue
            try:
                backend, sandbox = provider.create_backend(runtime)
                logger.info("sandbox_auto_resolved name=%s", provider.name)
                return backend, sandbox, provider.name
            except Exception as exc:
                logger.warning(
                    "sandbox_auto_candidate_failed name=%s error=%s",
                    provider.name,
                    exc,
                )
                continue

        # Fallback: state is always available
        return self._create_from("state", runtime)

    def _create_from(
        self,
        name: str,
        runtime: ToolRuntime,
    ) -> tuple[CompositeBackend, Any, str]:
        provider = self._providers[name]
        backend, sandbox = provider.create_backend(runtime)
        return backend, sandbox, name
```

### 4. `backend/src/sandbox/providers/__init__.py`

```python
"""Sandbox provider implementations."""
```

### 5. `backend/src/sandbox/providers/state.py`

Wraps the existing `_create_state_backend` logic.

```python
"""State sandbox provider.

Always available. Uses deepagents StateBackend for in-process execution.
This is the universal fallback when no remote sandbox is configured.
"""

from __future__ import annotations

from typing import Any

from langchain.tools import ToolRuntime
from deepagents.backends import CompositeBackend, StateBackend


class StateProvider:
    """In-process state-based sandbox (always available)."""

    @property
    def name(self) -> str:
        return "state"

    @property
    def label(self) -> str:
        return "State (Default)"

    @property
    def short_label(self) -> str:
        return "State"

    @property
    def description(self) -> str:
        return "Run agent code with the in-process state sandbox backend."

    @property
    def priority(self) -> int:
        return 100  # Always last in auto-mode

    def is_available(self) -> bool:
        return True  # StateBackend has no external dependencies

    def create_backend(self, runtime: ToolRuntime) -> tuple[CompositeBackend, None]:
        default_state = StateBackend(runtime)
        backend = CompositeBackend(default=default_state, routes={})
        return backend, None

    def cleanup(self, sandbox: Any) -> None:
        pass  # Nothing to clean up
```

### 6. `backend/src/sandbox/providers/daytona.py`

Wraps existing Daytona logic from `agents/__init__.py` and `agents/daytona.py`.

```python
"""Daytona sandbox provider.

Available when the `daytona` and `langchain-daytona` packages are installed
AND the DAYTONA_API_KEY environment variable is set.
"""

from __future__ import annotations

from typing import Any

from langchain.tools import ToolRuntime
from deepagents.backends import CompositeBackend

from src.utils.logger import logger

# Conditional imports (identical to existing pattern in agents/__init__.py)
try:
    from daytona import Daytona, DaytonaConfig
    from langchain_daytona import DaytonaSandbox

    _HAS_DAYTONA = True
except ImportError:
    _HAS_DAYTONA = False


class DaytonaProvider:
    """Remote Daytona sandbox provider."""

    @property
    def name(self) -> str:
        return "daytona"

    @property
    def label(self) -> str:
        return "Daytona"

    @property
    def short_label(self) -> str:
        return "Daytona"

    @property
    def description(self) -> str:
        return "Run agent code in a remote Daytona sandbox."

    @property
    def priority(self) -> int:
        return 10  # Preferred over State in auto-mode

    def is_available(self) -> bool:
        if not _HAS_DAYTONA:
            return False
        from src.constants import DAYTONA_API_KEY

        return bool(DAYTONA_API_KEY)

    def create_backend(self, runtime: ToolRuntime) -> tuple[CompositeBackend, Any]:
        from src.constants import DAYTONA_API_KEY
        from src.agents.daytona import validate_daytona_execute_capability

        client = Daytona(DaytonaConfig(api_key=DAYTONA_API_KEY))
        sandboxes = client.list()
        sandbox = sandboxes.items[0] if sandboxes.total else None
        if not sandbox:
            sandbox = client.create()

        daytona_backend = DaytonaSandbox(sandbox=sandbox)

        supported, reason = validate_daytona_execute_capability(daytona_backend)
        if not supported:
            # Clean up before raising
            try:
                sandbox.stop()
            except Exception:
                pass
            raise RuntimeError(f"Daytona sandbox not capable: {reason}")

        backend = CompositeBackend(default=daytona_backend, routes={})
        return backend, sandbox

    def cleanup(self, sandbox: Any) -> None:
        if sandbox is not None:
            try:
                sandbox.stop()
            except Exception as exc:
                logger.warning("daytona_cleanup_failed error=%s", exc)
```

### 7. `backend/src/sandbox/providers/openshell.py`

New provider, adapted from the reference implementation.

```python
"""OpenShell sandbox provider.

Available when the `openshell` package (>=0.0.7) is installed AND either
OPENSHELL_GATEWAY is set or an active cluster is configured locally.
"""

from __future__ import annotations

import base64
import os
import shlex
from typing import Any

from langchain.tools import ToolRuntime
from deepagents.backends import CompositeBackend
from deepagents.backends.protocol import (
    ExecuteResponse,
    FileDownloadResponse,
    FileUploadResponse,
)
from deepagents.backends.sandbox import BaseSandbox

from src.utils.logger import logger

# Conditional import
try:
    from openshell import SandboxClient, SandboxSession

    _HAS_OPENSHELL = True
except ImportError:
    _HAS_OPENSHELL = False

# Environment variable names
OPENSHELL_GATEWAY_ENV = "OPENSHELL_GATEWAY"
OPENSHELL_SANDBOX_NAME_ENV = "OPENSHELL_SANDBOX_NAME"
OPENSHELL_DEFAULT_TIMEOUT_ENV = "OPENSHELL_DEFAULT_TIMEOUT"


class OpenShellBackend(BaseSandbox):
    """deepagents SandboxBackendProtocol backed by an OpenShell sandbox.

    Wraps a live SandboxSession. File operations (read, write, edit, grep,
    glob, ls) are inherited from BaseSandbox. Only execute(), upload_files(),
    and download_files() are implemented here.
    """

    def __init__(
        self,
        session: SandboxSession,
        *,
        default_timeout: int = 30 * 60,
    ) -> None:
        self._session = session
        self._default_timeout = default_timeout

    @property
    def id(self) -> str:
        return self._session.id

    def execute(self, command: str, *, timeout: int | None = None) -> ExecuteResponse:
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
        responses = []
        for path, content in files:
            try:
                parent = shlex.quote(os.path.dirname(path) or ".")
                dest = shlex.quote(path)
                result = self._session.exec(
                    ["bash", "-c", f"mkdir -p {parent} && cat > {dest}"],
                    stdin=content,
                )
                error = "permission_denied" if result.exit_code != 0 else None
                responses.append(FileUploadResponse(path=path, error=error))
            except Exception:
                responses.append(FileUploadResponse(path=path, error="permission_denied"))
        return responses

    def download_files(self, paths: list[str]) -> list[FileDownloadResponse]:
        responses = []
        for path in paths:
            try:
                result = self._session.exec(["base64", path])
                if result.exit_code != 0:
                    responses.append(FileDownloadResponse(path=path, content=None, error="file_not_found"))
                else:
                    content = base64.b64decode(result.stdout.strip())
                    responses.append(FileDownloadResponse(path=path, content=content, error=None))
            except Exception:
                responses.append(FileDownloadResponse(path=path, content=None, error="file_not_found"))
        return responses


class OpenShellProvider:
    """OpenShell on-premises sandbox provider."""

    @property
    def name(self) -> str:
        return "openshell"

    @property
    def label(self) -> str:
        return "OpenShell"

    @property
    def short_label(self) -> str:
        return "OpenShell"

    @property
    def description(self) -> str:
        return "Run agent code in an OpenShell on-premises sandbox."

    @property
    def priority(self) -> int:
        return 20  # After Daytona (10) but before State (100) in auto-mode

    def is_available(self) -> bool:
        if not _HAS_OPENSHELL:
            return False
        # Available if OPENSHELL_GATEWAY is set or an active cluster exists
        if os.getenv(OPENSHELL_GATEWAY_ENV):
            return True
        try:
            SandboxClient.from_active_cluster()
            return True
        except Exception:
            return False

    def create_backend(self, runtime: ToolRuntime) -> tuple[CompositeBackend, Any]:
        default_timeout = int(os.getenv(OPENSHELL_DEFAULT_TIMEOUT_ENV, str(30 * 60)))
        client = SandboxClient.from_active_cluster()

        sandbox_name = os.getenv(OPENSHELL_SANDBOX_NAME_ENV)
        if sandbox_name:
            ref = client.get(sandbox_name)
        else:
            ref = client.create()
            ref = client.wait_ready(ref.name)

        session = SandboxSession(client, ref)
        openshell_backend = OpenShellBackend(session, default_timeout=default_timeout)
        backend = CompositeBackend(default=openshell_backend, routes={})

        logger.info(
            "openshell_sandbox_created sandbox=%s gateway=%s",
            ref.name,
            os.getenv(OPENSHELL_GATEWAY_ENV, "active-cluster"),
        )
        return backend, ref

    def cleanup(self, sandbox: Any) -> None:
        # Only clean up sandboxes we created (not named/pre-existing ones)
        if sandbox is not None and not os.getenv(OPENSHELL_SANDBOX_NAME_ENV):
            try:
                client = SandboxClient.from_active_cluster()
                client.delete(sandbox.name)
                logger.info("openshell_sandbox_deleted sandbox=%s", sandbox.name)
            except Exception as exc:
                logger.warning("openshell_cleanup_failed error=%s", exc)
```

---

## Files to Modify

### 8. `backend/src/agents/__init__.py`

**Changes**: Remove sandbox factory functions and `resolve_sandbox_backend`. Replace with a thin wrapper that delegates to the new registry. Keep `_create_state_backend` as a deprecated alias for backward compat.

```python
# --- REMOVE these imports (lines 18-19) ---
# from deepagents.backends import CompositeBackend, StateBackend
# from deepagents.backends.utils import create_file_data

# --- REMOVE these blocks ---
# Lines 23-31: Conditional Daytona imports (moved to sandbox/providers/daytona.py)
# Lines 251-316: create_daytona_backend, _create_daytona_backend_checked,
#                _create_state_backend, _SANDBOX_FACTORIES
# Lines 319-347: resolve_sandbox_backend

# --- ADD these imports ---
from deepagents.backends import CompositeBackend
from deepagents.backends.utils import create_file_data

# --- ADD re-export from new package ---
from src.sandbox import resolve_sandbox_backend  # noqa: F401  (backward compat re-export)


# --- KEEP this function for backward compat (used in controllers/llm.py and utils/stream.py) ---
def _create_state_backend(runtime):
    """Deprecated: use src.sandbox directly. Kept for backward compatibility."""
    from src.sandbox.providers.state import StateProvider
    return StateProvider().create_backend(runtime)
```

Specifically, the full diff removes ~70 lines of sandbox logic and replaces them with ~10 lines of delegation. All other functions (`init_graph`, `construct_agent`, `Orchestra`, etc.) remain untouched.

### 9. `backend/src/schemas/entities/settings.py`

**Changes**: Add `OPENSHELL` to the `SandboxType` enum.

```python
class SandboxType(str, Enum):
    """Supported sandbox backend types."""

    DAYTONA = "daytona"
    OPENSHELL = "openshell"
    STATE = "state"
```

### 10. `backend/src/constants/__init__.py`

**Changes**: Add `OPENSHELL_API_KEY` to `UserTokenKey` enum (optional -- only needed if you want users to store per-user OpenShell gateway credentials). Also add the env var constants.

```python
class UserTokenKey(Enum):
    # ... existing entries ...
    DAYTONA_API_KEY = "DAYTONA_API_KEY"
    OPENSHELL_GATEWAY = "OPENSHELL_GATEWAY"  # NEW

# At module level, add:
OPENSHELL_GATEWAY = os.getenv(UserTokenKey.OPENSHELL_GATEWAY.value)
OPENSHELL_SANDBOX_NAME = os.getenv("OPENSHELL_SANDBOX_NAME")
```

### 11. `backend/src/routes/v0/settings.py`

**Changes**: Add a new endpoint to expose available sandbox providers.

```python
from src.sandbox import get_available_providers

@router.get("/settings/sandbox-providers")
async def list_sandbox_providers(
    user: User = Depends(verify_credentials),
):
    """Return the list of sandbox providers available on this deployment."""
    return get_available_providers()
```

### 12. `frontend/src/lib/services/userSettingsService.ts`

**Changes**: Add `openshell` to the `SandboxType` union. Add a service function to fetch available providers.

```typescript
export type SandboxType = "daytona" | "state" | "openshell";

export interface SandboxProviderInfo {
  name: string;
  label: string;
  short_label: string;
  description: string;
  available: boolean;
}

export const getSandboxProviders = async (): Promise<SandboxProviderInfo[]> => {
  const response = await apiClient.get("/settings/sandbox-providers");
  return response.data;
};
```

### 13. `frontend/src/lib/config/sandbox.ts`

**Changes**: Replace static `SANDBOX_OPTIONS` with a dynamic approach. Keep the static list as a fallback but add OpenShell and support merging with server-provided availability.

```typescript
import type { SandboxType } from "@/lib/services/userSettingsService";

export type SandboxOption = {
  value: SandboxType;
  label: string;
  shortLabel: string;
  description: string;
};

export const DEFAULT_SANDBOX: SandboxType = "state";

// Static fallback options (used before API response arrives)
export const SANDBOX_OPTIONS: readonly SandboxOption[] = [
  {
    value: "state",
    label: "State (Default)",
    shortLabel: "State",
    description: "Run agent code with the in-process state sandbox backend.",
  },
  {
    value: "daytona",
    label: "Daytona",
    shortLabel: "Daytona",
    description: "Run agent code in a remote Daytona sandbox.",
  },
  {
    value: "openshell",
    label: "OpenShell",
    shortLabel: "OpenShell",
    description: "Run agent code in an OpenShell on-premises sandbox.",
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

export function getSandboxOption(
  value: string | null | undefined,
): SandboxOption {
  return (
    SANDBOX_OPTIONS.find(
      (option) => option.value === normalizeSandboxValue(value),
    ) ?? SANDBOX_OPTIONS[0]
  );
}

export function toSandboxPatchValue(value: SandboxType): string {
  return value;
}
```

### 14. `frontend/src/components/settings/SandboxSettings.tsx`

**Changes**: Fetch available providers from the API instead of filtering by provider keys.

```tsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DEFAULT_SANDBOX, normalizeSandboxValue, toSandboxPatchValue } from "@/lib/config/sandbox";
import {
  type SandboxProviderInfo,
  type SandboxType,
  getSettings,
  getSandboxProviders,
  patchDefaults,
} from "@/lib/services/userSettingsService";

export function SandboxSettings() {
  const [sandbox, setSandbox] = useState<SandboxType>(DEFAULT_SANDBOX);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<SandboxProviderInfo[]>([]);

  useEffect(() => {
    Promise.all([getSettings(), getSandboxProviders()])
      .then(([settingsRes, providersRes]) => {
        setSandbox(normalizeSandboxValue(settingsRes.defaults.sandbox));
        setProviders(providersRes.filter((p) => p.available));
      })
      .catch(() => {});
  }, []);

  const handleChange = async (value: string) => {
    const nextSandbox = normalizeSandboxValue(value);
    setLoading(true);
    try {
      const res = await patchDefaults({ sandbox: toSandboxPatchValue(nextSandbox) });
      setSandbox(normalizeSandboxValue(res.defaults.sandbox));
      toast.success("Default sandbox updated");
    } catch {
      toast.error("Failed to update default sandbox");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Sandbox</CardTitle>
        <CardDescription>
          Choose the sandbox backend for agent code execution.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={sandbox} onValueChange={handleChange} disabled={loading}>
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.name} value={p.name}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
```

### 15. `frontend/src/components/status/ThreadSandboxStatus.tsx`

**Changes**: Same pattern -- replace static option filtering with API-driven provider list.

Replace the `visibleOptions` logic:

```tsx
// Replace providerKeys-based filtering with dynamic provider list
const [providers, setProviders] = useState<SandboxProviderInfo[]>([]);

useEffect(() => {
  Promise.all([getSettings(), getSandboxProviders()])
    .then(([settingsRes, providersRes]) => {
      setSandbox(normalizeSandboxValue(settingsRes.defaults.sandbox));
      setProviders(providersRes.filter((p) => p.available));
    })
    .catch(() => { setSandbox(DEFAULT_SANDBOX); })
    .finally(() => { setLoading(false); });

  // ...cleanup
}, []);

// In the render, use `providers` instead of `visibleOptions`:
{providers.map((p) => {
  const selected = p.name === sandbox;
  return (
    <button key={p.name} onClick={() => handleSelect(p.name as SandboxType)} ...>
      <span className="block text-sm font-medium">{p.label}</span>
      <span className="block text-xs text-muted-foreground">{p.description}</span>
    </button>
  );
})}
```

---

## Dependencies to Add

### `backend/pyproject.toml`

```toml
[project.optional-dependencies]
# Add new optional dependency group for OpenShell
openshell = [
    "openshell>=0.0.7",
]
```

**Note**: `openshell` is an *optional* dependency. The provider auto-detects its absence and marks itself as unavailable. This follows the same pattern already used for Daytona (which is a hard dependency today but could also become optional).

For deployments that want OpenShell support:

```bash
uv sync --extra openshell
```

Or in Docker:

```dockerfile
RUN uv sync --extra openshell
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENSHELL_GATEWAY` | No | (auto from `~/.config/openshell/active_gateway`) | OpenShell gateway URL. If set, enables the provider. |
| `OPENSHELL_SANDBOX_NAME` | No | (none -- creates fresh) | Connect to a pre-existing named sandbox instead of creating a new one. |
| `OPENSHELL_DEFAULT_TIMEOUT` | No | `1800` (30 min) | Default timeout in seconds for command execution. |

### Existing Variables (unchanged)

| Variable | Provider |
|---|---|
| `DAYTONA_API_KEY` | Daytona |
| (none required) | State |

---

## API Changes

### New Endpoint: `GET /settings/sandbox-providers`

**Response**: `200 OK`

```json
[
  {
    "name": "daytona",
    "label": "Daytona",
    "short_label": "Daytona",
    "description": "Run agent code in a remote Daytona sandbox.",
    "available": true
  },
  {
    "name": "openshell",
    "label": "OpenShell",
    "short_label": "OpenShell",
    "description": "Run agent code in an OpenShell on-premises sandbox.",
    "available": false
  },
  {
    "name": "state",
    "label": "State (Default)",
    "short_label": "State",
    "description": "Run agent code with the in-process state sandbox backend.",
    "available": true
  }
]
```

### Modified: `PATCH /settings/default`

The `sandbox` field now accepts `"openshell"` in addition to `"daytona"` and `"state"`.

---

## Migration Path

### Phase 1: Add the registry (non-breaking)

1. Create `backend/src/sandbox/` package with all provider modules.
2. Add `resolve_sandbox_backend` re-export in `agents/__init__.py` so existing imports still work.
3. Both old and new code paths produce identical behavior.
4. Add the `GET /settings/sandbox-providers` endpoint.
5. Update frontend components to fetch providers dynamically.

### Phase 2: Clean up legacy code

1. Remove duplicated sandbox logic from `agents/__init__.py`.
2. Update direct callers (`controllers/llm.py`, `utils/stream.py`, `workers/tasks.py`) to import from `src.sandbox` instead of `src.agents`.
3. Remove the `_create_state_backend` compatibility shim from `agents/__init__.py`.

### Phase 3: OpenShell error handling

1. Add `is_openshell_error()` utility (mirroring `is_daytona_error()`).
2. Update the Daytona-specific auto-mode fallback logic in `controllers/llm.py` and `utils/stream.py` to be provider-generic. The registry already handles this, but the error-recovery retry logic in those files is currently Daytona-specific and should be generalized.

---

## Error Handling Strategy

The current codebase has Daytona-specific error handling with auto-mode fallback. With the registry pattern, this generalizes:

```python
# In controllers/llm.py and utils/stream.py, replace:
#   if is_daytona_error(e): ...
# with:
#   if effective_type != "state": ...fallback to state...

# The registry already handles per-provider availability checks.
# The controller-level retry only needs to know "was a remote sandbox used?"
```

This avoids adding an `is_openshell_error()` check for every new provider. Instead, any non-state provider failure triggers the same fallback path.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Registry import at startup fails | High | Each provider class catches its own import errors. StateProvider has zero deps and is always available. |
| OpenShell package not available on all deployments | Low | Conditional import pattern (`_HAS_OPENSHELL`) prevents import errors. Provider simply reports `available: false`. |
| Breaking change if callers import sandbox functions from `agents/__init__` | Medium | Re-export `resolve_sandbox_backend` from `agents/__init__.py` for full backward compatibility. Deprecation warning in Phase 2. |
| OpenShell sandbox creation hangs (`wait_ready`) | Medium | Respect `OPENSHELL_DEFAULT_TIMEOUT` env var. Consider adding a creation timeout parameter to `create_backend()`. |
| Multiple registry instances (threading) | Low | Registry is stateless after init. Providers are lightweight descriptor objects. `SandboxClient.from_active_cluster()` is called per-request in `create_backend()`, not cached. |
| Frontend shows stale provider list | Low | Provider list is fetched on page load. Cache-Control header can be added if needed. |
| Daytona auto-fallback regression | Medium | The existing Daytona error handling in `controllers/llm.py` and `stream.py` is preserved in Phase 1. Only generalized in Phase 3 after testing. |
| `SandboxType` enum breaks existing stored settings | Low | Adding a new enum member is backward compatible. Existing "daytona" and "state" values remain valid. |

---

## Estimated Complexity

| Area | Files Changed | Lines Added | Lines Removed | Net |
|---|---|---|---|---|
| `backend/src/sandbox/` (new package) | 7 new files | ~350 | 0 | +350 |
| `backend/src/agents/__init__.py` | 1 modified | ~10 | ~70 | -60 |
| `backend/src/schemas/entities/settings.py` | 1 modified | 1 | 0 | +1 |
| `backend/src/constants/__init__.py` | 1 modified | 4 | 0 | +4 |
| `backend/src/routes/v0/settings.py` | 1 modified | 10 | 0 | +10 |
| `backend/pyproject.toml` | 1 modified | 3 | 0 | +3 |
| `frontend/src/lib/services/userSettingsService.ts` | 1 modified | 12 | 0 | +12 |
| `frontend/src/lib/config/sandbox.ts` | 1 modified | 10 | 2 | +8 |
| `frontend/src/components/settings/SandboxSettings.tsx` | 1 modified | 15 | 20 | -5 |
| `frontend/src/components/status/ThreadSandboxStatus.tsx` | 1 modified | 15 | 20 | -5 |
| **Total** | **16 files (7 new, 9 modified)** | **~430** | **~112** | **~+318** |

### Implementation Effort

- Backend sandbox package: **1-2 days** (straightforward extraction + OpenShell adapter)
- Backend integration/cleanup: **0.5 day** (re-exports, settings enum, route)
- Frontend dynamic providers: **0.5 day** (API call + render changes)
- Testing: **1 day** (unit tests for registry, each provider, and frontend components)
- **Total: ~3-4 days**

---

## Testing Plan

### Backend Unit Tests

| Test File | Coverage |
|---|---|
| `tests/unit/sandbox/test_registry.py` | Registry discovery, resolve auto/explicit/fallback, unknown provider |
| `tests/unit/sandbox/test_state_provider.py` | StateProvider always available, create_backend returns CompositeBackend |
| `tests/unit/sandbox/test_daytona_provider.py` | Available when deps+key present, unavailable when missing, create_backend delegates |
| `tests/unit/sandbox/test_openshell_provider.py` | Available when deps+gateway present, unavailable when missing, mock SandboxClient |
| `tests/unit/sandbox/test_openshell_backend.py` | execute(), upload_files(), download_files() with mocked SandboxSession |

### Frontend Tests

| Test File | Coverage |
|---|---|
| `src/lib/config/sandbox.test.ts` | normalizeSandboxValue handles "openshell" |
| `src/components/settings/SandboxSettings.test.tsx` | Renders dynamic providers, handles select |
| `src/components/status/ThreadSandboxStatus.test.tsx` | Updated to use dynamic providers |

### Integration Test

- Verify `GET /settings/sandbox-providers` returns correct availability based on env vars.
- Verify `PATCH /settings/default` accepts `sandbox: "openshell"`.
- Verify agent construction with each provider type via `resolve_sandbox_backend`.
