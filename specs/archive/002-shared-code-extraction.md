# Spec 002: Shared Code Extraction

## Problem

The API imports from `src.workers.broker` to get `REDIS_URL` and enqueue tasks. This creates a coupling where the API depends on worker-internal modules. Additionally, the Worker copies API-only files (routes, frontend static assets) into its image unnecessarily.

## Changes

### 1. Extract `REDIS_URL` to `src/constants/redis.py`

Currently `REDIS_URL` is defined in `src/workers/broker.py` and imported by:
- `src/services/abort.py`
- `src/utils/stream.py`
- `main.py` (via `src.workers.broker`)

Create `src/constants/redis.py`:
```python
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
```

Update all importers to use `from src.constants.redis import REDIS_URL` instead of importing from `src.workers.broker`.

### 2. Audit import chains

Verify that after this change:
- The Worker does not transitively import `fastapi` or `uvicorn`
- The API does not transitively import `taskiq` worker lifecycle code (only the task reference for `.kiq()`)

### 3. Exclude API-only files from Worker image

Files the Worker never needs (handled in Dockerfile spec, but enumerated here):
- `src/routes/` — FastAPI route definitions
- `src/public/` — Frontend static build output
- `main.py` — FastAPI app entrypoint (Worker uses `src.workers.tasks:broker`)

## Files Modified

- `backend/src/constants/redis.py` (new)
- `backend/src/workers/broker.py` (remove `REDIS_URL` definition, import from constants)
- `backend/src/services/abort.py` (update import)
- `backend/src/utils/stream.py` (update import)
- `backend/main.py` (update import if applicable)

## Verification

```bash
# Verify no circular imports
python -c "from src.constants.redis import REDIS_URL; print(REDIS_URL)"
python -c "from src.workers.broker import broker; print('broker OK')"

# Run full test suite
make test
```
