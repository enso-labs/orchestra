# PRD: Agent Marketplace — Fork/Remix, Discovery, Embed Widget & Memory Distillation

## Introduction

Every public Orchestra agent is currently a dead end. Users can chat with it but can't own it, customize it, or embed it on their site. There's no path from "I found a cool agent" to "I'm an Orchestra user." Meanwhile, conversation intelligence dies after each session — langmem is installed but disconnected from the conversation lifecycle.

This feature set creates a self-reinforcing flywheel: published agents drive user acquisition (via fork/embed), forked agents accumulate usage data, and that data automatically improves agent prompts via background distillation. The public agent infrastructure is 80% built — fork/remix adds the missing viral loop.

**Specs:** `specs/phase-1-fork-remix/`, `specs/phase-2-discovery/`, `specs/phase-3-embed-widget/`, `specs/phase-4-memory-distillation/`

## Goals

- Enable one-click remixing of any public agent into a user's workspace (GitHub-for-agents growth model)
- Convert public agent views into registered users via the remix-to-signup funnel
- Make discovering, sorting, and filtering public agents intuitive with tags and popularity ranking
- Allow agent creators to embed their agents on external websites via a lightweight chat widget
- Auto-improve agent prompts over time by distilling conversation trajectories via langmem
- Show visible attribution ("Remixed from [Original]") to create social proof and discoverability

## User Stories

### US-001: Backend — Add fork_count and forked_from fields to Assistant schema
**Description:** As a developer, I need the Assistant model to track fork lineage so we can count remixes and trace origins.

**Acceptance Criteria:**
- [ ] `Assistant` model has `fork_count: int = 0` field (after `published_at` in `backend/src/schemas/entities/llm.py`)
- [ ] `PublicAssistant` projection includes `fork_count`
- [ ] `PublicAssistant.from_assistant()` maps `fork_count` correctly
- [ ] Existing tests pass (`make test`)
- [ ] Lint passes (`make format && make lint`)

### US-002: Backend — Implement AssistantService.fork() method
**Description:** As a user, I want to fork a public agent into my workspace so I can customize it without affecting the original.

**Acceptance Criteria:**
- [ ] `fork(public_assistant_id, target_user_id)` reads from `("public", "assistants")` namespace
- [ ] Validates source assistant exists and is public, raises 404 otherwise
- [ ] Deep-copies assistant data, generates new UUID
- [ ] Strips `owner_id`, `published_at`, sets `public=False` on the copy
- [ ] Sets `metadata["forked_from"] = public_assistant_id`
- [ ] Writes new assistant to `(target_user_id, "assistants")` namespace
- [ ] Increments `fork_count` on source assistant in public namespace
- [ ] Returns new `assistant_id` string
- [ ] Existing tests pass (`make test`)

### US-003: Backend — Add POST /assistants/public/{assistant_id}/fork endpoint
**Description:** As a frontend developer, I need an API endpoint to trigger agent forking from the UI.

**Acceptance Criteria:**
- [ ] `POST /assistants/public/{assistant_id}/fork` requires authentication
- [ ] Calls `AssistantService.fork()` with current `user_id`
- [ ] Returns `{"assistant_id": "<new_id>"}` with 201 status code
- [ ] Returns 404 for non-existent or non-public assistants
- [ ] Existing tests pass (`make test`)

### US-004: Frontend — Add fork() method to AgentService and Remix button
**Description:** As a user viewing a public agent, I want a "Remix this Agent" button so I can fork it into my workspace with one click.

**Acceptance Criteria:**
- [ ] `AgentService` has `static async fork(assistantId)` method calling `POST /assistants/public/{id}/fork`
- [ ] Public agent page (`/a/{agentId}`) shows "Remix this Agent" button in `AgentSection`
- [ ] Authenticated click: calls fork API, redirects to edit page for the new agent
- [ ] Unauthenticated click: redirects to `/login?remix={agentId}`
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using agent-browser skill

### US-005: Frontend — Post-login auto-fork flow
**Description:** As an unauthenticated user who clicked Remix, I want to be auto-forked into the agent after I log in or register.

**Acceptance Criteria:**
- [ ] Login page reads `remix` query param from URL
- [ ] Register page reads `remix` query param from URL
- [ ] After successful auth with `remix` param: calls fork API automatically
- [ ] Redirects to edit page of the newly forked agent
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using agent-browser skill

### US-006: Frontend — Show fork_count badge and "Remixed from" attribution
**Description:** As a user browsing public agents, I want to see remix counts for social proof, and as a user viewing a forked agent, I want to see where it originated.

