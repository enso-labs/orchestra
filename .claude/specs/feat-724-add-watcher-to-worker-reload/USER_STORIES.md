# User Stories

## Issue #724: Add watcher to worker so changes will affect it to reload from related changes

### Story 1: Auto-reload TaskIQ Worker on Code Changes
**As a** developer running Ralph autonomous loops,
**I want** the TaskIQ worker to automatically reload when Python source files change,
**So that** code changes made during Ralph iterations are immediately reflected in the running worker without manual restarts.

**Acceptance Criteria:**
- [ ] Worker process detects file changes in backend source directories
- [ ] Worker automatically restarts/reloads when `.py` files are modified
- [ ] Reload behavior mirrors uvicorn's `--reload` functionality for the worker
- [ ] Worker reload does not lose in-flight tasks (graceful shutdown before restart)
- [ ] Configuration for watched directories is configurable (not hardcoded)

### Story 2: Development-Only Watcher Configuration
**As a** developer,
**I want** the file watcher to only be active in development mode,
**So that** production workers are not affected by file-watching overhead.

**Acceptance Criteria:**
- [ ] Watcher is only enabled when a development/reload flag is set
- [ ] Production worker startup is unaffected (no watcher dependencies loaded)
- [ ] Docker compose dev configuration includes the reload flag

## Notes
- TaskIQ is the task queue framework in use — need to research its native reload support
- uvicorn uses `watchfiles` for its reload — may be able to reuse the same approach
- Consider using `watchfiles` (formerly `watchgod`) as the file system watcher
- Graceful shutdown is important to avoid corrupted task state
