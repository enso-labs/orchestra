# Spec 001: Add CopilotKit Middleware to Backend

## Summary
Add `copilotkit` Python dependency and integrate `CopilotKitMiddleware()` into the deep agent middleware stack.

## Changes

### Files
- `backend/pyproject.toml` — add `copilotkit` dependency
- `backend/src/agents/__init__.py` — add `CopilotKitMiddleware()` to `create_agent()` / `create_deep_agent()` middleware list
- `backend/src/utils/middleware.py` — optionally include in `init_default_middleware()`

### Details
1. Add `copilotkit` to `[project.dependencies]` in `pyproject.toml`
2. Import `CopilotKitMiddleware` from `copilotkit.langchain` (or `copilotkit`)
3. Insert `CopilotKitMiddleware()` early in the middleware stack (before PII/compaction) so frontend tools and context are available
4. Middleware should be no-op when CopilotKit frontend is not connected (backward compatible)

## Acceptance Criteria
- [ ] `copilotkit` in pyproject.toml dependencies
- [ ] `CopilotKitMiddleware()` in middleware list
- [ ] Agent creates successfully with new middleware
- [ ] Existing agent behavior unaffected without CopilotKit frontend
- [ ] Typecheck passes
- [ ] Tests pass
