# PRD: FileSystem Backend for DeepAgents

**Version**: 1.0
**Date**: 2026-01-25
**Author**: AI Engineering Team
**Status**: Draft

---

## Executive Summary

This PRD outlines the implementation of a FileSystemBackend for Orchestra's `create_deep_agent` integration with the deepagents library. The implementation is divided into two phases:

- **Phase 1**: Basic FilesystemBackend with shared filesystem access (no per-user isolation)
- **Phase 2**: Per-user isolated container filesystem backends using Ubuntu 24.04 containers

---

## Background & Research

### DeepAgents Library Overview

DeepAgents (v0.3.8) is an agent harness built on LangChain and LangGraph that provides:
- **Planning tools**: `write_todos`, `read_todos` for task management
- **Filesystem tools**: `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`
- **Execution tools**: `execute` for shell command execution (requires `SandboxBackendProtocol`)
- **Subagent delegation**: `task` tool for spawning isolated subagents

### Current Backend Architecture in Orchestra

Orchestra currently uses a `CompositeBackend` pattern:

```python
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend

def init_backend(runtime: ToolRuntime, *, routes):
    built_routes = {}
    for prefix, backend_or_factory in routes.items():
        if callable(backend_or_factory):
            built_routes[prefix] = backend_or_factory(runtime)
        else:
            built_routes[prefix] = backend_or_factory
    default_state = StateBackend(runtime)
    return CompositeBackend(default=default_state, routes=built_routes)
```

**Current backends used:**
- `StateBackend`: Default backend for ephemeral state-based file operations
- `StoreBackend`: Persistent storage via LangGraph BaseStore for `/users/{user_id}/memories/` and `/users/{user_id}/config/`

**Missing capability:** Real filesystem access with optional container isolation.

### DeepAgents Backend Protocol

The deepagents library defines `BackendProtocol` with these methods:

| Method | Description |
|--------|-------------|
| `read(file_path, offset, limit)` | Read file content with pagination |
| `write(file_path, content)` | Write content to file |
| `edit(file_path, old_string, new_string, replace_all)` | String replacement in files |
| `ls_info(path)` | List directory contents |
| `glob_info(pattern)` | Glob pattern matching |
| `grep_raw(pattern, path, ...)` | Search file contents |

For execution support, `SandboxBackendProtocol` extends the base with:

| Method | Description |
|--------|-------------|
| `execute(command, timeout, ...)` | Run shell commands in sandbox |
| `aexecute(...)` | Async variant |

### FilesystemBackend from DeepAgents

The built-in `FilesystemBackend` from deepagents:

```python
from deepagents.backends import FilesystemBackend

backend = FilesystemBackend(
    root_dir="/path/to/workspace",  # Base directory for all operations
    virtual_mode=True,               # Enable path sandboxing
)
```

**Key features:**
- Reads/writes real files under configurable `root_dir`
- `virtual_mode=True` sandboxes and normalizes paths under `root_dir`
- Secure path resolution preventing directory traversal (`..`, `~`)
- Uses ripgrep for fast grep operations when available
- Prevents unsafe symlink traversal

---

## Goals & Non-Goals

### Goals

1. Enable agents to perform real filesystem operations
2. Provide isolated workspace per agent session
3. Support shell command execution in sandboxed environments
4. Allow persistent project workspaces for users
5. Scale to per-user container isolation in Phase 2

### Non-Goals (Phase 1)

- Per-user container isolation (Phase 2)
- Network isolation between users
- GPU access within containers
- Container orchestration at scale (Kubernetes)

---

## Phase 1: Shared FilesystemBackend

### Overview

Phase 1 implements a basic `FilesystemBackend` with shared host filesystem access. All agent sessions share a common workspace directory structure but are isolated by session/project paths.

### Architecture

