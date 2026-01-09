# Enable Default Tools for `ruska chat`

## Summary

In `./frontend/src/components/menus/BaseToolMenu.tsx` we have `DEFAULT_AGENT_TOOLS`. These are the default tools that the CLI needs to use for the command `ruska chat` by default unless a flag with of `--tools=disabled` is passed. This should be allowed a list of comma separated values to be more granular.

---

## Phase 1: Constants & Configuration

Define shared default tools constant and add CLI flag support.

**Acceptance Criteria:**

-   `DEFAULT_AGENT_TOOLS` defined in CLI codebase
-   `--tools` flag added to `ruska chat` command

---

## Phase 2: Command Integration

Wire tools into the chat stream request.

**Acceptance Criteria:**

-   Default tools passed to API when no flag provided
-   `--tools=disabled` sends empty tools array
-   `--tools=tool1,tool2` sends only specified tools

---

## Phase 3: Testing & Documentation

Validate behavior and update docs.

**Acceptance Criteria:**

-   Unit tests for tools parsing logic
-   CLI help text updated
-   README documents new flag

---

## Reference

### DEFAULT_AGENT_TOOLS

```typescript
["web_search", "web_scrape", "math_calculator", "think_tool", "python_sandbox"];
```

### Key Files

-   `cli/source/cli.tsx` — CLI entry point
-   `cli/source/commands/chat.tsx` — Chat command implementation
-   `cli/source/types/stream.ts` — `StreamRequest.tools` field (already exists)
