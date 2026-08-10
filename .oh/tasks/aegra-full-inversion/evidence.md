# Evidence — #976 / PR #977 (stages 0–1)

Observed commands and real output only. Where something was not verified, it says
so rather than implying coverage.

## US-001 — alembic version table isolation

### The defect the story exists to prevent

`backend/src/utils/migrations.py:22` (pre-fix) hardcoded:

```python
conn.execute(text("DELETE FROM alembic_version"))
```

After the rename, `alembic_version` is the table **Aegra's** chain owns. That
line is reached from `run_migrations()`'s `"Can't locate revision"` branch —
which is exactly what a two-chain collision produces — so the pre-fix code would
delete Aegra's migration state and then stamp Orchestra's head.

Surfaced by CodeRabbit on PR #977; confirmed by reading the file.

### Test verified by rejection

A test asserting exit 0 would pin nothing. This one seeds both tables and
asserts the Aegra sentinel survives.

**Pre-fix** (`migrations.py` reverted, test unchanged):

```
tests/unit/utils/test_migrations.py::test_stamp_head_with_clear_spares_aegras_version_table FAILED
tests/unit/utils/test_migrations.py::test_stamp_head_with_clear_config_carries_orchestra_version_table FAILED
E       AssertionError: assert ['orchestra_stale'] == []
E       AssertionError: assert None == 'orchestra_alembic_version'
2 failed, 4 warnings in 1.07s
```

**Post-fix:** `2 passed, 4 warnings in 0.62s`

### Suite

```
2 failed, 830 passed, 2 skipped, 11 deselected, 11 warnings in 42.32s
FAILED tests/integration/test_default_system_prompt_runtime.py::test_stream_uses_file_backed_default_prompt_without_touching_langsmith
FAILED tests/integration/test_default_system_prompt_runtime.py::test_stream_uses_langsmith_prompt_only_when_source_is_langsmith
```

Both are `assert 202 == 200` — the sandbox has `DISTRIBUTED_WORKERS` on, so
`/api/llm/stream` enqueues instead of streaming inline.

**Confirmed pre-existing, not taken on trust.** The working tree was stashed
(`git stash push --include-untracked backend/`) and the suite re-run on a clean
tree: the same two tests failed, identically. Restored afterward.

```
make format   ->  2 files reformatted, 263 files left unchanged
make lint     ->  All checks passed!
```

### Hardening added after review

Two findings from the adversarial pass, both fixed in this PR:

1. **Misordered rename → crash-loop with a misleading error.** If the code
   deploys before the `ALTER TABLE`, alembic finds no `orchestra_alembic_version`,
   treats the database as unversioned, and replays `0000_init` — whose
   `op.create_table("users", ...)` has no `IF NOT EXISTS`. The result is a
   `DuplicateTable`, which names nothing about the real cause, and it escapes the
   `"Can't locate revision"` branch entirely into the generic re-raise, aborting
   FastAPI's lifespan. `run_migrations()` now detects the pre-rename layout
   (`alembic_version` present, `orchestra_alembic_version` absent) and logs the
   actual cause and the exact remedy before re-raising.

   This was not theoretical — it was observed during implementation as
   `relation "users" already exists` when migrations ran against a database where
   the rename had not been applied.

2. **`Config("alembic.ini")` was cwd-relative.** Every documented caller happens
   to run from `backend/`, so it was not broken, but a script invoked from the
   repo root would silently resolve nothing. Now resolved via
   `Path(__file__).resolve().parents[2]`. Verified:

   ```
   resolves to: .../orchestra-976/backend/alembic.ini | exists: True
   ```

### Not verified

- The `ALTER TABLE` rename has **not** been run against any real database. No
  agent-side execution touched production data.
- CI cannot exercise the misordered-rename path: `.github/workflows/test.yml`
  creates a fresh Postgres service per run, which has no `alembic_version` to
  rename. **CI passing does not validate finding 1.** The stale-volume path is
  operator-verified only, per `runbook-us001.md`.

## US-002 — issue triage

#974 and #959 both commented and closed as superseded (`not planned`), citing
that `services/schedule.py` is deleted in US-024 and that Aegra provides cron
natively.

**Evidence for "the five frontend issues touch no file in the deletion list"** —
file references extracted from each issue body, rather than asserted:

| Issue | Files implicated | Intersects deletion list? |
|---|---|---|
| #971 | (none cited in body; sonner toast ids) | No |
| #970 | `frontend/src/styles/globals.css`, `frontend/src/tests/styles/destructive-contrast.test.ts` | No |
| #969 | `frontend/src/styles/globals.css`, `frontend/src/tests/styles/destructive-contrast.test.ts` | No |
| #967 | (none cited in body; `next-themes` removal) | No |
| #960 | `components/inputs/ChatInput.tsx`, `components/lists/SelectModel.tsx`, `components/ui/sonner.tsx`, `hooks/useModel.tsx`, `hooks/useModelVisibility.ts`, `lib/utils/apiClient.ts` | No |

Deletion list for comparison: `streamSource.ts`, `fetchStreamReader.ts`,
`streamError.ts`, `activeStreamRecovery.ts`, `serverService.ts`,
`distributedStream.test.ts`, and `initiateStream` in `threadService.ts`.

Empty intersection. #960 is the closest — it touches `apiClient.ts`, which is
adjacent to the transport layer but is **not** on the deletion list.

Caveat: #971 and #967 cite no file paths in their bodies, so their rows are
inferred from the issue titles, not extracted. **SUSPECTED, not confirmed.**

## US-003 — sidecar

Files only. **Nothing was executed**: this sandbox has no Docker socket and no
`psql` binary, so the copy database was not created, the container was not built
or started, and `GET :2026/health` was never called.

Delivered: `infra/docker-compose.aegra.yml` (additive — `infra/docker-compose.yml`
is untouched), `infra/aegra.Dockerfile` pinned to `aegra-api==0.9.25`,
`aegra.json`, `infra/aegra/hello_graph.py`, `make dev.aegra.{up,down,logs}`, and
`runbook-us003.md`.

`aegra.json` `store.index` was matched against source, not by eye:
`DEFAULT_EMBED = "openai:text-embedding-3-small"` and
`DEFAULT_FIELDS = ["page_content", "metadata"]` at `backend/src/services/db.py:82-83`;
`dims: int = 1536` at `:105` and `:216`. A mismatch here degrades semantic search
silently rather than erroring, which is why it is pinned rather than assumed.

**US-003's acceptance criteria are therefore NOT met by this PR** — they are
operator-executed via the runbook.

## Live stack

Untouched throughout; the operator's dev stack was restarted once at their
request to pick up the renamed database, and verified after:

```
/api/info/health                   200
/api/info/health/db                200
/api/info/health/store             200
/api/info/health/checkpointer      200
```