```
/var/orchestra/workspaces/
├── sessions/
│   ├── {thread_id}/           # Per-session scratch space
│   │   ├── scratch/
│   │   └── outputs/
├── projects/
│   ├── {project_id}/          # Persistent project files
│   │   ├── src/
│   │   └── data/
└── shared/
    └── readonly/              # Shared read-only assets
```

### Implementation

#### 1. New Backend Module

**File**: `backend/src/backends/__init__.py`

```python
from typing import Optional, Callable
from langchain.tools import ToolRuntime
from deepagents.backends import (
    CompositeBackend,
    StateBackend,
    StoreBackend,
    FilesystemBackend,
)

class OrchestraFilesystemBackend:
    """
    Factory for creating FilesystemBackend instances with Orchestra-specific configuration.
    """

    def __init__(
        self,
        base_path: str = "/var/orchestra/workspaces",
        virtual_mode: bool = True,
    ):
        self.base_path = base_path
        self.virtual_mode = virtual_mode

    def create_session_backend(
        self,
        thread_id: str,
        project_id: Optional[str] = None,
    ) -> FilesystemBackend:
        """Create a FilesystemBackend for a specific session."""
        if project_id:
            root_dir = f"{self.base_path}/projects/{project_id}"
        else:
            root_dir = f"{self.base_path}/sessions/{thread_id}"

        # Ensure directory exists
        import os
        os.makedirs(root_dir, exist_ok=True)

        return FilesystemBackend(
            root_dir=root_dir,
            virtual_mode=self.virtual_mode,
        )


def init_orchestra_backend(
    runtime: ToolRuntime,
    *,
    routes: dict = None,
    enable_filesystem: bool = False,
    filesystem_config: dict = None,
) -> CompositeBackend:
    """
    Factory function that creates a CompositeBackend with Orchestra routing.

    Args:
        runtime: The LangGraph ToolRuntime
        routes: Additional custom routes to add
        enable_filesystem: Whether to enable real filesystem access
        filesystem_config: Configuration for FilesystemBackend
    """
    built_routes = {}
    routes = routes or {}
    filesystem_config = filesystem_config or {}

    # Build custom routes
    for prefix, backend_or_factory in routes.items():
        if callable(backend_or_factory):
            built_routes[prefix] = backend_or_factory(runtime)
        else:
            built_routes[prefix] = backend_or_factory

    # Add filesystem backend if enabled
    if enable_filesystem:
        thread_id = runtime.context.get("thread_id")
        project_id = runtime.context.get("project_id")

        fs_factory = OrchestraFilesystemBackend(**filesystem_config)
        fs_backend = fs_factory.create_session_backend(
            thread_id=thread_id,
            project_id=project_id,
        )

        # Route /workspace/ to filesystem backend
        built_routes["/workspace/"] = fs_backend

    default_state = StateBackend(runtime)
    return CompositeBackend(default=default_state, routes=built_routes)
```

#### 2. Update Agent Initialization

**File**: `backend/src/agents/__init__.py` (modifications)

```python
from src.backends import init_orchestra_backend

def init_backend(runtime: ToolRuntime, *, routes, enable_filesystem: bool = False):
    """Factory function that creates a CompositeBackend with custom routes."""
    return init_orchestra_backend(
        runtime,
        routes=routes,
        enable_filesystem=enable_filesystem,
        filesystem_config={
            "base_path": os.getenv("ORCHESTRA_WORKSPACE_PATH", "/var/orchestra/workspaces"),
            "virtual_mode": True,
        }
    )
```

#### 3. Environment Configuration

**File**: `.env.example` (additions)

```bash
# Filesystem Backend Configuration
ORCHESTRA_WORKSPACE_PATH=/var/orchestra/workspaces
ENABLE_FILESYSTEM_BACKEND=false
```

#### 4. Docker Volume Mount

**File**: `docker-compose.yml` (additions)

```yaml
services:
  orchestra:
    volumes:
      - orchestra_workspaces:/var/orchestra/workspaces

volumes:
  orchestra_workspaces:
```