**Acceptance Criteria:**
- [ ] Public agent cards in `/agents` public tab show fork_count badge when > 0
- [ ] Badge shows count (e.g., "12 remixes")
- [ ] Forked agents display "Remixed from [Original Agent Name]" with link to `/a/{originalId}` in edit page header
- [ ] Attribution link only appears when `metadata.forked_from` exists
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using agent-browser skill

### US-007: Backend — Unit tests for fork functionality
**Description:** As a developer, I need tests covering the fork flow to prevent regressions.

**Acceptance Criteria:**
- [ ] Test: fork creates new assistant in target user namespace
- [ ] Test: fork increments `fork_count` on source assistant
- [ ] Test: forked assistant has `forked_from` in metadata
- [ ] Test: fork of non-existent assistant raises appropriate error
- [ ] All tests pass (`make test`)
- [ ] Lint passes (`make format && make lint`)

### US-008: Backend — Add tags field and sort/filter params to public search
**Description:** As a user browsing public agents, I want to sort by popularity and filter by category tags so I can find relevant agents quickly.

**Acceptance Criteria:**
- [ ] `Assistant` model has `tags: list[str] = []` field
- [ ] `PublicAssistant` projection includes `tags`
- [ ] `GET /assistants/public` accepts `sort_by` query param (`fork_count`, `updated_at`, `published_at`)
- [ ] Default `sort_by` is `published_at` (backwards compatible)
- [ ] `GET /assistants/public` accepts `tags` query param (comma-separated)
- [ ] Tags filter returns agents matching ANY of the provided tags
- [ ] `sort_by=fork_count` returns agents ordered descending
- [ ] Existing tests pass (`make test`)

### US-009: Frontend — Discover tab with sorting, tags, and Remix button
**Description:** As a user, I want a Discover tab in the agents page with sorting and tag chips so I can browse and remix agents easily.

**Acceptance Criteria:**
- [ ] "Discover" tab in `/agents` page shows public agents from all users
- [ ] Sort dropdown: "Most Remixed" (`fork_count`), "Newest" (`published_at`), "Recently Updated" (`updated_at`)
- [ ] Agent cards display tag chips below description
- [ ] Each card has inline "Remix" button
- [ ] `AgentService.listPublic()` accepts `sortBy` and `tags` parameters
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using agent-browser skill

### US-010: Frontend — Tag editing in assistant editor
**Description:** As an agent creator, I want to add tags when editing my agent so it appears in relevant searches after publishing.

**Acceptance Criteria:**
- [ ] Agent edit form includes a tags input (comma-separated or chip input)
- [ ] Tags are saved with the assistant on update
- [ ] Tags display correctly when loading existing agents for editing
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using agent-browser skill

### US-011: Backend — Embed config and token endpoints
**Description:** As an agent creator, I need API endpoints to configure embedding and generate access tokens so my agent can be embedded on external sites.

**Acceptance Criteria:**
- [ ] `GET /assistants/public/{id}/embed` returns `{agent_id, name, description, model, theme}` without auth
- [ ] Returns 404 for non-public agents
- [ ] `POST /assistants/public/{id}/embed-token` requires auth and validates caller is `owner_id`
- [ ] Returns 403 if caller is not the agent owner
- [ ] Embed token is a signed JWT containing `{agent_id, rate_limit, exp}`
- [ ] Existing tests pass (`make test`)

### US-012: Backend — Embed chat streaming endpoint with rate limiting
**Description:** As an embedded widget, I need a chat endpoint that accepts embed tokens and streams responses within rate limits.

**Acceptance Criteria:**
- [ ] `POST /assistants/public/{id}/embed-chat` accepts embed JWT in Authorization header
- [ ] Validates JWT signature and expiry
- [ ] Streams response using existing streaming infrastructure
- [ ] Returns `thread_id` for conversation continuity
- [ ] Rate-limits per token via Redis counter keyed by `embed:{agent_id}:{token_jti}`
- [ ] Returns 429 when rate limit exceeded
- [ ] Anonymous chat allowed with aggressive rate limits (e.g., 10 messages/day without token, 100/day with token)
- [ ] Existing tests pass (`make test`)

### US-013: Frontend — Standalone embed widget build and UI
**Description:** As a website owner, I want to add a single script tag to my site that renders a floating chat widget connected to my Orchestra agent.

