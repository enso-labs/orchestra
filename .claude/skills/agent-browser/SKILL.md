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

## Selectors

Three types:
- **CSS**: `#id`, `.class`, `input[name="email"]`
- **Snapshot refs**: `@e1`, `@e2` (from `snapshot` output)
- **Semantic**: `find role button "Submit"` (ARIA roles, text, labels)

## Agent Workflow

1. **Navigate + snapshot**: `agent-browser open <url> && agent-browser snapshot --json`
2. **Parse refs** from JSON output to identify interactive elements
3. **Act** using refs: `agent-browser click @e2`, `agent-browser fill @e3 "hello"`
4. **Re-snapshot** after each action to observe new state
5. **Screenshot** when visual verification is needed

## JSON Output

Add `--json` to any command for structured output:
```json
{"success": true, "data": {...}}
```

## Sessions

Use `--session <name>` for isolated sessions or `--profile <path>` for persistent cookies/storage.

## Full Documentation

See https://github.com/vercel-labs/agent-browser for complete docs, cloud provider setup, and WebSocket streaming.