### API Changes

#### Enable Filesystem per Request

Add optional `enable_filesystem` field to agent configuration:

```python
class AgentConfig(BaseModel):
    # ... existing fields ...
    enable_filesystem: bool = False
    filesystem_root: Optional[str] = None  # Override default root
```

### Security Considerations (Phase 1)

1. **Path Sandboxing**: `virtual_mode=True` ensures all paths are normalized under `root_dir`
2. **No Symlink Traversal**: FilesystemBackend prevents following symlinks outside root
3. **Per-Session Isolation**: Each thread_id gets a separate directory
4. **Read-Only Shared Assets**: Common assets mounted read-only

### Testing Strategy

1. Unit tests for `OrchestraFilesystemBackend` factory
2. Integration tests for file CRUD operations
3. Security tests for path traversal attempts
4. Performance tests for large file operations

---

## Phase 2: Container-Isolated Filesystem Backend

### Overview

Phase 2 implements per-user container isolation using Ubuntu 24.04 containers. Each user gets their own isolated container with a dedicated filesystem backend.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Orchestra API                               │
├─────────────────────────────────────────────────────────────────┤
│                  ContainerBackendManager                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │  User A         │ │  User B         │ │  User C         │   │
│  │  Container      │ │  Container      │ │  Container      │   │
│  │  (Ubuntu 24)    │ │  (Ubuntu 24)    │ │  (Ubuntu 24)    │   │
│  │  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌───────────┐  │   │
│  │  │/workspace │  │ │  │/workspace │  │ │  │/workspace │  │   │
│  │  └───────────┘  │ │  └───────────┘  │ │  └───────────┘  │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Container Specification

**Base Image**: `ubuntu:24.04`

**File**: `docker/agent-sandbox/Dockerfile`

```dockerfile
FROM ubuntu:24.04

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    git \
    jq \
    ripgrep \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory
RUN mkdir -p /workspace && chmod 777 /workspace

# Create non-root user for security
RUN useradd -m -s /bin/bash agent && \
    chown -R agent:agent /workspace

# Install uv for Python package management
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Set working directory
WORKDIR /workspace

# Switch to non-root user
USER agent

# Expose exec-server port (optional, for remote execution)
EXPOSE 3005

# Default command (keep container running)
CMD ["tail", "-f", "/dev/null"]
```

### ContainerBackend Implementation

**File**: `backend/src/backends/container.py`

