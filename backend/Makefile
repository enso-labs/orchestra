.PHONY: dev build run tag seeds test format

dev:
	uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000 --log-level debug --env-file .env

build:
	bash scripts/build.sh

tag:
	bash scripts/tag.sh

seeds.user:
	python -m seeds.user_seeder

format:
	uvx ruff format

test:
	uv run pytest
