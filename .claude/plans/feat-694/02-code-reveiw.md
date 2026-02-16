# Code Review Plan: `feat/694-show-subagent-tool-calls`

## Context

Branch `feat/694-show-subagent-tool-calls` implements subagent attribution in the Orchestra UI — 9 user stories (US-001 → US-009) across 12 commits. The feature pipes `lc_agent_name` from LangGraph through the backend serialization, frontend streaming pipeline, and into the chat UI as visual badges and tool-call annotations.

Additionally, the branch includes **out-of-scope changes**: memory seeding functionality (new files + auth route modifications) that are not part of the PRD. These need to be flagged.

---

## Step 1: Run Pre-commit Hooks (without committing)

Run linting/formatting/type checks for both backend and frontend to catch any regressions.

```bash
# Backend
cd backend && make lint   # ruff check
cd backend && make format # ruff format --check

# Frontend
cd frontend && npm run lint
cd frontend && npm run build  # includes tsc -b typecheck
cd frontend && npm run test   # vitest
```

---

## Step 2: Code Review Findings

### 2a. Out-of-Scope Changes (Flag to User)

The following files are staged on this branch but are **not part of the subagent attribution PRD**:

| File | Description |
|------|-------------|
| `backend/src/constants/default_memories.py` | New — default memory templates |
| `backend/src/utils/memory_seed.py` | New — seed utility |
| `backend/seeds/memory_seeder.py` | New — CLI seed script |
| `backend/src/routes/v0/auth.py` | Modified — adds memory seeding on register/oauth |
| `backend/Makefile` | Modified — adds `seeds.memory` target |
| `backend/pyproject.toml` | Modified — adds ruff E501 exclusion for default_memories |
| `tasks/prd-isolate-memories-page.md` | New — separate PRD doc |
| `tasks/prd-separate-tool-inputs.md` | New — separate PRD doc |
| `frontend/src/pages/memories/*` | Modified/New — memories page UI |
| `frontend/src/pages/settings/index.tsx` | Modified |
| `frontend/src/components/drawers/app-sidebar.tsx` | Modified |
| `frontend/src/routes/AppRoutes.tsx` | Modified |
| `.claude/plans/feat-781/01.md` | New plan file |
| `.claude/plans/feat-784/01.md` | New plan file |

**Recommendation:** These should be on separate branches/PRs, or the PR description should explicitly acknowledge the mixed scope.

### 2b. In-Scope Code Quality Issues

**Backend (stream.py, messages.py):**
- **Code duplication:** `agent_name` promotion logic (`lc_agent_name` → `agent_name`) is duplicated between `_to_dict()` in `stream.py` and `from_message_to_dict()` in `messages.py`. Could extract to a shared helper but acceptable for now given it's 3 lines.
- **Efficiency:** `handle_multi_mode()` line ~163 creates `dict(msg)` on every iteration just to check `lc_agent_name`. The modified `_to_dict()` already handles this, so the inline check is redundant.
- **Missing backend tests:** No unit tests for the `agent_name` promotion in `_to_dict()` or `from_message_to_dict()`.

**Frontend (useChat.ts, message.ts, format.ts):**
- `agent_name` extraction and propagation logic is clean and uses null-coalescing correctly.
- `format.ts` comment documenting the spread-preserves-agent_name behavior is helpful.
- 6 new test cases in `format.test.ts` cover the key scenarios.

**Frontend (ChatMessages.tsx, ToolTimelineItem.tsx):**
- `SubagentBadge` is minimal and well-structured.
- `ToolMessage` interface duplicated in both `ToolTimeline.tsx` and `ToolTimelineItem.tsx` — minor DRY violation.
- SubagentBadge has `max-w-[120px]` hardcoded without `title` attribute for truncated names.

---

## Step 3: Validate Acceptance Criteria via Browser

Use the `agent-browser` skill to validate the visual/behavioral criteria that require a running app.

### Prerequisites
- Backend running on port 8000
- Frontend running on port 5173 (or 8030)
- An existing thread with subagent tool calls (or trigger one live)

### Validation Checklist

| AC | Story | What to Verify | How |
|----|-------|----------------|-----|
| US-005 AC2 | SubagentBadge | Bot icon + agent name shown in muted style | Navigate to a thread with subagent messages, screenshot |
| US-005 AC3 | SubagentBadge | Badge absent when no agent_name | Check parent-agent messages have no badge |
| US-006 AC1 | ChatMessages | SubagentBadge rendered above assistant messages with agent_name | Visual inspection |
| US-006 AC2 | ChatMessages | Left border on subagent messages | Visual inspection |
| US-006 AC3 | ChatMessages | Parent agent messages unchanged | Compare parent vs subagent messages |
| US-007 AC1 | ToolTimeline | "via {agent_name}" in tool call header | Expand a tool call from a subagent |
| US-007 AC2 | ToolTimeline | No "via" text on parent-agent tool calls | Expand a parent-agent tool call |

### Browser Validation Steps
1. Navigate to the app (`http://localhost:5173` or `http://localhost:8030`)
2. Open an existing thread that used subagents (or create one by invoking an agent with subagent config)
3. Screenshot the chat to verify SubagentBadge visibility and left-border styling
4. Expand tool call timeline items to verify "via {agent_name}" text
5. Verify parent-agent messages have no badge or "via" annotation

---

## Step 4: Deliverable

Produce a summary report with:
1. Pre-commit hook results (pass/fail)
2. Code review findings (in-scope issues + out-of-scope flag)
3. Browser validation screenshots and pass/fail per acceptance criterion
4. Overall recommendation (approve / request changes)