```python
import asyncio
import docker
from typing import Optional, Tuple
from dataclasses import dataclass
from deepagents.backends.base import BackendProtocol, SandboxBackendProtocol

@dataclass
class ContainerConfig:
    image: str = "orchestra/agent-sandbox:ubuntu24"
    memory_limit: str = "512m"
    cpu_limit: float = 0.5
    timeout: int = 300  # 5 minutes default
    network_mode: str = "none"  # No network by default
    workspace_path: str = "/workspace"


class ContainerBackend(SandboxBackendProtocol):
    """
    A filesystem backend backed by a Docker container.

    Implements both BackendProtocol and SandboxBackendProtocol to provide
    file operations and command execution within an isolated container.
    """

    def __init__(
        self,
        user_id: str,
        session_id: str,
        config: Optional[ContainerConfig] = None,
    ):
        self.user_id = user_id
        self.session_id = session_id
        self.config = config or ContainerConfig()
        self.client = docker.from_env()
        self.container = None
        self._container_id = None

    @property
    def container_name(self) -> str:
        return f"orchestra-sandbox-{self.user_id}-{self.session_id[:8]}"

    async def ensure_container(self) -> docker.models.containers.Container:
        """Ensure container is running, create if necessary."""
        if self.container is not None:
            try:
                self.container.reload()
                if self.container.status == "running":
                    return self.container
            except docker.errors.NotFound:
                self.container = None

        # Try to find existing container
        try:
            self.container = self.client.containers.get(self.container_name)
            if self.container.status != "running":
                self.container.start()
            return self.container
        except docker.errors.NotFound:
            pass

        # Create new container
        self.container = self.client.containers.run(
            self.config.image,
            name=self.container_name,
            detach=True,
            mem_limit=self.config.memory_limit,
            cpu_period=100000,
            cpu_quota=int(100000 * self.config.cpu_limit),
            network_mode=self.config.network_mode,
            labels={
                "orchestra.user_id": self.user_id,
                "orchestra.session_id": self.session_id,
                "orchestra.type": "agent-sandbox",
            },
        )
        return self.container

    async def _exec_in_container(
        self,
        command: str,
        timeout: int = None,
    ) -> Tuple[int, str, str]:
        """Execute a command in the container."""
        container = await self.ensure_container()
        timeout = timeout or self.config.timeout

        exec_result = container.exec_run(
            cmd=["bash", "-c", command],
            workdir=self.config.workspace_path,
            demux=True,
        )

        exit_code = exec_result.exit_code
        stdout = exec_result.output[0].decode() if exec_result.output[0] else ""
        stderr = exec_result.output[1].decode() if exec_result.output[1] else ""

        return exit_code, stdout, stderr

    # BackendProtocol Implementation

    def read(
        self,
        file_path: str,
        offset: int = 0,
        limit: int = 100,
    ) -> dict:
        """Read file content from container."""
        return asyncio.get_event_loop().run_until_complete(
            self.aread(file_path, offset, limit)
        )

    async def aread(
        self,
        file_path: str,
        offset: int = 0,
        limit: int = 100,
    ) -> dict:
        """Async read file content from container."""
        # Use sed to extract specific line range
        start_line = offset + 1
        end_line = offset + limit
        command = f"sed -n '{start_line},{end_line}p' '{file_path}' 2>/dev/null || echo ''"

        exit_code, stdout, stderr = await self._exec_in_container(command)

        if exit_code != 0:
            return {"error": stderr or f"Failed to read {file_path}", "content": None}

        return {"content": stdout, "error": None}

    def write(self, file_path: str, content: str) -> dict:
        """Write content to file in container."""
        return asyncio.get_event_loop().run_until_complete(
            self.awrite(file_path, content)
        )

    async def awrite(self, file_path: str, content: str) -> dict:
        """Async write content to file in container."""
        # Create parent directories and write file
        import base64
        encoded = base64.b64encode(content.encode()).decode()
        command = f"mkdir -p $(dirname '{file_path}') && echo '{encoded}' | base64 -d > '{file_path}'"

        exit_code, stdout, stderr = await self._exec_in_container(command)

        if exit_code != 0:
            return {"error": stderr or f"Failed to write {file_path}"}

        return {"error": None, "file_path": file_path}

    def edit(
        self,
        file_path: str,
        old_string: str,
        new_string: str,
        replace_all: bool = False,
    ) -> dict:
        """Edit file in container using string replacement."""
        return asyncio.get_event_loop().run_until_complete(
            self.aedit(file_path, old_string, new_string, replace_all)
        )

    async def aedit(
        self,
        file_path: str,
        old_string: str,
        new_string: str,
        replace_all: bool = False,
    ) -> dict:
        """Async edit file in container."""
        import base64
        old_encoded = base64.b64encode(old_string.encode()).decode()
        new_encoded = base64.b64encode(new_string.encode()).decode()

        # Use Python for reliable string replacement
        replace_flag = "" if replace_all else ", 1"
        command = f"""python3 -c "
import base64
old = base64.b64decode('{old_encoded}').decode()
new = base64.b64decode('{new_encoded}').decode()
with open('{file_path}', 'r') as f:
    content = f.read()
count = content.count(old)
if count == 0:
    print('ERROR: String not found')
    exit(1)
content = content.replace(old, new{replace_flag})
with open('{file_path}', 'w') as f:
    f.write(content)
print(f'Replaced {{count if {str(replace_all).lower()} else 1}} occurrence(s)')
"
"""
        exit_code, stdout, stderr = await self._exec_in_container(command)

        if exit_code != 0:
            return {"error": stderr or stdout or f"Failed to edit {file_path}"}

        return {"error": None, "file_path": file_path, "message": stdout.strip()}

    def ls_info(self, path: str = ".") -> dict:
        """List directory contents in container."""
        return asyncio.get_event_loop().run_until_complete(self.als_info(path))

    async def als_info(self, path: str = ".") -> dict:
        """Async list directory contents."""
        command = f"ls -la '{path}' 2>/dev/null"
        exit_code, stdout, stderr = await self._exec_in_container(command)

        if exit_code != 0:
            return {"error": stderr or f"Failed to list {path}", "entries": []}

        return {"entries": stdout, "error": None}

    def glob_info(self, pattern: str) -> dict:
        """Glob pattern matching in container."""
        return asyncio.get_event_loop().run_until_complete(self.aglob_info(pattern))

    async def aglob_info(self, pattern: str) -> dict:
        """Async glob pattern matching."""
        command = f"find . -path '{pattern}' -type f 2>/dev/null | head -100"
        exit_code, stdout, stderr = await self._exec_in_container(command)

        return {"files": stdout.strip().split('\n') if stdout.strip() else [], "error": None}

    def grep_raw(
        self,
        pattern: str,
        path: str = ".",
        **kwargs,
    ) -> dict:
        """Search for pattern in files."""
        return asyncio.get_event_loop().run_until_complete(
            self.agrep_raw(pattern, path, **kwargs)
        )

    async def agrep_raw(
        self,
        pattern: str,
        path: str = ".",
        **kwargs,
    ) -> dict:
        """Async search for pattern in files."""
        # Use ripgrep if available, fall back to grep
        command = f"rg -n '{pattern}' '{path}' 2>/dev/null || grep -rn '{pattern}' '{path}' 2>/dev/null | head -100"
        exit_code, stdout, stderr = await self._exec_in_container(command)

        return {"matches": stdout, "error": None}

    # SandboxBackendProtocol Implementation

    def execute(
        self,
        command: str,
        timeout: int = None,
        **kwargs,
    ) -> dict:
        """Execute shell command in container."""
        return asyncio.get_event_loop().run_until_complete(
            self.aexecute(command, timeout, **kwargs)
        )

    async def aexecute(
        self,
        command: str,
        timeout: int = None,
        **kwargs,
    ) -> dict:
        """Async execute shell command in container."""
        exit_code, stdout, stderr = await self._exec_in_container(command, timeout)

        output = stdout
        if stderr:
            output += f"\n[stderr]\n{stderr}" if output else stderr

        return {
            "exit_code": exit_code,
            "output": output,
            "truncated": len(output) > 10000,
            "error": None if exit_code == 0 else f"Command failed with exit code {exit_code}",
        }

    # Lifecycle Management

    async def cleanup(self):
        """Stop and remove the container."""
        if self.container:
            try:
                self.container.stop(timeout=10)
                self.container.remove()
            except docker.errors.NotFound:
                pass
            finally:
                self.container = None
```

