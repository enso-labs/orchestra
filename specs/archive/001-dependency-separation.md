# Spec 001: Dependency Separation

## Problem

All 66 Python dependencies are installed in a single flat list in `pyproject.toml`. Both the API and Worker images install the full set, including packages each never uses:
- **Worker** ships with `fastapi`, `uvicorn`, `slowapi`, `fastapi-cache2`, `fastmcp`, `python-multipart` (~15-25MB with transitive deps)
- **Both** ship with `mkdocs`, `mkdocs-material`, `mkdocstrings` (~30-50MB) — documentation tools that have no runtime purpose
- **Both** ship with Deno binary (~40-60MB) — confirmed unused by any Python source code

## Changes

### 1. Add optional dependency groups to `backend/pyproject.toml`

**Move API-only deps to `[project.optional-dependencies] api`:**
```toml
[project.optional-dependencies]
api = [
    "fastapi>=0.116.1",
    "uvicorn>=0.35.0",
    "slowapi>=0.1.9",
    "fastapi-cache2>=0.2.2",
    "fastmcp>=2.14.1",
    "python-multipart>=0.0.20",
]
```

**Remove mkdocs entirely** — docs consolidated on Docusaurus wiki (`wiki/`), mkdocs has zero references in codebase.

**Remove these packages from the core `dependencies` list.**

**Keep `taskiq` and `taskiq-redis` in core** — the API imports `src.workers.broker` to enqueue tasks, so both sides need the taskiq client. They are small packages (~200KB combined).

### 2. Remove duplicate entries in `pyproject.toml`

Currently `langchain-daytona>=0.0.2` and `daytona>=0.140.0` appear twice (lines 16+18 and 23+25). Deduplicate.

### 3. Update `uv.lock`

Run `uv lock` after modifying `pyproject.toml` to regenerate the lockfile.

## Install Commands

| Target  | Command |
|---------|---------|
| API     | `uv sync --frozen --no-cache --no-dev --extra api` |
| Worker  | `uv sync --frozen --no-cache --no-dev` |
| Dev     | `uv sync --frozen --dev --extra api` |

## Files Modified

- `backend/pyproject.toml`
- `backend/uv.lock` (regenerated)

## Estimated Savings

- Worker image: **~15-25MB** (no FastAPI/uvicorn and transitive deps)
- Both images: **~30-50MB** (no mkdocs ecosystem)

## Verification

```bash
# Verify worker deps don't include fastapi
uv sync --frozen --no-cache --no-dev
python -c "import taskiq; print('taskiq OK')"
python -c "import fastapi" 2>&1 | grep ModuleNotFoundError && echo "fastapi correctly excluded"

# Verify API deps include everything
uv sync --frozen --no-cache --no-dev --extra api
python -c "import fastapi; print('fastapi OK')"
python -c "import taskiq; print('taskiq OK')"

# Run tests
make test
```
