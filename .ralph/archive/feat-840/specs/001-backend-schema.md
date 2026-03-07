# Spec 001: Backend Schema — Add `enabled` field to MCP server config

## Overview
Add an optional `enabled` boolean field to MCP server configurations so servers can be disabled without deletion.

## Changes

### `backend/src/schemas/entities/llm.py`
- MCP config values (`dict[str, dict]`) should support an `enabled: bool` field (default `true`)
- When `enabled` is `false`, the server should be excluded from tool loading

### `backend/src/services/tool.py`
- Filter out disabled MCP servers before connecting/loading tools
- Only servers with `enabled != false` should be used (backwards-compatible: missing field = enabled)

### `backend/src/schemas/entities/settings.py`
- `default_mcp` dict values should also support the `enabled` field

## Backwards Compatibility
- Existing MCP configs without `enabled` field are treated as enabled (`true`)
- No migration needed — the field is optional
