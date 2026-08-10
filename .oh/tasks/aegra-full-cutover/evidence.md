# Reviewer evidence — Aegra full cutover

This file records the verification performed for US-009 before US-008 and US-010. It does not change any PRD story status; every `passes` value in `prd.json` remains `false`.

## Local gates

| Gate | Command/result | Notes |
|---|---|---|
| Backend compile | `uv run python -m compileall -q src scripts migrations main.py` — PASS | Python 3.12 via `uv`.
| Backend lint | `uv run ruff check` — PASS | Ruff is pinned in the backend dev dependency group.
| Backend formatting | `uv run ruff format --check` — PASS | 233 files already formatted.
| Backend lock | `uv lock --check` — PASS | 274 packages resolved.
| Deferred/cutover focused tests | `uv run pytest -q ...` — **55 passed** | Covers unsupported 501 responses/no side effects, route/import boundary, health JSON smoke, factory/auth/mapping, store singleton, prompt behavior, and cache test double.
| Backend collection | `POSTGRES_CONNECTION_STRING=... PYTHONPATH=.:src uv run pytest --collect-only -q` — **623 collected** | Collection is clean after replacing the removed prompt-optimization test and removing the obsolete resiliency package.
| Full backend attempt | `uv run pytest -rs` — **590 passed, 1 skipped, 32 errors** | All 32 errors require the intentionally unavailable local PostgreSQL service; each failed at the existing `test_engine`/database setup with connection refused. No database was started, migrated, renamed, restored, or modified.
| Frontend tests | `npm test` — **461 passed** | No skipped tests; includes the late run-acknowledgement cancellation contract.
| Frontend typecheck/build | `npm run build` — PASS | Includes `tsc -b` and Vite production output to `backend/src/public`; only existing large-chunk warnings were emitted.
| Frontend lint | `npm run lint` — PASS | 0 errors; 3 existing unused-eslint-disable warnings.
| Frontend formatting | `npx prettier --check` on changed frontend/config/e2e files — PASS | Includes the new resumable/idempotency browser specs.
| Static cutover scan | `python3 backend/scripts/cutover_static_scan.py` — PASS | 842 tracked/non-ignored files plus built assets; historical-document allowlist is only `Changelog.md`, `.oh/tasks/**`, and `evals/**`; the scanner source itself is separately exempt so it can contain the forbidden patterns.
| Browser discovery | `npx playwright test --list` — PASS | 6 blocking tests across desktop/mobile: run error, duplicate-run, and resumable reconnect contracts.

## Test replacement evidence

- Deleted worker-loss, heartbeat/drain, DLQ/replay, distributed-stream, legacy stream-parser, and obsolete prompt-optimizer tests; removed the stale prompt-generation UI/service affordance as well.
- Added deterministic SDK duplicate-submit and late run-acknowledgement cancellation unit contracts, plus a Playwright duplicate-run contract with mocked Agent Protocol resources.
- Added a Playwright resumable-stream contract using a local resettable HTTP fixture; it asserts the SDK sends `Last-Event-ID` on continuation, while production runs use `onDisconnect: "continue"` and explicit SDK cancellation.
- Kept the run-error/correlation browser contract and existing SDK cancellation/error unit contracts.
- Removed the only Vitest `describe.skip` and the mobile-only Playwright `test.skip`; browser discovery reports no skipped tests.

## `/audit pr` reviewer classification

Invocation:

```text
/audit pr 977 --repo mifunedev/orchestra --base development --dry-run
```

Native result: **PR-AUDIT-PROMOTABLE** (`AUDIT-EVIDENCE: PR-AUDIT-PROMOTABLE`). Run ID: `audit-20260810T015448Z-2641419`.

The read-only classifier acquired the remote #977 envelope successfully: CI `PASS`, mergeable `MERGEABLE`, state `CLEAN`, no blocking review decision, `promotable=true`, and `evidenceComplete=true`. No proof comment, ready/merge action, or repository write was performed. This classification is remote PR state; it is not a claim that the current unpushed worktree diff was reviewed for correctness (the route explicitly excludes diff correctness).

## Intentionally unrun gates

Per the task constraint, no live browser execution, live Aegra HTTP startup, PostgreSQL migration/content-digest/restore check, MCP-over-HTTP check, or destructive database operation was run. The blocking CI workflow now runs those gates in the configured service environment; no local evidence claims those behaviors.
