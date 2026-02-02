# Council Review: Add File-Watching Reload to TaskIQ Worker

**Issue:** #724
**Date:** 2026-02-01
**Proposals Reviewed:** PROCESS_WATCHER, DEVOPS_ARCHITECT, TASKIQ_SPECIALIST

---

## 1. Proposal Comparison Matrix

| Aspect | PROCESS_WATCHER | DEVOPS_ARCHITECT | TASKIQ_SPECIALIST | Council Verdict |
|--------|----------------|-----------------|-------------------|-----------------|
| Architecture | Native `--reload` | Native `--reload` | Native `--reload` | **Unanimous: Use native flag** |
| Makefile change | `--reload --reload-dir src` | `--reload --reload-dir src` | `--reload --reload-dir src` | **Identical across all** |
| Docker compose | Optional override file | `docker-compose.dev.yml` | Not addressed | **Optional: defer to later** |
| Shutdown timeout | Default (5s) | Default | 10s suggested | **Use default, document option** |
| Dependencies | watchfiles (via uvicorn) | watchdog (via taskiq) | watchdog (verify) | **Verify & add if needed** |
| Complexity | Small / Low | Small / Low | Trivial | **Small / Low** |

## 2. Consensus Points

All three proposals unanimously agree on:

1. **TaskIQ has built-in `--reload` and `--reload-dir` flags** — no custom watcher code needed
2. **The Makefile `dev.worker` target is the primary change point** — add `--reload --reload-dir src`
3. **Scope the watcher to `src/` only** — avoid spurious restarts from tests, migrations, data files
4. **Production `docker-compose.yml` must NOT use `--reload`** — dev-only feature
5. **Existing lifecycle hooks handle reload correctly** — `WorkerState` startup/shutdown works with process restarts
6. **No application code changes needed** — broker, tasks, and state modules are already reload-safe

## 3. Divergence Analysis

### Docker Compose Override
- PROCESS_WATCHER: Optional `docker-compose.override.yml`
- DEVOPS_ARCHITECT: Dedicated `docker-compose.dev.yml` with Makefile targets
- TASKIQ_SPECIALIST: Not addressed

**Council Decision:** The Docker compose override is useful but secondary. The primary use case (Ralph loops, local dev) uses `make dev.worker`, not Docker. **Defer Docker compose changes to a follow-up if needed.** Keep scope minimal.

### Shutdown Timeout
- TASKIQ_SPECIALIST suggests 10s for long-running agent tasks
- Others use default (5s)

**Council Decision:** Use default. In dev, fast restarts are preferred. Developers can tune this if they encounter issues.

### Dependency (watchfiles vs watchdog)
- PROCESS_WATCHER references watchfiles (uvicorn's dependency)
- DEVOPS_ARCHITECT and TASKIQ_SPECIALIST reference watchdog

**Council Decision:** Verify which library TaskIQ actually uses. If `watchdog` is needed and not present, add it. The `watchfiles` package may also work if already installed.

## 4. Unified Implementation Plan

### Required Changes

1. **Update `backend/Makefile`**: Add `--reload --reload-dir src` to `dev.worker` target
2. **Verify watcher dependency**: Check if `watchdog` or `watchfiles` is available; add to `pyproject.toml` dev deps if needed

### Optional (Deferred)

3. Docker compose dev override with volume mount and reload flags
4. Documentation updates

### Implementation Sequence

1. Verify dependency → 2. Update Makefile → 3. Test manually → Done

## 5. Risk Consolidation

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| In-flight task interrupted during reload | Low (dev only) | Medium | Expected behavior in dev; tasks can be re-triggered |
| Missing watchdog/watchfiles dependency | Low | Low | Verify and add if needed |
| WSL2 inotify compatibility | None | None | Project is on WSL filesystem, not Windows mount |
| WorkerState corruption | None | None | Fresh process per reload; lifecycle hooks fire correctly |
| Production impact | None | None | `--reload` only in Makefile dev target |

## 6. Final Verdict

- **Recommendation:** **GO**
- **Confidence Level:** **High**
- The change is trivial, well-understood, uses battle-tested built-in functionality, and has zero production impact.
