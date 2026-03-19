# Plan: Wiki Documentation Gaps from MCP Tool Execution Discoveries

## Context

During the QA session for `claude -p` via exec_server MCP, we discovered a critical bug: the `enabled` field in MCP server configs was being passed to `MultiServerMCPClient`, causing `_create_streamable_http_session() got an unexpected keyword argument 'enabled'`. MCP tools silently failed to load (error caught, empty list returned), making the agent proceed without `exec_command` — with no user-visible error.

This exposed several documentation gaps where the wiki doesn't reflect how the system actually works, leading to confusion for both users and developers.

## Documentation Gaps to Address

### 1. `wiki/docs/tools/mcp.md` — MCP Configuration Reference

**Gap:** The `enabled` field for toggling MCP servers on/off is not documented. Users can toggle servers in the UI but the JSON config format doesn't show it.

**Fix:** Add `enabled` to the MCP config JSON examples and explain its behavior:
- Add `enabled` (optional, defaults to `true`) to the config field table
- Show an example config with `"enabled": false` to disable a server without deleting it
- Note: servers without the field are enabled by default (backwards compatible)

### 2. `wiki/docs/tools/sandbox.md` — Sandbox Troubleshooting

**Gap:** The troubleshooting table is too basic. Key failure modes discovered during QA are missing.

**Fix:** Add these rows to the troubleshooting table:

| Issue | Solution |
|-------|----------|
| MCP tools silently not loading | Check backend/worker logs for `Error fetching MCP tools`. MCP errors are caught silently — the agent proceeds without MCP tools. |
| Docker Compose dev URL | Use `http://host.docker.internal:3005/mcp` when exec_server runs in a separate compose stack from the backend |
| Agent says tool unavailable despite config | The agent may be reading stale workspace memory files. Start a fresh thread or clear the agent's `/memory/` files |

### 3. `wiki/docs/tools/sandbox.md` — Pre-installed Software

**Gap:** Docs list `curl, jq, node (v22), gh` but don't mention `agent-browser` (Playwright/Chromium) which is also globally installed in the Dockerfile.

**Fix:** Update the pre-installed software list to include `agent-browser` (browser automation with Playwright/Chromium).

### 4. `wiki/docs/tools/sandbox.md` — Docker Compose Dev Setup

**Gap:** The "Connect to Orchestra" section only shows `exec_server:3005` (same docker network) and `localhost:3005` (host). Missing the `host.docker.internal` pattern used when exec_server and backend are in separate compose stacks.

**Fix:** Add a third URL pattern row to the Connection Details table:

| URL | When to use |
|-----|-------------|
| `http://host.docker.internal:3005/mcp` | Backend runs in Docker, exec_server on host or separate compose stack |

### 5. `wiki/docs/self-hosting/index.md` — Exec Server Setup

**Gap:** Self-hosting docs cover AI provider env vars, database, and S3 but don't mention the exec_server sandbox or how to enable it.

**Fix:** Add a brief "Sandbox (Optional)" section explaining:
- Enable with `COMPOSE_PROFILES=tools`
- Reference to sandbox docs for configuration
- Note that exec_server is optional — only needed for shell command execution

### 6. `wiki/docs/tools/mcp.md` — Silent Failure Behavior

**Gap:** No docs explain that MCP tool fetch failures are silently caught. If an MCP server is unreachable or misconfigured, the agent simply proceeds without those tools — there's no error shown in the UI.

**Fix:** Add an admonition/callout box:
```
:::warning Silent Failures
If an MCP server is unreachable or returns an error during tool discovery,
the agent will proceed without those tools. No error is shown in the chat.
Check the backend logs for `Error fetching MCP tools` if expected tools
are missing.
:::
```

## Files to Modify

| File | Change |
|------|--------|
| `wiki/docs/tools/mcp.md` | Add `enabled` field docs, silent failure warning |
| `wiki/docs/tools/sandbox.md` | Expand troubleshooting, add agent-browser to pre-installed list, add `host.docker.internal` URL pattern |
| `wiki/docs/self-hosting/index.md` | Add optional sandbox/exec_server section |

## Verification

1. Run `cd wiki && npm run build` to verify docs build without errors
2. Run `cd wiki && npm run start` and visually check the updated pages
3. Confirm `wiki/docs/tools/mcp.md` shows `enabled` field in config examples
4. Confirm `wiki/docs/tools/sandbox.md` troubleshooting covers silent MCP failures
5. Confirm `wiki/docs/self-hosting/index.md` mentions sandbox setup
