# PRD: Include Memory Seeder in Docker Container Build

## Introduction

The `seeds/` directory is excluded from Docker builds via `.dockerignore` and source `.py` files are deleted in the build stage. This prevents running seeders from deployed environments. Fix both exclusions so the seeder is available in production containers.

## User Stories

### US-001: Remove seeds from .dockerignore and preserve in Dockerfile
**Description:** As a developer, I want the seeds directory included in the Docker build with source files preserved.

**Acceptance Criteria:**
- [ ] Remove `**/seeds` line from `backend/.dockerignore`
- [ ] Update `backend/Dockerfile` find-delete command to exclude seeds: `find /app -type f -name "*.py" ! -path "/app/migrations/*" ! -path "/app/seeds/*" -delete`
- [ ] Verify seeds/ files are present in built image
- [ ] Existing functionality unaffected (app starts, migrations work)
- [ ] Typecheck passes

### US-002: Verify workspace is clean and push final changes
**Description:** As a developer, I want to ensure all changes are committed and pushed.

**Acceptance Criteria:**
- [ ] Run git status to check for uncommitted changes
- [ ] If remaining changes exist, commit and push to branch
- [ ] All commits visible in GitHub PR
