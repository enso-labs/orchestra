# Orchestra backend

The backend is a single Aegra API runtime. It serves Agent Protocol routes at
the root and Orchestra-specific routes under `/api` on port `8000`.

## Local development

```bash
cd backend
uv venv --python 3.12
source .venv/bin/activate
uv sync --python 3.12
make migrate.up
make dev
```

The runtime reads `~/.config/orchestra/.env.backend` by default. Use
`ENV_FILE=/path/to/file` for Make targets or `ORCHESTRA_ENV_FILE=/path/to/file`
with Compose. Do not commit environment files or their contents.

`make dev` starts `aegra_api.main:app`; there is no second API process. The
production graph, auth adapter, and custom app are configured by `aegra.json`.
The ordered `scripts/migrate.py` init must complete before the API starts.

## Commands

| Command | Purpose |
| --- | --- |
| `make dev` | Start Aegra on `:8000` |
| `make format` | Format Python with Ruff |
| `make lint` | Run Ruff checks |
| `make test` | Run the backend suite |
| `make migrate.up` | Run the ordered migration/preflight |
| `make migrate.history` | Show Orchestra migration history |

## Deferred capabilities

Scheduled execution, schedule mutation, prompt/trajectory distillation, and
trajectory extraction are intentionally unavailable after the Aegra cutover.
Their API entry points return `501` with `code: unsupported_capability`, perform
no storage mutation, and do not create background work. Aegra-native jobs and
trajectory support are a follow-up; see [`../docs/schedules/index.md`](../docs/schedules/index.md).

## Layout

- `aegra.json` — production graph/auth/custom-app registration
- `custom_app.py` — retained `/api`, MCP, and explicit static routes
- `src/agents/factory.py` — production graph factory
- `src/routes/` — retained custom routes plus deferred-capability responses
- `scripts/migrate.py` — ordered migration and database identity preflight
- `tests/` — unit/integration contracts for the single runtime
