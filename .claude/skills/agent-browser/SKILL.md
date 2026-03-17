---
name: agent-browser
description: "Browser automation with persistent page state using Vercel's agent-browser CLI. Use when users ask to navigate websites, fill forms, take screenshots, extract web data, test web apps, or automate browser workflows. Trigger phrases include 'go to [url]', 'click on', 'fill out the form', 'take a screenshot', 'scrape', 'automate', 'test the website', 'log into', or any browser interaction request."
---

# agent-browser

Browser automation via the `agent-browser` CLI (https://github.com/vercel-labs/agent-browser).

## Quick Reference

All commands are run via Bash: `agent-browser <command> [args]`.

| Action | Command |
|--------|---------|
| Navigate | `agent-browser open <url>` |
| Screenshot | `agent-browser screenshot [path]` (`--full` for full page) |
| Accessibility snapshot | `agent-browser snapshot` (returns `@e1`, `@e2` refs) |
| Click | `agent-browser click <selector-or-ref>` |
| Fill input | `agent-browser fill <selector-or-ref> "<text>"` |
| Type (append) | `agent-browser type <selector-or-ref> "<text>"` |
| Key press | `agent-browser press <key>` |
| Read text | `agent-browser get text <selector-or-ref>` |
| Get URL/title | `agent-browser get url` / `agent-browser get title` |
| Wait | `agent-browser wait <selector>` or `agent-browser wait <ms>` |
| Semantic find | `agent-browser find role button click` |
| Close | `agent-browser close` |
| Hover | `agent-browser hover <selector-or-ref>` |
| Double-click | `agent-browser dblclick <selector-or-ref>` |
| Select dropdown | `agent-browser select <selector-or-ref> <value>` |
| Check/Uncheck | `agent-browser check <sel>` / `agent-browser uncheck <sel>` |
| Scroll | `agent-browser scroll <up\|down\|left\|right> [px]` |
| Upload file | `agent-browser upload <sel> <file...>` |
| Evaluate JS | `agent-browser eval "<js>"` |
| Save PDF | `agent-browser pdf <path>` |
| Go back/forward | `agent-browser back` / `agent-browser forward` |
| Reload | `agent-browser reload` |
| Get element count | `agent-browser get count <sel>` |
| Check visibility | `agent-browser is visible <sel>` |
| Check enabled | `agent-browser is enabled <sel>` |
| Drag and drop | `agent-browser drag <src> <dst>` |

### Debug Quick Reference

| Action | Command |
|--------|---------|
| View console logs | `agent-browser console` |
| View page errors | `agent-browser errors` |
| Start trace | `agent-browser trace start` |
| Stop trace | `agent-browser trace stop [path]` |
| Start video recording | `agent-browser record start <path>` |
| Stop video recording | `agent-browser record stop` |
| Highlight element | `agent-browser highlight <sel>` |
| Debug mode | Add `--debug` flag to any command |
| Headed mode (visible) | Add `--headed` flag to any command |
| Network requests log | `agent-browser network requests` |

### Browser Settings

| Setting | Command |
|---------|---------|
| Set viewport | `agent-browser set viewport <w> <h>` |
| Set device | `agent-browser set device <name>` |
| Set dark/light mode | `agent-browser set media light` or `agent-browser set media dark` |
| Set geolocation | `agent-browser set geo <lat> <lng>` |
| Go offline | `agent-browser set offline on` |
| Set headers | `agent-browser set headers '<json>'` |

## Selectors

Three types:
- **CSS**: `#id`, `.class`, `input[name="email"]`
- **Snapshot refs**: `@e1`, `@e2` (from `snapshot` output)
- **Semantic**: `find role button "Submit"` (ARIA roles, text, labels)

## Defaults

- **Default test URL**: `http://localhost:5173`
- **Default login credentials**: `admin@example.com` / `test1234`
- **Default screenshot mode**: Light mode (run `agent-browser set media light` before capturing) — required when creating docs for `@wiki`

## Dev Server Check (REQUIRED)

Before running any browser automation, **always** check if the target port needs its own dev server spun up to avoid accidentally using a dev server from a different worktree:

```bash
# 1. Check what's already running on the target port
lsof -i :5173 -t 2>/dev/null && echo "Port in use" || echo "Port free"

# 2. If in use, verify the process CWD matches this worktree
ls -l /proc/$(lsof -i :5173 -t 2>/dev/null | head -1)/cwd 2>/dev/null
```

If the running server's working directory does NOT match the current worktree, start a new dev server on an available port and use that instead.

## Agent Workflow

1. **Check dev server** (see above) — start one if needed
2. **Navigate + snapshot**: `agent-browser open <url> && agent-browser snapshot --json`
3. **Parse refs** from JSON output to identify interactive elements
4. **Act** using refs: `agent-browser click @e2`, `agent-browser fill @e3 "hello"`
5. **Re-snapshot** after each action to observe new state
6. **Screenshot** when visual verification is needed (light mode for wiki docs)

## JSON Output

Add `--json` to any command for structured output:
```json
{"success": true, "data": {...}}
```

## Sessions

Use `--session <name>` for isolated sessions or `--profile <path>` for persistent cookies/storage.

## Troubleshooting

If you run into issues with any command, run `agent-browser --help` to check available commands and flags. Common fixes:

- **Element not found**: Re-run `agent-browser snapshot` to get fresh refs — refs change after page mutations
- **Timeout**: Use `agent-browser wait <sel>` before interacting with dynamically loaded elements
- **Can't see what's happening**: Add `--headed` to see the browser, or `--debug` for verbose output
- **Stale session**: Run `agent-browser close` and start fresh
- **Check specific command help**: Most commands support `--json` for structured output to debug responses

## Cross-Origin Embed Testing

When testing an embedded widget served from a different origin than the host page, standard navigation patterns are insufficient. Use this checklist:

### 1. Verify the embed asset is served correctly

```bash
# Must return application/javascript, NOT text/html
curl -s -o /dev/null -w "%{content_type}" http://localhost:8000/embed/embed.js
```

If the response is `text/html`, the SPA catch-all is intercepting the file request. The backend must have `os.path.isfile()` guard before serving `index.html`.

### 2. Load the widget from a host-page context

The widget's `script.src` origin must differ from `window.location.origin` to test real cross-origin behavior. Create a minimal test page:

```bash
# Serve a minimal host page on a different port
cat > /tmp/embed-test.html <<'EOF'
<!DOCTYPE html>
<html>
<body>
  <div id="chat-widget"></div>
  <script src="http://localhost:8000/embed/embed.js"
          data-assistant-id="<id>"
          data-base-url="http://localhost:8000">
  </script>
</body>
</html>
EOF
python3 -m http.server 9999 -d /tmp &
agent-browser open http://localhost:9999/embed-test.html
```

### 3. Check browser console for cross-origin errors

```bash
agent-browser console
agent-browser errors
```

Watch for:
- `CORS` errors → backend CORS config does not include the host page origin
- `net::ERR_FAILED` on API calls → widget is calling the wrong origin (host page instead of script origin)
- `404` on API paths → widget uses wrong prefix (e.g., `/api/v0/` instead of `/api/`)

### 4. Verify apiBase derivation

The widget must derive its API base from the script tag's `src`, not from `window.location`:

```bash
# Confirm widget JS contains the correct origin logic
grep "script.src\|new URL" frontend/src/embed/EmbedWidget.tsx
# Should NOT contain window.location.origin as the apiBase default
grep "location.origin" frontend/src/embed/EmbedWidget.tsx
```

### 5. CORS preflight check

```bash
curl -s -X OPTIONS http://localhost:8000/api/assistants/public/<id>/embed-chat \
  -H "Origin: http://localhost:9999" \
  -H "Access-Control-Request-Method: POST" -I | grep -i "access-control"
```

Expected: `access-control-allow-origin: *` or the specific host origin.

## Full Documentation

See https://github.com/vercel-labs/agent-browser for complete docs, cloud provider setup, and WebSocket streaming.
