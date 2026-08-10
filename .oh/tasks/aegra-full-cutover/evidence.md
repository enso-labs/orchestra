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
| Static cutover scan | `python3 backend/scripts/cutover_static_scan.py` — PASS | 844 tracked/non-ignored files plus built assets; historical-document allowlist is only `Changelog.md`, `.oh/tasks/**`, and `evals/**`; the scanner source itself is separately exempt so it can contain the forbidden patterns.
| Browser discovery | `npx playwright test --list` — PASS | 6 blocking tests across desktop/mobile: run error, duplicate-run, and resumable reconnect contracts.

## Test replacement evidence

- Deleted worker-loss, heartbeat/drain, DLQ/replay, distributed-stream, legacy stream-parser, and obsolete prompt-optimizer tests; removed the stale prompt-generation UI/service affordance as well.
- Added deterministic SDK duplicate-submit and late run-acknowledgement cancellation unit contracts, plus a Playwright duplicate-run contract with mocked Agent Protocol resources.
- Added a Playwright resumable-stream contract using a local resettable HTTP fixture; it asserts the SDK sends `Last-Event-ID` on continuation, while production runs use `onDisconnect: "continue"` and explicit SDK cancellation.
- Kept the run-error/correlation browser contract and existing SDK cancellation/error unit contracts.
- Removed the only Vitest `describe.skip` and the mobile-only Playwright `test.skip`; browser discovery reports no skipped tests.

## Correlated CI

Run `31357043260` for commit `9b5ccbb4` completed successfully:

| Check | Result | Evidence |
|---|---|---|
| `test-backend` | PASS, 2m25s | [job 93358560756](https://github.com/mifunedev/orchestra/actions/runs/31357043260/job/93358560756) |
| `test-frontend` | PASS, 54s | [job 93358560727](https://github.com/mifunedev/orchestra/actions/runs/31357043260/job/93358560727) |
| `test-e2e` | PASS, 4m11s | [job 93358560654](https://github.com/mifunedev/orchestra/actions/runs/31357043260/job/93358560654) |
| CodeRabbit | skipped review, 217 files exceed its 100-file limit | PR check output |

## `/audit pr` reviewer classification

Invocation:

```text
/audit pr 977 --repo mifunedev/orchestra --base development --dry-run
```

Native result: **PR-AUDIT-PROMOTABLE** (`AUDIT-EVIDENCE: PR-AUDIT-PROMOTABLE`). Run ID: `audit-20260810T050051Z-2993237`; audit exit status `0`.

The read-only classifier acquired the remote #977 envelope successfully: CI `PASS`, `mergeable=MERGEABLE`, `mergeStateStatus=CLEAN`, no blocking review decision, `promotable=true`, and `evidenceComplete=true`. The PR is not a draft, so `readyForReview=false`; it is eligible to merge once the human review gate is satisfied (`readyToMerge=true`). The only flag is non-blocking `size-convention` for 221 changed files. The branch title follows the required `FROM task/976-aegra-full-inversion TO development` convention. No proof comment, ready/merge action, or repository write was performed by the audit route. This classification is remote PR state; it is not a claim that the route reviewed diff correctness.

## Merge reconciliation

- Fetched `origin/development` at `2c7ccd28` and merged it into the feature branch as `68101ccd`.
- Resolved the four documentation/template conflicts while preserving the Aegra-only runtime contract; rewrote the inherited environment guide so it does not reintroduce removed worker-era settings.
- `python3 backend/scripts/cutover_static_scan.py` — PASS after reconciliation.

## Follow-up: Luna max default

- `POSTGRES_CONNECTION_STRING=... APP_SECRET_KEY=dummy JWT_SECRET_KEY=dummy OPENAI_API_KEY=dummy PYTHONPATH=.:src .venv/bin/python -c '...'` — PASS; application defaults resolve to `openai:gpt-5.6-luna` and `max` reasoning effort.
- Focused backend suite (`tests/unit/test_aegra_factory.py` and `tests/unit/utils/test_reasoning.py`) — **30 passed**.
- Ruff check/format and Python compile checks on changed backend files — PASS.
- Explicit model/reasoning settings remain authoritative; the new fallback applies only when unset. No story `passes` value was changed.

## Intentionally unrun local gates

No local PostgreSQL administration/content-digest/restore check, live Aegra HTTP startup, MCP-over-HTTP check, or local browser execution was run. The CI workflow did execute the blocking backend/frontend/browser checks in its configured service environment, and all three required jobs passed. No destructive database operation or secret read occurred.
