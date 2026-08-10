.PHONY: dev claude build run tag seeds seeds.memory test format lint migrate.up migrate.down migrate.history migrate.revision migrate.upgrade migrate.downgrade

# Override with ENV_FILE=/path/to/file when using another backend environment.
ENV_FILE ?= $(HOME)/.config/orchestra/.env.backend
PYTHON ?= 3.12
UV_RUN = uv run --python $(PYTHON)
UVX = uvx

dev:
	$(UV_RUN) uvicorn aegra_api.main:app --reload --host 0.0.0.0 --port 8000 --log-level debug --env-file $(ENV_FILE)

dev.claude:
	$(UV_RUN) uvicorn aegra_api.main:app --reload --host 0.0.0.0 --port 8031 --log-level debug --env-file $(ENV_FILE)

build:
	bash scripts/build.sh

tag:
	bash scripts/tag.sh

seeds.user:
	$(UV_RUN) python -m seeds.user_seeder --env-file $(ENV_FILE)

seeds.memory:
	$(UV_RUN) python -m seeds.memory_seeder --env-file $(ENV_FILE)

format:
	$(UVX) ruff format

lint:
	$(UVX) ruff check

test:
	@set -a && . $(ENV_FILE) && set +a && $(UV_RUN) pytest

migrate.up:
	@test -f "$(ENV_FILE)" || { echo "Missing ENV_FILE=$(ENV_FILE)" >&2; exit 1; }
	@set -a && . "$(ENV_FILE)" && set +a && ENV_FILE=$(ENV_FILE) $(UV_RUN) python scripts/migrate.py

migrate.down:
	ENV_FILE=$(ENV_FILE) $(UV_RUN) alembic downgrade -1

migrate.history:
	ENV_FILE=$(ENV_FILE) $(UV_RUN) alembic history

migrate.revision:
	ENV_FILE=$(ENV_FILE) $(UV_RUN) alembic revision -m "description_of_changes"

migrate.upgrade:
	ENV_FILE=$(ENV_FILE) $(UV_RUN) alembic upgrade +1

migrate.downgrade:
	ENV_FILE=$(ENV_FILE) $(UV_RUN) alembic downgrade -1
