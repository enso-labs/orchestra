# Runbook — US-001: Isolate Orchestra's alembic version table

**Story:** US-001 (Stage 0, Aegra Full Inversion)
**Scope:** one-time database operation + a startup-ordering decision. No alembic revision is
added by this story, and none may be.

---

## 1. Why this exists

Orchestra and Aegra each ship an alembic migration chain, and both default to the version table
`alembic_version`. Aegra runs its chain automatically on startup (taking a Postgres advisory lock
first). Point both at one database and the two chains collide inside a single table: Aegra sees
Orchestra's revision ids, cannot locate them in its own script directory, and the process fails at
boot. This is a boot failure, not a manual one — nobody gets a chance to intervene.

The fix is ownership, not coordination:

| Table | Owner |
|---|---|
| `orchestra_alembic_version` | Orchestra's chain (`backend/migrations/`) |
| `alembic_version` | Aegra's chain (upstream, unmodified) |

Aegra keeps the default because Aegra is upstream code we do not patch. Orchestra moves.

## 2. What the code change does

- `backend/migrations/env.py` — both `context.configure(...)` calls (offline and online) now pass
  `version_table=VERSION_TABLE`, where `VERSION_TABLE` defaults to `orchestra_alembic_version` and
  can be overridden with `config.set_main_option("version_table", ...)`.
- `backend/src/utils/migrations.py` — `_stamp_head_with_clear()` no longer hardcodes
  `DELETE FROM alembic_version`. It deletes from `ORCHESTRA_VERSION_TABLE`, and the `Config` it
  builds (now via `_build_alembic_config()`, shared with `run_migrations()`) carries the same
  `version_table` main option so `command.stamp` writes the correct table.

**Why that second change is the dangerous one.** `_stamp_head_with_clear()` is reached from
`run_migrations()` on the `"Can't locate revision"` branch — which is *precisely* the error a
two-chain collision produces. Left as-is, an Orchestra startup that hit a shared-database collision
would have responded by deleting Aegra's entire migration state and stamping Orchestra's head into
Aegra's table. The failure mode and the destructive handler were wired directly to each other.

Regression cover: `backend/tests/unit/utils/test_migrations.py` — verifies by rejection, asserting
that a sentinel row in `alembic_version` **survives** the call while the
`orchestra_alembic_version` row is cleared. Confirmed to fail against the pre-fix code.

## 3. The one-time rename (runbook step — NOT an alembic revision)

This must run **outside both chains**. It cannot be an alembic revision: a revision that renamed the
version table would have to be recorded in the very table it is renaming, and alembic reads that
table before it runs anything. Bootstrapping problem, no valid ordering.

Run it once per database (dev, staging, production, and any restored copy) **before** deploying the
code change and **before** Aegra ever boots against that database.

```sql
-- Preconditions: Orchestra is stopped; Aegra has never run against this database.
BEGIN;

-- Verify the starting state: Orchestra's table exists under the old name,
-- and the new name is not taken.
SELECT to_regclass('public.alembic_version')            AS old_table;   -- expect: alembic_version
SELECT to_regclass('public.orchestra_alembic_version')  AS new_table;   -- expect: NULL

ALTER TABLE alembic_version RENAME TO orchestra_alembic_version;

COMMIT;
```

Verification after the rename and after `make migrate.up`:

```sql
SELECT * FROM orchestra_alembic_version;   -- expect exactly one row: the current Orchestra head
```

Cross-check that it matches the script directory:

```bash
cd backend && make migrate.history | head -1
```

### Ordering

1. Stop Orchestra (app **and** worker — both processes can run migrations).
2. Take a dump (`pg_dump`) — this is the real rollback for anything that goes wrong past step 4.
3. Run the `ALTER TABLE` above.
4. Deploy the code change (`env.py` + `migrations.py`).
5. `cd backend && make migrate.up`, then confirm `SELECT * FROM orchestra_alembic_version`.
6. Only now may Aegra be pointed at this database; it will create its own `alembic_version`.

Skipping step 3 while deploying step 4 means alembic finds an empty/absent
`orchestra_alembic_version`, concludes the database is at base, and tries to replay every migration
from scratch against a fully-populated schema. Expect `relation already exists` failures. The
recovery is the same `ALTER TABLE` — the data is not damaged, but the deploy is down until it runs.