### ContainerBackendManager

**File**: `backend/src/backends/manager.py`

```python
import asyncio
from typing import Dict, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field

from src.backends.container import ContainerBackend, ContainerConfig


@dataclass
class ContainerSession:
    backend: ContainerBackend
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_accessed: datetime = field(default_factory=datetime.utcnow)


class ContainerBackendManager:
    """
    Manages the lifecycle of container backends.

    - Creates containers on-demand for users
    - Implements container pooling and reuse
    - Handles automatic cleanup of idle containers
    - Enforces per-user container limits
    """

    def __init__(
        self,
        max_containers_per_user: int = 3,
        container_idle_timeout: int = 3600,  # 1 hour
        cleanup_interval: int = 300,  # 5 minutes
        default_config: Optional[ContainerConfig] = None,
    ):
        self.max_containers_per_user = max_containers_per_user
        self.container_idle_timeout = container_idle_timeout
        self.cleanup_interval = cleanup_interval
        self.default_config = default_config or ContainerConfig()

        # Active sessions: {user_id: {session_id: ContainerSession}}
        self._sessions: Dict[str, Dict[str, ContainerSession]] = {}
        self._cleanup_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the background cleanup task."""
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop(self):
        """Stop the manager and cleanup all containers."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        # Cleanup all containers
        for user_sessions in self._sessions.values():
            for session in user_sessions.values():
                await session.backend.cleanup()
        self._sessions.clear()

    async def get_backend(
        self,
        user_id: str,
        session_id: str,
        config: Optional[ContainerConfig] = None,
    ) -> ContainerBackend:
        """
        Get or create a container backend for the given user and session.
        """
        if user_id not in self._sessions:
            self._sessions[user_id] = {}

        user_sessions = self._sessions[user_id]

        # Return existing session
        if session_id in user_sessions:
            session = user_sessions[session_id]
            session.last_accessed = datetime.utcnow()
            return session.backend

        # Check per-user limit
        if len(user_sessions) >= self.max_containers_per_user:
            # Remove oldest session
            oldest_id = min(
                user_sessions.keys(),
                key=lambda k: user_sessions[k].last_accessed
            )
            await user_sessions[oldest_id].backend.cleanup()
            del user_sessions[oldest_id]

        # Create new container backend
        backend = ContainerBackend(
            user_id=user_id,
            session_id=session_id,
            config=config or self.default_config,
        )

        # Ensure container is running
        await backend.ensure_container()

        user_sessions[session_id] = ContainerSession(backend=backend)
        return backend

    async def release_backend(self, user_id: str, session_id: str):
        """Release a container backend (but don't immediately destroy it)."""
        if user_id in self._sessions and session_id in self._sessions[user_id]:
            self._sessions[user_id][session_id].last_accessed = datetime.utcnow()

    async def destroy_backend(self, user_id: str, session_id: str):
        """Immediately destroy a container backend."""
        if user_id in self._sessions and session_id in self._sessions[user_id]:
            await self._sessions[user_id][session_id].backend.cleanup()
            del self._sessions[user_id][session_id]

    async def _cleanup_loop(self):
        """Background task to cleanup idle containers."""
        while True:
            try:
                await asyncio.sleep(self.cleanup_interval)
                await self._cleanup_idle_containers()
            except asyncio.CancelledError:
                break
            except Exception as e:
                # Log error but continue cleanup loop
                print(f"Error in cleanup loop: {e}")

    async def _cleanup_idle_containers(self):
        """Remove containers that have been idle too long."""
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=self.container_idle_timeout)

        for user_id in list(self._sessions.keys()):
            user_sessions = self._sessions[user_id]
            for session_id in list(user_sessions.keys()):
                session = user_sessions[session_id]
                if session.last_accessed < cutoff:
                    await session.backend.cleanup()
                    del user_sessions[session_id]

            # Remove empty user entries
            if not user_sessions:
                del self._sessions[user_id]
```

