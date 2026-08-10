# Orchestra single-runtime deployment

`infra/docker-compose.yml` is the only development and deployment topology.
It starts one Aegra API on `:8000`, one ordered migration/preflight init, and
the supporting Postgres, Redis, MinIO, Ollama, and SearXNG services.

## Quick start

Create `~/.config/orchestra/.env.backend` from `backend/.example.env`, set both
Postgres URLs to the same existing database, then run:

```bash
make dev.docker.up
# or: docker compose -f infra/docker-compose.yml up --build -d
```

The `migrate` service runs `backend/scripts/migrate.py` before `app`. It verifies
database identity, migration-table ownership, required LangGraph tables, and
content fingerprints. It does not create, restore, or rename a database.

Useful commands:

```bash
make dev.docker.logs
make dev.docker.ps
make dev.docker.migrate
make dev.docker.test.up
make dev.docker.down
```

## Service inventory

| Service | Port | Role |
| --- | ---: | --- |
| `app` | 8000 | Single Aegra API and custom `/api` routes |
| `migrate` | — | Ordered migration/preflight init |
| `postgres` | 5432 | PostgreSQL with pgvector |
| `redis` | 6379 | Aegra event broker and application cache |
| `minio` | 9000/9001 | S3-compatible file storage |
| `ollama` | 11434 | Optional local inference |
| `search_engine` | 8080 | SearXNG |

The image command is `aegra_api.main:app` and the image contains
`/app/aegra.json`. Agent Protocol routes stay at the origin root; Orchestra
custom routes remain below `/api`; explicit `/chat` and asset routes are mounted
after those protocol routes without a SPA catch-all.

## Configuration

Required database settings:

```dotenv
POSTGRES_CONNECTION_STRING=postgresql://...
DATABASE_URL=postgresql://...
MIGRATION_DATABASE_NAME=...
```

`AEGRA_CONFIG` defaults to `/app/aegra.json` in the image and
`RUN_MIGRATIONS_ON_STARTUP=false`; the init service owns migrations. `REDIS_URL`
and `REDIS_BROKER_ENABLED` configure Aegra's event broker. Keep secrets in the
operator environment, never in this repository.

## Deferred capabilities

Scheduled execution, schedule mutation, prompt/trajectory distillation, and
trajectory extraction return an explicit `501` unsupported response and have no
side effects. Aegra-native jobs and trajectory support are planned as a
follow-up; see [`../docs/schedules/index.md`](../docs/schedules/index.md).