**Acceptance Criteria:**
- [ ] Separate `vite.embed.config.ts` produces `frontend/dist/embed/embed.js`
- [ ] Bundle is IIFE format, <50KB gzipped
- [ ] Widget reads `data-agent-id` from its own script tag
- [ ] Floating button renders in bottom-right corner, expands to chat panel
- [ ] Messages stream from embed-chat endpoint
- [ ] Thread ID stored in localStorage for conversation continuity
- [ ] "Powered by Orchestra" footer links to `/a/{agentId}`
- [ ] Widget uses shadow DOM or scoped styles (no CSS leaks)
- [ ] `npm run build:embed` produces the bundle

### US-014: Frontend — Embed code snippet in agent editor
**Description:** As an agent creator, I want to see copy-paste embed code in my agent editor so I can quickly add the widget to my website.

**Acceptance Criteria:**
- [ ] Agent edit page shows "Embed" section for published agents only
- [ ] Section contains copy-to-clipboard `<script>` tag snippet with correct agent ID
- [ ] Hidden for unpublished agents
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using agent-browser skill

### US-015: Backend — Trajectory extraction TaskIQ task and stream hook
**Description:** As a system, I need to automatically extract conversation trajectories after each session so they feed into prompt optimization.

**Acceptance Criteria:**
- [ ] `extract_trajectory` TaskIQ task accepts `thread_id`, `user_id`, `assistant_id`
- [ ] Loads conversation messages from thread
- [ ] Derives quality signals: conversation length, tool success/failure rate, HITL rejections
- [ ] Formats data as `AnnotatedTrajectory` (`langmem.prompts.types`)
- [ ] Stores trajectory in `(user_id, "trajectories", assistant_id)` namespace in `AsyncPostgresStore`
- [ ] `_persist_final_state()` dispatches `extract_trajectory` task after persisting state (non-blocking)
- [ ] Extraction failure does not affect conversation persistence
- [ ] Existing tests pass (`make test`)

### US-016: Backend — PromptOptimizer.distill() and auto-apply
**Description:** As a system, I need to distill accumulated trajectories into improved prompts and auto-apply them so agents get better with usage.

**Acceptance Criteria:**
- [ ] `distill(user_id, assistant_id)` retrieves recent trajectories from store
- [ ] Runs existing `PromptOptimizer.optimize()` with retrieved trajectories
- [ ] Auto-applies: stores optimized prompt as new active revision via `PromptService.revision()`
- [ ] Updates the assistant's `system_prompt` field with the distilled prompt
- [ ] Returns `revision_id` or `None` if no improvement detected
- [ ] Handles edge case: no trajectories available (returns `None` gracefully)
- [ ] Existing tests pass (`make test`)

### US-017: Backend — Scheduled daily distillation and manual trigger
**Description:** As an agent creator, I want my agent to auto-improve daily, and I want the ability to trigger optimization manually.

**Acceptance Criteria:**
- [ ] Scheduled job type `prompt_distillation` added to APScheduler infrastructure
- [ ] Runs daily (`CronTrigger(hour=3)`) for agents with accumulated trajectories
- [ ] Skips agents with no new trajectories since last distillation
- [ ] `POST /assistants/{id}/distill` requires auth, validates ownership
- [ ] Returns `{revision_id, status: "completed" | "no_improvement"}`
- [ ] Job errors are logged but don't crash the scheduler
- [ ] Existing tests pass (`make test`)

### US-018: Tests for embed and distillation features
**Description:** As a developer, I need tests covering embed tokens, rate limiting, trajectory extraction, and distillation to prevent regressions.

**Acceptance Criteria:**
- [ ] Test: embed config returns correct fields for public agent
- [ ] Test: embed token generation validates ownership
- [ ] Test: embed chat rejects expired/invalid tokens
- [ ] Test: rate limiting returns 429 after threshold
- [ ] Test: trajectory extraction formats messages correctly
- [ ] Test: `distill()` creates new prompt revision when trajectories exist
- [ ] Test: `distill()` returns `None` when no trajectories
- [ ] All tests pass (`make test`)
- [ ] Lint passes (`make format && make lint`)

## Functional Requirements

