# Daytona Sandbox Execute Support

Orchestra supports [Daytona](https://www.daytona.io/) as a sandbox backend for deepagents, enabling shell command execution through the agent in invoke, stream, and worker execution paths.

## Prerequisites

### Python Package Dependencies

The following packages are required in `backend/pyproject.toml`:

| Package | Minimum Version | Purpose |
|---------|----------------|---------|
| `langchain-daytona` | `>=0.0.2` | LangChain integration providing `DaytonaSandbox` wrapper |
| `daytona` | `>=0.140.0` | Daytona SDK client (must be ≥0.140.0 for correct `daytona` import name) |

> **⚠️ Version Warning:** Older `daytona` versions (e.g., v0.18.1) use the `daytona_sdk` module name instead of `daytona`, which will cause import failures. Always pin `daytona>=0.140.0`.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DAYTONA_API_KEY` | Yes | API key for authenticating with the Daytona service |

Set this in your `.env.backend` file (typically at `~/.env/orchestra/.env.backend`):

```bash
DAYTONA_API_KEY=your-daytona-api-key-here
```

### Sandbox Configuration

Set the sandbox backend to Daytona via chat metadata:

```json
{
  "metadata": {
    "sandbox": "daytona"
  }
}
```

This metadata is read by all three execution paths (invoke, stream, worker) to determine whether to create a Daytona sandbox backend.

---

## Architecture Overview

When `sandbox.backend=daytona` is configured:

1. **Backend Creation:** `create_daytona_backend()` in `backend/src/agents/__init__.py` creates a `Daytona` client using `DaytonaConfig(api_key=DAYTONA_API_KEY)`, calls `client.create()` to provision a sandbox, and wraps it in `DaytonaSandbox(sandbox=sandbox)`.

2. **Capability Validation:** `validate_daytona_execute_capability()` in `backend/src/agents/daytona.py` checks that the backend instance exposes a callable `execute()` method, satisfying the deepagents sandbox protocol.

3. **Routing:** If validation passes, the Daytona backend is set as the `default` in a `CompositeBackend`, preserving existing `StoreBackend` routes. If validation fails, a fallback message is sent to the user and the default backend is used instead.

4. **Cleanup:** Sandbox instances are stopped in a `finally` block to prevent resource leaks.

### Execution Paths

| Path | Entry Point | Fallback Mechanism |
|------|-------------|-------------------|
| **Invoke** | `backend/src/controllers/llm.py` → `llm_invoke()` | `SystemMessage` appended to messages |
| **Stream** | `backend/src/utils/stream.py` → `stream_generator()` | SSE event with fallback text |
| **Worker** | `backend/src/workers/tasks.py` → `_execute_agent_stream()` | Redis stream message with fallback text |

### Key Source Files

| File | Purpose |
|------|---------|
| `backend/src/agents/daytona.py` | Centralized capability validation and fallback messaging |
| `backend/src/agents/__init__.py` | `create_daytona_backend()` factory function |
| `backend/src/controllers/llm.py` | Invoke path Daytona routing |
| `backend/src/utils/stream.py` | Stream path Daytona routing |
| `backend/src/workers/tasks.py` | Worker path Daytona routing |
| `backend/src/constants/__init__.py` | `DAYTONA_API_KEY` env var binding |

---

## Verification Checklist

Use this checklist to verify that Daytona execute support is working correctly.

### 1. Dependency Verification

```bash
cd backend
uv pip show langchain-daytona daytona
```

Expected: both packages installed, `langchain-daytona>=0.0.2` and `daytona>=0.140.0`.

### 2. Import Verification

```bash
cd backend
uv run python -c "from daytona import Daytona, DaytonaConfig; from langchain_daytona import DaytonaSandbox; print('OK')"
```

Expected: prints `OK` with no ImportError.

### 3. Environment Verification

```bash
cd backend
uv run python -c "from src.constants import DAYTONA_API_KEY; print('Key set' if DAYTONA_API_KEY else 'Key MISSING')"
```

Expected: prints `Key set`.

### 4. Unit Test Verification

Run all Daytona-specific tests:

```bash
cd backend

# Capability validation and fallback messaging tests
PYTHONPATH=./src:. uv run pytest backend/tests/unit/services/test_daytona_capability.py -v

# Invoke path routing tests
PYTHONPATH=./src:. uv run pytest backend/tests/unit/controllers/test_llm_invoke_backend_routing.py -v

# Worker path routing tests
PYTHONPATH=./src:. uv run pytest backend/tests/unit/workers/test_tasks.py -v

# Cross-path consistency tests
PYTHONPATH=./src:. uv run pytest backend/tests/unit/test_daytona_cross_path.py -v

# Original backend creation tests
PYTHONPATH=./src:. uv run pytest backend/tests/unit/services/test_daytona.py -v
```

Or run all tests at once:

```bash
cd backend
make test
```

### 5. Invoke Path Verification

Send a chat request with Daytona sandbox metadata:

```bash
curl -X POST http://localhost:8000/api/chat/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Run: echo hello"}],
    "metadata": {"sandbox": "daytona"}
  }'