### Integration with CompositeBackend

**File**: `backend/src/backends/__init__.py` (Phase 2 additions)

```python
from src.backends.container import ContainerBackend, ContainerConfig
from src.backends.manager import ContainerBackendManager

# Global container manager instance
_container_manager: Optional[ContainerBackendManager] = None


async def get_container_manager() -> ContainerBackendManager:
    """Get or create the global container manager."""
    global _container_manager
    if _container_manager is None:
        _container_manager = ContainerBackendManager()
        await _container_manager.start()
    return _container_manager


async def init_isolated_backend(
    runtime: ToolRuntime,
    *,
    routes: dict = None,
    container_config: ContainerConfig = None,
) -> CompositeBackend:
    """
    Create a CompositeBackend with per-user container isolation.

    Routes /workspace/ to an isolated container filesystem.
    """
    user_id = runtime.context.get("user_id")
    thread_id = runtime.context.get("thread_id")

    if not user_id:
        raise ValueError("user_id required for isolated backend")

    routes = routes or {}
    built_routes = {}

    # Build custom routes
    for prefix, backend_or_factory in routes.items():
        if callable(backend_or_factory):
            built_routes[prefix] = backend_or_factory(runtime)
        else:
            built_routes[prefix] = backend_or_factory

    # Get container backend for this user/session
    manager = await get_container_manager()
    container_backend = await manager.get_backend(
        user_id=user_id,
        session_id=thread_id,
        config=container_config,
    )

    # Route /workspace/ to container
    built_routes["/workspace/"] = container_backend

    # Add StoreBackend for memories
    store_backend = StoreBackend(runtime)
    built_routes[f"/users/{user_id}/memories/"] = store_backend
    built_routes[f"/users/{user_id}/config/"] = store_backend

    default_state = StateBackend(runtime)
    return CompositeBackend(default=default_state, routes=built_routes)
```