- FR-1: `POST /assistants/public/{id}/fork` deep-copies a public assistant into the authenticated user's namespace, strips ownership fields, sets `metadata.forked_from`, increments source `fork_count`, and returns the new ID with 201
- FR-2: Forked agents display "Remixed from [Original Agent]" with link in the edit page header when `metadata.forked_from` exists
- FR-3: Public agent cards show `fork_count` badge when > 0
- FR-4: Public agent page (`/a/{agentId}`) shows "Remix this Agent" button; unauthenticated users are redirected to login with `?remix={id}` and auto-forked post-auth
- FR-5: `GET /assistants/public` accepts `sort_by` (enum: `fork_count`, `updated_at`, `published_at`) and `tags` (comma-separated) query params
- FR-6: `/agents` page has a "Discover" tab with sort dropdown and tag chip display on agent cards
- FR-7: `Assistant` model supports `tags: list[str]` editable from the agent editor
- FR-8: `GET /assistants/public/{id}/embed` returns embed config JSON without auth
- FR-9: `POST /assistants/public/{id}/embed-token` generates a signed JWT (owner-only) with rate limit and expiry
- FR-10: `POST /assistants/public/{id}/embed-chat` streams responses using embed JWT auth, rate-limited via Redis; anonymous access allowed with aggressive limits
- FR-11: `embed.js` is a self-initializing IIFE (<50KB gzipped) that renders a floating chat widget reading `data-agent-id` from the script tag
- FR-12: Agent edit page shows copy-paste embed snippet for published agents
- FR-13: After each conversation, `_persist_final_state()` dispatches a non-blocking TaskIQ task to extract `AnnotatedTrajectory` with quality signals
- FR-14: `PromptOptimizer.distill()` retrieves accumulated trajectories and auto-applies optimized prompts as new active revisions
- FR-15: Scheduled daily distillation runs at 3 AM via APScheduler for agents with new trajectories
- FR-16: `POST /assistants/{id}/distill` allows manual trigger of prompt distillation (owner-only)

## Non-Goals

- No workflow engine / DAG chaining of agents (Phase 5 — deferred until marketplace demand validates)
- No paid marketplace or revenue sharing between agent creators
- No agent versioning beyond the existing prompt revision system
- No collaborative editing of agents (single owner model)
- No automatic tag suggestion or AI-generated tags
- No custom branding/theming for embed widgets beyond light/dark
- No A/B testing of distilled prompts (auto-apply only per user preference)
- No cross-user trajectory sharing or global prompt optimization

## Design Considerations

- Reuse existing `PublicAssistant` projection pattern for new fields (`fork_count`, `tags`)
- "Remix this Agent" button should use existing button component styles, placed prominently in `AgentSection` before chat starts
- Discover tab should feel like a natural extension of the existing `/agents` tabbed layout
- Tag chips should use existing badge/chip component from shadcn
- Embed widget must be visually self-contained — shadow DOM or heavily scoped CSS to prevent leaks to host page
- "Powered by Orchestra" footer in embed widget is a growth channel — make it attractive, not annoying
- Fork attribution ("Remixed from X") should be subtle but clickable in the agent edit page header

## Technical Considerations

- **Store limitations:** `AsyncPostgresStore` doesn't support ORDER BY — sorting by `fork_count`/dates must happen in-memory after retrieval. Acceptable for current scale; revisit if public agent count exceeds ~10K
- **Fork atomicity:** Incrementing `fork_count` on the source and creating the new assistant are two separate store operations. Accept eventual consistency for now
- **Embed JWT:** Use PyJWT with the existing server secret. Token contains `agent_id`, `rate_limit`, `jti`, `exp`. Rate limit enforced via Redis `INCR` + `EXPIRE`
- **Embed bundle size:** Target <50KB gzipped by using a minimal React subset or Preact, no router, no state management library. Separate Vite config with aggressive tree-shaking
- **langmem integration:** `AnnotatedTrajectory` from `langmem.prompts.types` is already importable. `PromptOptimizer.optimize()` at `backend/src/services/prompt/optimize.py:72` is the base to extend
- **Trajectory extraction:** Non-blocking via TaskIQ dispatch from `_persist_final_state()`. Failures must be swallowed — never break conversation persistence
- **Scheduled distillation:** Rides on existing APScheduler + `CronTrigger` infrastructure in `backend/src/services/schedule.py`

## Success Metrics

- Fork conversion rate: >5% of public agent viewers click "Remix"
- Signup conversion: >20% of unauthenticated "Remix" clicks complete registration
- Discovery engagement: average session on Discover tab >60 seconds
- Embed adoption: >10% of published agents generate embed tokens within 30 days
- Distillation impact: agents with >10 conversations show measurable prompt improvement (lower follow-up question rate)

## Open Questions

- Should there be a limit on how many times a single user can fork the same agent?
- Should forked agents be forkable themselves (chain forking), and if so, does attribution show the full chain or just the immediate parent?
- What is the right default rate limit for anonymous embed chat? (Spec says 10/day anonymous, 100/day with token — validate with usage data)
- Should the distillation schedule be configurable per-agent, or is daily-at-3AM sufficient for all?
- How should we handle embed widget updates — cache-bust via versioned URL or rely on short cache TTL?
