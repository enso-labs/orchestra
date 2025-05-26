
dev:
	make docs
	uvicorn main:app --reload --host 0.0.0.0 --port 8000 --log-level debug --env-file .env

docs:
	bash scripts/docs.sh

build:
	bash scripts/build.sh

run:
	bash scripts/run.sh

tag:
	bash scripts/tag.sh