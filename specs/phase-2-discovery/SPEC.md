---
task: Agent Discovery Experience (Feature #885-P2)
test_command: "cd backend && make test"
---

# Task: Agent Discovery Experience (Phase 2 - Feature #885)

> **IMPORTANT**: Before implementing this feature, READ `/CLAUDE.md` first.

Enhance the public agent browsing experience with sorting, tagging, and a dedicated "Discover" tab. This builds on Phase 1's fork infrastructure to make finding and remixing agents intuitive.

## Requirements

1. Add `tags: list[str] = []` field to `Assistant` model and expose in `PublicAssistant` projection
2. Enhance `GET /assistants/public` with `sort_by` parameter (`fork_count`, `updated_at`, `published_at`)
3. Add optional `tags` filter to `GET /assistants/public` endpoint
4. Add "Discover" tab to `/agents` page showing public agents with enhanced browsing
5. Agent cards show: name, description, model, fork_count badge, tags, "Remix" button
6. Sort dropdown: "Most Remixed", "Newest", "Recently Updated"

## Success Criteria

1. [ ] `Assistant` model has `tags: list[str] = []` field
2. [ ] `PublicAssistant` projection includes `tags`
3. [ ] `GET /assistants/public?sort_by=fork_count` returns agents ordered by fork count descending
4. [ ] `GET /assistants/public?sort_by=published_at` returns newest-published first
5. [ ] `GET /assistants/public?sort_by=updated_at` returns most-recently-updated first
6. [ ] `GET /assistants/public?tags=coding,writing` filters to agents matching any listed tag
7. [ ] Frontend "Discover" tab in `/agents` shows public agents from all users
8. [ ] Sort dropdown controls ordering (default: "Most Remixed")
9. [ ] Agent cards display tags as chips/badges
10. [ ] `make test` passes with no regressions
11. [ ] `make format && make lint` passes

## Backend Implementation Details

### Schema Changes (`backend/src/schemas/entities/llm.py`)

```python
# Add to Assistant model:
tags: list[str] = Field(default_factory=list)

# Add to PublicAssistant:
tags: list[str] = Field(default_factory=list)

# Update PublicAssistant.from_assistant() to include tags
```

### Service Changes (`backend/src/services/assistant.py`)

```python
async def search_public(
    self,
    limit: int = 100,
    offset: int = 0,
    sort_by: str = "published_at",
    tags: list[str] | None = None,
) -> list:
    # Existing search logic + sort + filter
    # Sort in-memory after retrieval (store doesn't support ORDER BY)
    # Filter by tags intersection if provided
```

### Route Changes (`backend/src/routes/v0/assistant.py`)

```
GET /assistants/public?sort_by=fork_count&tags=coding,writing&limit=50&offset=0
- sort_by: Query[str] = "published_at" (enum: fork_count, updated_at, published_at)
- tags: Query[str] = None (comma-separated)
```

## Frontend Implementation Details

### Agent Index Page (`frontend/src/pages/agents/index.tsx`)

- Rename "public-agents" tab to "Discover" or add as third tab
- Add sort dropdown: "Most Remixed" (fork_count), "Newest" (published_at), "Recently Updated" (updated_at)
- Pass sort_by and tags params to `AgentService.listPublic()`
- Agent cards: add tag chips below description, fork_count badge, inline "Remix" button

### AgentService (`frontend/src/lib/services/agentService.ts`)

```typescript
static async listPublic(
  limit: number = 50,
  offset: number = 0,
  sortBy: string = "fork_count",
  tags?: string[]
): Promise<Agent[]>
```

## Example Output

```bash
# List public agents sorted by most remixed
curl "http://localhost:8000/api/assistants/public?sort_by=fork_count&limit=10"
# Response: [{"id": "...", "name": "Code Reviewer", "fork_count": 42, "tags": ["coding", "review"], ...}]

# Filter by tags
curl "http://localhost:8000/api/assistants/public?tags=writing,creative"
# Response: agents matching "writing" OR "creative" tag
```

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run tests after changes
4. Commit your changes frequently
5. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
6. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
