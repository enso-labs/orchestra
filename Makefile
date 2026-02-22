.PHONY: update-submodules ralph archive setup tag changelog

ENV ?= dev
MAX_ITERATIONS ?= 200

update-submodules:
	@echo "🔍 Initializing submodules..."
	git submodule init

	@echo "⬇️  Updating all submodules to their latest remote commits..."
	git submodule update --remote --merge

	@echo "📝 Staging changes..."
	git add .

	@echo "✅ Committing updated submodules..."
	git commit -m "Update all submodules to latest remote commits" || echo "No changes to commit."

	@echo "🏁 Done."

# Install pre-commit hooks
setup:
	pre-commit install

# Run the Ralph autonomous agent loop using Claude Code
ralph:
	@unset CLAUDECODE; bash .ralph/ralph.sh $(MAX_ITERATIONS)

# Archive current prd.json and progress.txt into [feat|bug]-<issue#> directory
archive:
	@BRANCH=$$(jq -r '.branchName' .ralph/prd.json 2>/dev/null) && \
	if [ -z "$$BRANCH" ] || [ "$$BRANCH" = "null" ]; then echo "No .ralph/prd.json or branchName found"; exit 1; fi && \
	ARCHIVE_DIR=".ralph/archive/$$(echo $$BRANCH | sed 's|/\([0-9]*\).*|-\1|')" && \
	mkdir -p "$$ARCHIVE_DIR" && \
	cp .ralph/prd.json "$$ARCHIVE_DIR/prd.json" && \
	[ -f .ralph/progress.txt ] && cp .ralph/progress.txt "$$ARCHIVE_DIR/progress.txt" || true && \
	rm -f .ralph/prd.json .ralph/progress.txt && \
	echo "Archived to $$ARCHIVE_DIR"

# Add a changelog entry for the current branch (YYYY.MM.DD-RR format)
changelog:
	@TODAY=$$(date -u +%Y.%m.%d) && \
	BRANCH=$$(git rev-parse --abbrev-ref HEAD) && \
	LAST_REV=$$(grep -oP "^## $${TODAY}-\K\d+" Changelog.md 2>/dev/null | head -1 || echo "0") && \
	NEXT_REV=$$(printf "%02d" $$((10#$${LAST_REV} + 1))) && \
	VERSION="$${TODAY}-$${NEXT_REV}" && \
	HEADER="## $${VERSION}" && \
	ENTRY="  - $${BRANCH}" && \
	FIRST_ENTRY=$$(grep -n '^## ' Changelog.md | head -1 | cut -d: -f1) && \
	if [ -z "$$FIRST_ENTRY" ]; then \
		echo "$$HEADER\n\n### Changed\n$$ENTRY" >> Changelog.md; \
	else \
		sed -i "$${FIRST_ENTRY}i\\$${HEADER}\n\n### Changed\n$${ENTRY}\n" Changelog.md; \
	fi && \
	echo "📝 Added $${VERSION} entry for $${BRANCH}"

# Create and push a YYYY.MM.DD-RR git tag
tag:
	@bash backend/scripts/tag.sh $(TAG)