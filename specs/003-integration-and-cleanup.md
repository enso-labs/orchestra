# Spec 003: Integration & Cleanup

## Overview
Ensure the enable/disable state flows end-to-end and is persisted correctly.

## Changes

### Thread/Assistant level
- When saving assistant config, preserve `enabled` field in MCP dict
- When loading assistant for chat, filter disabled MCP servers before tool initialization

### User defaults level
- `PatchDefaultsRequest.mcp` already accepts `dict` — no schema change needed
- Settings UI should preserve `enabled` state when saving defaults

### API contract
- No new endpoints needed — `enabled` field travels inside existing MCP config dicts
- Example: `{"my_server": {"transport": "sse", "url": "...", "headers": {}, "enabled": false}}`

## Tests
- Backend: test that disabled MCP servers are filtered from tool loading
- Frontend: test toggle updates config and visual state
