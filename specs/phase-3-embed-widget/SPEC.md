---
task: Embeddable Agent Widget (Feature #885-P3)
test_command: "cd backend && make test && cd ../frontend && npm run build"
---

# Task: Embeddable Agent Widget (Phase 3 - Feature #885)

> **IMPORTANT**: Before implementing this feature, READ `/CLAUDE.md` first.

Allow agent creators to embed their published agents on external websites via a lightweight chat widget. This turns every Orchestra agent into a lead-generation tool — the "Powered by Orchestra" footer drives traffic back to the platform.

## Requirements

1. Backend: `GET /assistants/public/{assistant_id}/embed` returns embed configuration JSON
2. Backend: `POST /assistants/public/{assistant_id}/embed-token` (auth, owner only) returns a signed JWT with agent_id, rate_limit, and expiry
3. Backend: Streaming chat endpoint that accepts embed tokens instead of user auth
4. Frontend: Standalone Vite entry point for the embed widget (`frontend/src/embed/index.tsx`)
5. Frontend: Minimal chat widget (<50KB bundle) — floating button + expandable chat panel
6. Frontend: Loadable via `<script src="https://chat.ruska.ai/embed.js" data-agent-id="...">`
7. Frontend: "Powered by Orchestra" footer linking to `/a/{agentId}`
8. Frontend: Embed code snippet section in agent edit page for published agents

## Success Criteria

1. [ ] `GET /assistants/public/{id}/embed` returns `{agent_id, name, description, theme}` without auth
2. [ ] `POST /assistants/public/{id}/embed-token` requires auth and validates caller is the agent owner
3. [ ] Embed token is a JWT containing `{agent_id, rate_limit, exp}` signed with server secret
4. [ ] Embed chat endpoint accepts embed JWT and streams responses (rate-limited per token)
5. [ ] Embed widget renders as floating button that expands to chat panel
6. [ ] Widget bundle is <50KB gzipped (separate Vite build target)
7. [ ] Widget loads via script tag with `data-agent-id` attribute
8. [ ] "Powered by Orchestra" footer links to public agent page
9. [ ] Agent edit page shows embed code snippet for published agents
10. [ ] Rate limiting returns 429 after threshold per embed token
11. [ ] `make test` passes with no regressions
12. [ ] `make format && make lint` passes

## Backend Implementation Details

### Embed Config Endpoint (`backend/src/routes/v0/assistant.py`)

```
GET /assistants/public/{assistant_id}/embed
- No auth required
- Returns: {agent_id, name, description, model, theme: "light"}
- 404 if not public
```

### Embed Token Endpoint

```
POST /assistants/public/{assistant_id}/embed-token
- Requires auth
- Validates caller is owner_id of the assistant
- Returns signed JWT: {agent_id, rate_limit: 100, exp: 24h}
- 403 if not owner
```

### Embed Chat Endpoint

```
POST /assistants/public/{assistant_id}/embed-chat
- Accepts: Authorization: Bearer <embed-jwt>
- Body: {message: str, thread_id?: str}
- Validates JWT signature and expiry
- Rate-limits per token (e.g., 100 messages/day)
- Streams response using existing streaming infrastructure
- Returns new thread_id if not provided
```

### Rate Limiting

- Use Redis counter keyed by `embed:{agent_id}:{token_jti}` with TTL matching token expiry
- Increment on each chat request, reject with 429 when over limit

## Frontend Implementation Details

### Embed Entry Point (`frontend/src/embed/index.tsx`)

- Separate Vite build config producing `embed.js`
- Self-initializing: reads `data-agent-id` from script tag
- Fetches embed config from `/api/assistants/public/{id}/embed`
- Renders floating button (bottom-right corner)
- Click expands to chat panel with message input
- Streams responses via fetch to embed-chat endpoint
- Stores thread_id in localStorage for conversation continuity
- "Powered by Orchestra" footer with link to `/a/{agentId}`

### Vite Config (`frontend/vite.embed.config.ts`)

```typescript
// Separate build config for embed widget
export default defineConfig({
  build: {
    lib: { entry: 'src/embed/index.tsx', formats: ['iife'], name: 'OrchestraEmbed' },
    outDir: 'dist/embed',
    rollupOptions: { /* tree-shake to <50KB */ }
  }
})
```

### Embed Code Snippet Section (`frontend/src/pages/agents/edit.tsx`)

- Show only for published agents
- Copy-to-clipboard code snippet:
  ```html
  <script src="https://chat.ruska.ai/embed.js" data-agent-id="<id>"></script>
  ```
- Preview button to test widget locally

## Example Output

```html
<!-- Embed on any website -->
<script src="https://chat.ruska.ai/embed.js" data-agent-id="abc-123"></script>

<!-- Widget renders as floating chat button -->
<!-- Clicking opens chat panel connected to the public agent -->
<!-- "Powered by Orchestra" footer links back to chat.ruska.ai/a/abc-123 -->
```

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run tests after changes
4. Commit your changes frequently
5. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
6. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