### Note on the local dev database (observed 2026-08-07)

The sandbox dev/test database used by `make test` was **not** renamed — the change was verified
against it without step 3. What happened there is worth recording because it is the near-miss this
runbook exists to prevent: alembic found no `orchestra_alembic_version`, concluded base, and
replayed the chain (`0000_init` → `0001`). It happened to survive because that chain is short and
its DDL tolerated the already-populated schema; the first suite run after the change did surface
`relation ... already exists` errors before the table settled at head.

Do not read that as "the rename is optional." A longer chain, or one revision with a non-idempotent
data migration, turns the same replay into corruption. Run the `ALTER TABLE` on every real database.

## 4. Rollback

```sql
-- VALID ONLY IF Aegra has never booted against this database.
ALTER TABLE orchestra_alembic_version RENAME TO alembic_version;
```

Then revert the code change (`git revert`).

**State this plainly: the inverse rename is valid only before Aegra has booted against the same
database.** Once Aegra starts, it creates and owns its own `alembic_version`. Renaming Orchestra's
table back at that point either fails outright (`relation "alembic_version" already exists`) or, if
Aegra's table were dropped first to make room, destroys Aegra's migration state. There is no safe
in-place rollback after Aegra's first boot — from that point the rollback is **restore the dump
taken in step 2**, which is why step 2 is not optional.

Everything else in this story is `git revert`-safe. The rename is the only stateful step, and it is
reversible exactly once, in a window that closes the first time Aegra starts.

## 5. Decision: should `run_migrations()` keep auto-migrating on startup?

**Recommendation: no. Move Orchestra's chain to a separate init step. Do not restructure startup in
this story.**

Today `backend/main.py` calls `run_migrations()` inside the FastAPI lifespan when
`APP_ENV in {"production", "staging"}`. Once Aegra is the host process (US-021), that lifespan is
merged into Aegra's, so Orchestra's `alembic upgrade head` would run in the *same process* that
Aegra is migrating in, under Aegra's advisory lock. Two chains auto-migrating in one process is
listed as a hazard in the PRD's Technical Considerations for good reason:

- **Lock interaction.** Aegra holds an advisory lock across its migration. Orchestra's chain does
  not participate in that protocol, so ordering between the two is undefined and depends on lifespan
  composition order — the sort of thing that changes silently on an upstream bump.
- **No safe failure.** A migration failure inside a lifespan surfaces as a failed boot with a
  partially-migrated database, at which point the `"Can't locate revision"` branch runs
  `_stamp_head_with_clear()` unattended. Even with this story's fix scoping the blast radius to
  Orchestra's own table, a *destructive* recovery path executing without a human is the wrong
  default.
- **Replica fan-out.** Every app replica races to migrate. This is tolerable today only because the
  version table serializes it; it stops being a property we control once a second chain is in play.

The version-table isolation this story adds is what makes both chains *able* to coexist. It does not
make it *correct* for both to fire automatically inside one process — that is an ordering problem,
and isolation does not solve ordering.

Target shape, to be implemented in a later story (not here):

- Run `alembic upgrade head` for Orchestra's chain as a **Docker init container** in
  `infra/docker-compose.yml` (and the equivalent deploy step in `.github/workflows/deploy-*.yml`),
  ordered before the app service starts. `make migrate.up` is already the exact command.
- Delete the `run_migrations()` call from the lifespan; leave the function in place for local/manual
  use.
- Leave Aegra's own startup migration alone — it is upstream behaviour and it is the only chain
  running in-process.

Until that lands, the behaviour is unchanged: `run_migrations()` still runs on
production/staging startup, now correctly scoped to `orchestra_alembic_version`.

## 6. Verification checklist

- [ ] `SELECT to_regclass('public.orchestra_alembic_version')` is non-null after the rename
- [ ] `make migrate.up` completes cleanly; `SELECT * FROM orchestra_alembic_version` returns the head
- [ ] `make migrate.down` completes cleanly (rolls back one revision, table still targeted correctly)
- [ ] `cd backend && make format && make lint` clean
- [ ] `cd backend && make test` green, including
      `tests/unit/utils/test_migrations.py`
- [ ] Aegra has **not** yet been pointed at this database (Stage 1 uses a separate copy — see US-003)
