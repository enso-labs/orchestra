.PHONY: setup tag changelog dev.docker.up dev.docker.down dev.docker.logs dev.docker.ps dev.docker.migrate dev.docker.test.up dev.docker.test.down benchmark.images test.images

ENV ?= dev
COMPOSE = docker compose -f infra/docker-compose.yml
COMPOSE_TEST = docker compose -f infra/docker-compose.yml -f infra/docker-compose.test.yml
DOCKER_DEV_LOG_SERVICES ?= app worker

# Install pre-commit hooks
setup:
	pre-commit install

# Add a changelog entry for the current branch (YYYY.M.D[-N] format)
changelog:
	@YEAR=$$(date -u +%Y) && MONTH=$$(date -u +%-m) && DAY=$$(date -u +%-d) && \
	TODAY="$${YEAR}.$${MONTH}.$${DAY}" && \
	BRANCH=$$(git rev-parse --abbrev-ref HEAD) && \
	EXISTING=$$(grep -cP "^## $${TODAY}($$|-)" Changelog.md 2>/dev/null || echo "0") && \
	if [ "$$EXISTING" -eq 0 ]; then VERSION="$${TODAY}"; \
	else \
		MAX=$$(grep -oP "^## $${TODAY}-\K\d+" Changelog.md 2>/dev/null | sort -rn | head -1 || echo "1") && \
		if [ "$$MAX" -gt 1 ]; then VERSION="$${TODAY}-$$((MAX+1))"; else VERSION="$${TODAY}-2"; fi; \
	fi && \
	HEADER="## $${VERSION}" && \
	ENTRY="  - $${BRANCH}" && \
	FIRST_ENTRY=$$(grep -n '^## ' Changelog.md | head -1 | cut -d: -f1) && \
	if [ -z "$$FIRST_ENTRY" ]; then \
		printf "%s\n\n### Changed\n%s\n" "$$HEADER" "$$ENTRY" >> Changelog.md; \
	else \
		sed -i "$${FIRST_ENTRY}i\\$${HEADER}\n\n### Changed\n$${ENTRY}\n" Changelog.md; \
	fi && \
	echo "📝 Added $${VERSION} entry for $${BRANCH}"

# Create and push a YYYY.MM.DD-RR git tag
tag:
	@bash backend/scripts/tag.sh $(TAG)

dev.docker.up:
	@$(COMPOSE) up --build -d

dev.docker.down:
	@$(COMPOSE) down --remove-orphans

dev.docker.logs:
	@$(COMPOSE) logs -f --tail=200 $(DOCKER_DEV_LOG_SERVICES)

dev.docker.ps:
	@$(COMPOSE) ps

dev.docker.migrate:
	@$(COMPOSE) run --rm app uv run alembic upgrade head

# Local end-to-end test stack (default + test overlay). CI uses pytest + GH services.
dev.docker.test.up:
	@$(COMPOSE_TEST) up --build -d

dev.docker.test.down:
	@$(COMPOSE_TEST) down --remove-orphans

# Image benchmarks — build both targets and report sizes
benchmark.images:
	bash backend/scripts/benchmark-images.sh

# Integration test with split images
test.images:
	bash backend/scripts/test-images.sh $(TAG)
