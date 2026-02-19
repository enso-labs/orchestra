.PHONY: dev local claude build run tag seeds seeds.memory test format lint

ENV_FILE ?= $(HOME)/.env/orchestra/.env.backend

dev:
	uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000 --log-level debug --env-file $(ENV_FILE)

local:
	uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000 --log-level debug --env-file $(HOME)/.env/orchestra/.env.backend.local

dev.worker:
	@set -a && . $(ENV_FILE) && set +a && uv run taskiq worker src.workers.tasks:broker --reload --reload-dir ./

dev.claude:
	uv run uvicorn main:app --reload --host 0.0.0.0 --port 8031 --log-level debug --env-file $(ENV_FILE)

build:
	bash scripts/build.sh

tag:
	bash scripts/tag.sh

seeds.user:
	uv run python -m seeds.user_seeder --env-file $(ENV_FILE)

seeds.memory:
	uv run python -m seeds.memory_seeder --env-file $(ENV_FILE)

format:
	uvx ruff format

lint:
	uvx ruff check

test:
	@set -a && . $(ENV_FILE) && set +a && uv run pytest

migrate.up:
	@set -a && . $(ENV_FILE) && uv run alembic upgrade head

migrate.down:
	@set -a && . $(ENV_FILE) uv run alembic downgrade -1

migrate.history:
	@set -a && . $(ENV_FILE) uv run alembic history

migrate.revision:
	@set -a && . $(ENV_FILE) uv run alembic revision -m "description_of_changes"

migrate.upgrade:
	@set -a && . $(ENV_FILE) uv run alembic upgrade +1

migrate.downgrade:
	@set -a && . $(ENV_FILE) uv run alembic downgrade -1