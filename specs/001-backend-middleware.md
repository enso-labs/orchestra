# Spec 001: Add CopilotKitMiddleware to Backend

## Objective
Add `CopilotKitMiddleware()` from the `copilotkit` Python package to the deep agent middleware stack so the agent can access frontend tools and context.

## Files Modified
- `backend/src/agents/__init__.py` — add `CopilotKitMiddleware()` to `create_agent()` middleware list
- `backend/src/utils/middleware.py` — optionally add to `init_default_middleware()` 
- `backend/pyproject.toml` — add `copilotkit` dependency (if not already present)

## Changes

### `create_agent()` in `agents/__init__.py`
```python
from copilotkit import CopilotKitMiddleware

# In create_agent(), add to middleware list:
middleware=init_default_middleware(backend=backend) + [CopilotKitMiddleware()] + middleware,
```

### Dependency
Verify `copilotkit` is in `pyproject.toml` dependencies. The `deepagents` package may already pull it in transitively.

## Notes
- CopilotKitMiddleware should go after default middleware but before user-supplied middleware
- It enables the agent to see frontend context and call frontend tools
- No configuration needed — it auto-detects CopilotKit protocol messages

## Tests
- Verify agent creates successfully with CopilotKitMiddleware in stack
- Verify existing agent behavior is unaffected (middleware is no-op without CopilotKit frontend)
- Typecheck passes
