# Remaining Steps: `feat/694-show-subagent-tool-calls`

## Context

All code changes are complete (US-001 through US-014, implemented by Ralph). What remains is:
1. Run automated checks to confirm no regressions
2. Browser QA via `agent-browser` to validate all acceptance criteria visually
3. Write the `05.md` QA results file
4. Final commit if needed

See: `.claude/plans/feat-694/04-cr-revision.md` for the revision plan that was executed.

---

## Step 1: Run Automated Checks

Run all lint/format/type/test checks to confirm Ralph's changes are clean.

```bash
cd backend && make lint        # ruff check — must pass
cd backend && make format      # ruff format --check — must pass

cd frontend && npm run lint    # eslint — must pass
cd frontend && npm run build   # tsc -b + vite build — must pass
cd frontend && npm run test    # vitest — all 255 tests must pass (2 previously failing now fixed)
```

---

## Step 2: Browser QA via `agent-browser` skill

**Prerequisites:** Backend on :8000, Frontend on :5173 (verify dev server CWD matches worktree).

### V2a: Verify SubagentBadge on reloaded thread (US-005, US-006, US-013)

```bash
# 1. Verify dev server CWD
ls -l /proc/$(lsof -i :5173 -t 2>/dev/null | head -1)/cwd

# 2. Open app
agent-browser open http://localhost:5173

# 3. Find + click a subagent thread
agent-browser snapshot          # get refs
agent-browser click @eNN        # click "Execute 3 parallel @python-programmer..."

# 4. Wait + screenshot
agent-browser wait 2000
agent-browser screenshot /tmp/qa-v2a-subagent-thread.png

# 5. Check SubagentBadge exists in DOM
agent-browser eval "document.querySelector('[data-testid=\"subagent-badge\"]')?.textContent"
# Expected: agent name string (e.g. "python-programmer"), NOT "NOT FOUND" or null

# 6. Check badge count (should be > 0, less than total messages)
agent-browser eval "({badges: document.querySelectorAll('[data-testid=\"subagent-badge\"]').length})"
```

### V2b: Verify "via {agent_name}" in ToolTimeline (US-007)

```bash
# 1. Get refs for tool timeline expand buttons
agent-browser snapshot

# 2. Click expand chevron on a subagent tool result
agent-browser click @eNN        # the expand button ref

# 3. Screenshot expanded tool
agent-browser wait 500
agent-browser screenshot /tmp/qa-v2b-tool-via.png

# 4. DOM check for "via" spans
agent-browser eval "Array.from(document.querySelectorAll('span')).filter(el => el.textContent.startsWith('via ')).map(el => el.textContent)"
# Expected: ["via python-programmer"] or similar
```

### V2c: Verify parent messages unaffected (US-005 AC3, US-006 AC3, US-007 AC2)

```bash
# Final summary message (parent agent) should have no badge
# Count should confirm badges < total assistant messages
agent-browser eval "({badges: document.querySelectorAll('[data-testid=\"subagent-badge\"]').length, assistants: document.querySelectorAll('.group.px-3').length})"
```

### V2d: Verify SubagentBadge title tooltip (US-014)

```bash
agent-browser eval "document.querySelector('[data-testid=\"subagent-badge\"] .truncate')?.title"
# Expected: full agent name string
```

### V2e: Close browser
```bash
agent-browser close
```

---

## Step 3: Acceptance Criteria Matrix

Fill pass/fail for each AC after browser QA:

| AC | Story | What to Verify | Method | Result |
|----|-------|----------------|--------|--------|
| US-005 AC2 | SubagentBadge | Bot icon + agent name in muted style | DOM check + screenshot | |
| US-005 AC3 | SubagentBadge | Badge absent on parent messages | Badge count check | |
| US-006 AC1 | ChatMessages | SubagentBadge above assistant messages | Screenshot | |
| US-006 AC2 | ChatMessages | Left border on subagent messages | Screenshot | |
| US-006 AC3 | ChatMessages | Parent messages unchanged | Screenshot | |
| US-007 AC1 | ToolTimeline | "via {agent_name}" in tool header | DOM check | |
| US-007 AC2 | ToolTimeline | No "via" on parent tool calls | DOM check | |
| US-013 | Persistence | agent_name survives thread reload | Badge visible on reloaded thread | |
| US-014 | Tooltip | title attribute on truncated badge | DOM check | |

---

## Step 4: Commit + Write QA Report

1. Check `git status` for uncommitted changes
2. If changes exist, commit with sign-off: `git commit -s`
3. Write QA results to `.claude/plans/feat-694/05-qa-results.md` with pass/fail for each AC

**NOTE:** This plan will also be written to `.claude/plans/feat-694/05-remaining-steps.md` for traceability in the plan chain (01-plan, 02-code-review, 03-report, 04-revision, 05-remaining-steps).
