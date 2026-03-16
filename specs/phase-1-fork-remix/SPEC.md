---
task: Agent Fork/Remix (Feature #885-P1)
test_command: "cd backend && make test"
---

# Task: Agent Fork/Remix (Phase 1 - Feature #885)

> **IMPORTANT**: Before implementing this feature, READ `/CLAUDE.md` first.

Enable any authenticated user to "remix" (fork) a public agent into their own workspace. This is the single highest-ROI feature: it converts every public agent into a user acquisition funnel. The public agent infrastructure is 80% built; fork adds the missing viral loop.

## Requirements

1. Add `fork()` method to `AssistantService` that deep-copies a public assistant into a target user's namespace
2. Add `fork_count: int` field to `Assistant` model and expose it in `PublicAssistant` projection
3. Add `forked_from: Optional[str]` convention in `Assistant.metadata`
4. Add `POST /assistants/public/{assistant_id}/fork` endpoint (requires auth)
5. Add `fork(assistantId)` method to frontend `AgentService`
6. Add "Remix this Agent" button on public agent page (`/a/{agentId}`)
7. Handle unauthenticated remix flow: redirect to login with `remix` query param, auto-fork after auth

## Success Criteria

1. [ ] `AssistantService.fork(public_assistant_id, target_user_id)` creates a new assistant in the target user's namespace with `forked_from` in metadata
2. [ ] Source assistant's `fork_count` increments on each successful fork
3. [ ] Forked assistant strips `owner_id`, `published_at`, `public` fields and generates a new UUID
4. [ ] `POST /assistants/public/{assistant_id}/fork` returns `{"assistant_id": "<new_id>"}` with 201 status
5. [ ] Fork endpoint returns 404 for non-existent or non-public assistants
6. [ ] Frontend "Remix this Agent" button appears on `/a/{agentId}` page in `AgentSection`
7. [ ] Authenticated click: calls fork API, redirects to `/assistants/{newId}` edit page
8. [ ] Unauthenticated click: redirects to `/login?remix={agentId}`, post-login auto-forks and redirects
9. [ ] `fork_count` badge visible on public agent cards in `/agents` public tab
10. [ ] `make test` passes with no regressions
11. [ ] `make format && make lint` passes

## Backend Implementation Details

### Schema Changes (`backend/src/schemas/entities/llm.py`)

```python
# Add to Assistant model (after line 120):
fork_count: int = 0

# Add to PublicAssistant (after published_at):
fork_count: int = 0

# Update PublicAssistant.from_assistant() to include fork_count
```

### Service Method (`backend/src/services/assistant.py`)

```python
async def fork(self, public_assistant_id: str, target_user_id: str) -> str:
    """Fork a public assistant into a user's namespace."""
    # 1. Read from ("public", "assistants") namespace
    # 2. Validate assistant exists and is public
    # 3. Deep-copy assistant data
    # 4. Strip: owner_id, published_at, public=False
    # 5. Generate new UUID
    # 6. Set metadata["forked_from"] = public_assistant_id
    # 7. Write to (target_user_id, "assistants") namespace
    # 8. Increment fork_count on source in public namespace
    # 9. Return new assistant_id
```

### Route (`backend/src/routes/v0/assistant.py`)

```
POST /assistants/public/{assistant_id}/fork
- Requires: auth (get current user_id from token)
- Calls: AssistantService("public").fork(assistant_id, user_id)
- Returns: {"assistant_id": str} with 201
- Errors: 404 if not found/not public
```

## Frontend Implementation Details

### Service (`frontend/src/lib/services/agentService.ts`)

```typescript
static async fork(assistantId: string): Promise<{ assistant_id: string }> {
    const response = await api.post(`/assistants/public/${assistantId}/fork`);
    return response.data;
}
```

### Public Agent Page (`frontend/src/pages/agents/public.tsx`)

- Add "Remix this Agent" button in `AgentSection` component
- If user authenticated: call `AgentService.fork()`, navigate to edit page
- If not authenticated: redirect to `/login?remix={agentId}`

### Login/Register Flow

- Read `remix` query param from URL
- After successful auth, if `remix` param exists: call fork endpoint, redirect to edit page

## Example Output

```bash
# Fork a public agent
curl -X POST http://localhost:8000/api/assistants/public/abc-123/fork \
  -H "Authorization: Bearer <token>"
# Response: {"assistant_id": "new-uuid-456"}

# Verify forked agent in user's workspace
curl -X POST http://localhost:8000/api/assistants/search \
  -H "Authorization: Bearer <token>" \
  -d '{}'
# Response includes agent with metadata.forked_from = "abc-123"
```

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run tests after changes
4. Commit your changes frequently
5. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
6. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
