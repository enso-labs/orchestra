.PHONY: dev claude build run tag seeds test format

dev:
	uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000 --log-level debug --env-file ~/.env/orchestra/.env.backend

dev.worker:
	@set -a && . ~/.env/orchestra/.env.backend && set +a && uv run taskiq worker src.workers.tasks:broker

claude:
	uv run uvicorn main:app --reload --host 0.0.0.0 --port 8031 --log-level debug --env-file ~/secrets/.env.orchestra.backend

build:
	bash scripts/build.sh

tag:
	bash scripts/tag.sh

seeds.user:
	uv run python -m seeds.user_seeder --env-file ~/.env/orchestra/.env.backend

format:
	uvx ruff format

test:
	@set -a && . ~/.env/orchestra/.env.backend && set +a && uv run pytest

migrate.up:
	ENV_FILE=~/.env/orchestra/.env.backend uv run alembic upgrade head

migrate.down:
	ENV_FILE=~/.env/orchestra/.env.backend uv run alembic downgrade -1

migrate.history:
	ENV_FILE=~/.env/orchestra/.env.backend uv run alembic history

migrate.revision:
	ENV_FILE=~/.env/orchestra/.env.backend uv run alembic revision -m "description_of_changes"

migrate.upgrade:
	ENV_FILE=~/.env/orchestra/.env.backend uv run alembic upgrade +1

migrate.downgrade:
	ENV_FILE=~/.env/orchestra/.env.backend uv run alembic downgrade -1