### Enabling Container Isolation

**File**: `backend/src/constants/__init__.py` (additions)

```python
# Container Backend Configuration
ENABLE_CONTAINER_ISOLATION = os.getenv("ENABLE_CONTAINER_ISOLATION", "false").lower() == "true"
CONTAINER_IMAGE = os.getenv("CONTAINER_IMAGE", "orchestra/agent-sandbox:ubuntu24")
CONTAINER_MEMORY_LIMIT = os.getenv("CONTAINER_MEMORY_LIMIT", "512m")
CONTAINER_CPU_LIMIT = float(os.getenv("CONTAINER_CPU_LIMIT", "0.5"))
CONTAINER_IDLE_TIMEOUT = int(os.getenv("CONTAINER_IDLE_TIMEOUT", "3600"))
MAX_CONTAINERS_PER_USER = int(os.getenv("MAX_CONTAINERS_PER_USER", "3"))
```

---

## Migration Path: Phase 1 to Phase 2

### Step 1: Deploy Phase 1
1. Implement `OrchestraFilesystemBackend`
2. Add workspace volume mounts
3. Test with `enable_filesystem=True` on select users

### Step 2: Build Container Infrastructure
1. Build and push `orchestra/agent-sandbox:ubuntu24` image
2. Implement `ContainerBackend` class
3. Implement `ContainerBackendManager`
4. Add container lifecycle management

### Step 3: Gradual Rollout
1. Feature flag: `ENABLE_CONTAINER_ISOLATION`
2. Start with premium/enterprise users
3. Monitor container resource usage
4. Tune limits and timeouts

### Step 4: Full Migration
1. Make container isolation the default for `/workspace/` routes
2. Deprecate shared filesystem backend
3. Document migration path for existing users

---

## API Reference

### Backend Selection in Agent Requests

```python
class AgentFilesystemConfig(BaseModel):
    enabled: bool = False
    isolated: bool = False  # Phase 2: Use container isolation
    project_id: Optional[str] = None
    network_enabled: bool = False  # Phase 2: Allow network in container


class LLMRequest(BaseModel):
    # ... existing fields ...
    filesystem: Optional[AgentFilesystemConfig] = None
```

### Workspace Tools Available

When filesystem backend is enabled, agents gain access to:

| Tool | Description |
|------|-------------|
| `ls` | List directory contents |
| `read_file` | Read file content with pagination |
| `write_file` | Write content to a file |
| `edit_file` | Replace strings in a file |
| `glob` | Find files matching pattern |
| `grep` | Search for pattern in files |
| `execute` | Run shell commands (Phase 2 only) |

---

## Security Model

### Phase 1 Security

