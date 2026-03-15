# Plan: Reduce Worker and API Docker Image Sizes

## Context

The backend currently builds a **single Docker image** (~1GB+) used for both API and Worker with different entrypoints. Both images carry ~90-150MB of unnecessary dependencies:
- **Deno binary** (~40-60MB) — zero references in Python source code
- **mkdocs ecosystem** (~30-50MB) — doc tools with no runtime purpose
- **FastAPI/uvicorn** in Worker (~15-25MB) — Worker never serves HTTP
- **Frontend static files** in Worker (~5-15MB) — Worker never serves assets

## Specs Generated

Five specs written to `specs/` covering the full implementation:

| Spec | Description | Estimated Savings |
|------|-------------|-------------------|
| [001-dependency-separation](../../specs/001-dependency-separation.md) | Add `api` and `docs` optional dep groups in pyproject.toml; remove mkdocs from core | ~30-50MB both images |
| [002-shared-code-extraction](../../specs/002-shared-code-extraction.md) | Extract `REDIS_URL` to `src/constants/redis.py` to decouple API from worker imports | Enables clean separation |
| [003-multi-target-dockerfile](../../specs/003-multi-target-dockerfile.md) | Rewrite Dockerfile with `api` and `worker` build targets; remove Deno | ~90-150MB Worker, ~70-110MB API |
| [004-cicd-updates](../../specs/004-cicd-updates.md) | Update build.yml to build/push two images; update deploy script | N/A (infrastructure) |
| [005-test-benchmark-environment](../../specs/005-test-benchmark-environment.md) | docker-compose.test.yml + benchmark/test scripts + CI size reporting | N/A (validation) |

## Implementation Order

1. **Spec 001** — Quick wins: move mkdocs to `docs` extra, create `api` extra, deduplicate deps
2. **Spec 002** — Extract `REDIS_URL`, verify import chains are clean
3. **Spec 003** — Multi-target Dockerfile (depends on 001 + 002)
4. **Spec 005** — Test/benchmark environment (can run baseline before Spec 003)
5. **Spec 004** — CI/CD updates (last, after local validation)

## Key Files

- `backend/pyproject.toml` — dependency groups
- `backend/Dockerfile` — multi-target rewrite
- `backend/src/constants/redis.py` — new shared constant
- `backend/src/workers/broker.py` — import update
- `.github/workflows/build.yml` — dual image build + deploy
- `backend/scripts/build.sh` — local build script
- `docker-compose.yml` — production compose update
- `docker-compose.test.yml` — new test compose

## Verification

- `make test` passes after each spec
- `make benchmark.images` shows size reduction
- `make test.images` validates both split images work together
- Blue-green deploy works with separate API/Worker images
