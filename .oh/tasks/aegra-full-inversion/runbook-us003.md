# Runbook — single Aegra runtime and ordered migration preflight

This runbook replaces the temporary `:2026` sidecar procedure. The production
image is the backend image and serves Aegra plus Orchestra custom routes on
container port `8000`. The short-lived `migrate` init command must complete
before the API container starts.

The application task does not have authority to dump, restore, rename, drop,
or recreate an operator database. Those steps are listed for the operator and
must be executed against a fresh non-production copy before production
cutover. No restore or live database evidence is claimed by this task.

## 1. Configure one database target

Provide both variables and make them identify the same existing database. Do
not put credentials in task artifacts:

```dotenv
POSTGRES_CONNECTION_STRING=postgresql://<user>:<password>@<host>:5432/<database>
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
MIGRATION_DATABASE_NAME=<database>
```

`MIGRATION_DATABASE_NAME` is optional in the code, but production should set it
so a deployment pointed at the wrong database fails before any migration. The
init compares host, port, database, and user from both URLs, verifies
`current_database()`, and never logs either URL.

## 2. Operator-owned one-time version-table rename

For a database created by the pre-cutover Orchestra chain, an operator must
first take a dump and, on the restored copy, run:

```sql
ALTER TABLE alembic_version RENAME TO orchestra_alembic_version;
```

This is deliberately not an Alembic revision. Before Aegra has booted against
the same database and created its own `alembic_version`, the rollback is:

```sql
ALTER TABLE orchestra_alembic_version RENAME TO alembic_version;
```

After Aegra has created its table, that inverse is unsafe because it collides
with Aegra's migration ownership. Stop and restore the dump instead. The init
refuses the ambiguous layout where `alembic_version` exists without
`orchestra_alembic_version`; it does not guess or rename it.

## 3. Fresh-copy restore rehearsal (operator-only)

Before exercising a restored copy, the operator should take a fresh dump from
the selected source and restore it to an explicitly named copy. The copy name
must come from the operator environment; it is not hardcoded by this repo.
Capture stable keys and content digests for `checkpoints`, `store`, and
`store_vectors` before starting the image. Do not reuse a copy after testing:
it has drifted and must be restored again for a later rehearsal or release.

A restore rehearsal and the production pre-deploy dump are blockers outside
this task. Record the command, target, timestamp, and digest diff in the task
artifacts without including credentials or database data.

## 4. Run the ordered init

Compose builds one backend/Aegra image. The `migrate` service runs
`backend/scripts/migrate.py` and the API has
`depends_on: migrate: condition: service_completed_successfully`.

The init sequence is:

1. Verify both configured URLs and `current_database()` identify the expected
   target.
2. Reject ambiguous/unknown version-table ownership.
3. Run Orchestra Alembic `upgrade head` using
   `orchestra_alembic_version`.
4. Run the pinned Aegra `0.9.25` Alembic `upgrade head` using
   `alembic_version`.
5. Initialize LangGraph checkpoint/store migrations, including vector tables.
6. Compare pre-existing table fingerprints, verify all required tables, and
   verify both version tables are at their respective heads.

Run locally only against a database you are authorized to modify:

```bash
make dev.docker.migrate
# or from backend with the configured env file:
cd backend
make migrate.up
```

The command performs migrations and table setup only. It does not create a
PostgreSQL database, restore a dump, rename a version table, or administer
roles/extensions beyond the standard LangGraph setup required by its configured
store index.

## 5. Start and verify the single API

After init succeeds:

```bash
make dev.docker.up
curl --fail http://localhost:8000/health       # Aegra health JSON
curl --fail http://localhost:8000/api/info/health # retained Orchestra health
curl --fail http://localhost:8000/chat         # built SPA entry point
curl --fail http://localhost:8000/assets/<known-asset>
```

`backend/aegra.json` is copied to `/app/aegra.json` and contains only:

- graph: `./src/agents/factory.py:build_graph` under the `orchestra` id;
- auth: `./aegra_auth.py:auth`;
- custom app: `./custom_app.py:app`.

The custom app has explicit `/api`, `/mcp`, `/assets`, `/icons`, `/embed`, and
`/chat` routes. It intentionally has no `/{filename:path}` SPA catch-all,
which would shadow Agent Protocol GET routes when Aegra appends its routers.
Frontend CI builds `frontend` into `backend/src/public` before the image build;
the Dockerfile retains source modules and static assets because Aegra loads
factory/auth/app paths by filename.

## 6. Rollback

Before Aegra has started against a shared database, code/deployment rollback is
`git revert` plus rerunning the ordered init on the known target. Once Aegra's
migration chain has changed a shared database, rollback additionally requires
restoring the fresh operator dump and then reverting the deployment. Do not
attempt the version-table inverse after Aegra owns `alembic_version`.

## Evidence status

- Source/config/Compose/Docker/CI/VM syntax and focused contract checks are
  recorded in `.oh/tasks/aegra-full-cutover/progress.txt`.
- The pre-cleanup SHA-256 manifest and dispositions are in
  `.oh/tasks/aegra-full-cutover/deployment-manifest.md`.
- No live PostgreSQL, Docker startup, database restore, Aegra HTTP, browser,
  or content-digest run was performed in the sandbox; those remain explicit
  operator/runtime blockers rather than inferred passes.