| Control | Implementation |
|---------|----------------|
| Path Sandboxing | `virtual_mode=True` in FilesystemBackend |
| Session Isolation | Separate directories per `thread_id` |
| No Execution | Shell `execute` tool not available |
| Read-Only Assets | Shared assets mounted read-only |

### Phase 2 Security

| Control | Implementation |
|---------|----------------|
| Process Isolation | Each user gets dedicated container |
| Filesystem Isolation | Container-local `/workspace` |
| Network Isolation | `network_mode=none` by default |
| Resource Limits | Memory and CPU caps per container |
| Non-root Execution | Container runs as unprivileged user |
| Automatic Cleanup | Idle containers terminated |

---

## Monitoring & Observability

### Metrics to Track

| Metric | Description |
|--------|-------------|
| `orchestra.filesystem.operations` | Count of file operations by type |
| `orchestra.filesystem.errors` | Error count by type |
| `orchestra.containers.active` | Number of running containers |
| `orchestra.containers.created` | Container creation rate |
| `orchestra.containers.destroyed` | Container destruction rate |
| `orchestra.containers.memory_usage` | Memory usage per container |
| `orchestra.containers.cpu_usage` | CPU usage per container |

### Logging

```python
logger.info(
    "filesystem_operation",
    operation="write",
    user_id=user_id,
    session_id=session_id,
    file_path=file_path,
    success=True,
)

logger.info(
    "container_lifecycle",
    action="created",
    user_id=user_id,
    session_id=session_id,
    container_id=container_id,
)
```

---

## Timeline & Resources

### Phase 1 Deliverables

1. `OrchestraFilesystemBackend` factory class
2. Integration with `init_backend`
3. Volume mount configuration
4. Documentation and examples
5. Unit and integration tests

### Phase 2 Deliverables

1. `agent-sandbox` Docker image (Ubuntu 24.04)
2. `ContainerBackend` implementation
3. `ContainerBackendManager` with lifecycle management
4. Container resource monitoring
5. Cleanup automation
6. Security hardening and audit

---

## References

### DeepAgents Documentation
- [GitHub - langchain-ai/deepagents](https://github.com/langchain-ai/deepagents)
- [DeepAgents Backends Documentation](https://docs.langchain.com/oss/python/deepagents/backends)
- [deepagents PyPI](https://pypi.org/project/deepagents/)

### Container Isolation References
- [Docker Sandboxes](https://docs.docker.com/ai/sandboxes/)
- [Docker Blog: A New Approach for Coding Agent Safety](https://www.docker.com/blog/docker-sandboxes-a-new-approach-for-coding-agent-safety/)
- [Kubernetes Agent Sandbox](https://github.com/kubernetes-sigs/agent-sandbox)
- [Google Cloud: Agent Sandbox](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/agent-sandbox)

### Related Libraries
- [langchain-sandbox](https://pypi.org/project/langchain-sandbox/) - Pyodide-based Python sandbox
- [agent-infra/sandbox](https://github.com/agent-infra/sandbox) - All-in-One Agent Sandbox

---

## Appendix: Existing Orchestra Code References

### Current Backend Usage Locations

| File | Line | Description |
|------|------|-------------|
| `backend/src/agents/__init__.py` | 187-196 | `init_backend` function |
| `backend/src/controllers/llm.py` | 41-48 | LLM controller backend init |
| `backend/src/utils/stream.py` | 212-217 | Stream generator backend |
| `backend/src/workers/tasks.py` | 221-226 | TaskIQ worker backend |
| `backend/src/utils/middleware.py` | 139-277 | AutoEvictMiddleware uses backend |

### Existing Container Infrastructure

| Resource | Location | Description |
|----------|----------|-------------|
| exec_server | `docker-compose.yml:151-159` | Ubuntu 24 exec server container |
| Dockerfile | `docker/ubuntu/Dockerfile` | Existing Ubuntu 24.04 image |
| entrypoint | `docker/ubuntu/entrypoint.sh` | Node.js exec server startup |