```

Expected: If `DAYTONA_API_KEY` is set and Daytona service is reachable, the agent executes the command in a Daytona sandbox. If not, a fallback message is returned.

### 6. Stream Path Verification

```bash
curl -N http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Run: echo hello"}],
    "metadata": {"sandbox": "daytona"}
  }'
```

Expected: SSE events. If Daytona is unavailable, an SSE event containing the fallback message appears.

### 7. Worker Path Verification

Submit a task via the worker queue with `sandbox: "daytona"` in metadata. Monitor Redis stream output for either successful command execution or a fallback message.

---

## Troubleshooting

### Fallback Messages

When Daytona execute is unavailable, Orchestra sends a fallback message to the user rather than failing silently. The message format is:

> Daytona sandbox unavailable (<reason>), falling back to default sandbox.

| Fallback Reason | Cause | Fix |
|----------------|-------|-----|
| `Daytona backend could not be initialized.` | `create_daytona_backend()` returned `None` — missing API key, network error, or Daytona service down | Verify `DAYTONA_API_KEY` is set; check Daytona service connectivity |
| `Daytona backend is missing execute() support required by deepagents sandbox protocol.` | The `DaytonaSandbox` instance lacks a callable `execute()` method — likely a version mismatch | Upgrade `langchain-daytona` and `daytona` to latest versions |

### Common Issues

| Problem | Symptom | Solution |
|---------|---------|----------|
| **Wrong `daytona` version** | `ImportError: cannot import name 'Daytona' from 'daytona'` or import resolves to `daytona_sdk` | Pin `daytona>=0.140.0` in pyproject.toml; run `uv sync` |
| **Missing `langchain-daytona`** | `ImportError` on startup (silent — falls back to `None`) | Install `langchain-daytona>=0.0.2`; run `uv sync` |
| **`DAYTONA_API_KEY` not set** | Backend creation returns `None`, fallback message sent | Add key to `.env.backend` file |
| **Daytona service unreachable** | `client.create()` raises exception, backend returns `None` | Check network, Daytona service status, API key validity |
| **Sandbox not cleaned up** | Resource leak (sandbox keeps running) | Ensure code paths use `try/finally` with `sandbox.stop()` — this is already implemented |
| **Store routes missing** | State/history features broken when using Daytona | Verify `CompositeBackend` is constructed with `routes=` parameter preserving `StoreBackend` routes |

### Diagnostic Commands

```bash
# Check if Daytona packages are importable
cd backend && uv run python -c "
try:
    from daytona import Daytona, DaytonaConfig
    print('✅ daytona SDK OK')
except ImportError as e:
    print(f'❌ daytona SDK: {e}')

try:
    from langchain_daytona import DaytonaSandbox
    print('✅ langchain-daytona OK')
except ImportError as e:
    print(f'❌ langchain-daytona: {e}')
"

# Check execute capability contract
cd backend && uv run python -c "
from langchain_daytona import DaytonaSandbox
print('has execute():', hasattr(DaytonaSandbox, 'execute'))
print('execute callable:', callable(getattr(DaytonaSandbox, 'execute', None)))
"
```

---

## Known Limitations

1. **No async sandbox creation:** `create_daytona_backend()` is synchronous, which may block the event loop briefly during sandbox provisioning.
2. **Single sandbox per request:** Each invoke/stream/worker call creates and tears down a fresh sandbox. No sandbox pooling or reuse.
3. **Conditional imports:** If `daytona` or `langchain-daytona` are not installed, Daytona support is silently disabled (no startup error). Check logs or run diagnostic commands above.
4. **No stream path-specific tests for SSE format:** Cross-path tests validate routing logic but not the exact SSE wire format.
