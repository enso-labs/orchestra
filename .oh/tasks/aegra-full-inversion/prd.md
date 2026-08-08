# PRD: Aegra Full Inversion

> Source plan: `.claude/plans/task-draft-plan-to-enchanted-puppy.md` (approved).
> Target repo: `mifunedev/orchestra`, base branch `development`.
> Work happens in worktrees under `.oh/worktrees/project/mifunedev/orchestra-<slug>` — never in the
> primary checkout, which runs the operator's dev stack on `:5173`/`:8000`.

## Introduction

Orchestra has hand-built a private version of the LangGraph Platform: a thread store, a run state
machine, a distributed taskiq worker with idempotency/DLQ/drain, an SSE replay layer over Redis
Streams, a 627-LOC resilient checkpointer, an APScheduler cron, an abort protocol, and ~970 LOC of
bespoke SSE plumbing in the browser. All of it is load-bearing, none of it is the product, and it has
generated its own tail of bugs (#957, #958, #959, #974 all live in this layer).

[Aegra](https://github.com/aegra/aegra) is an Apache-2.0 self-hosted Agent Protocol server —
FastAPI + Postgres + Redis, LangGraph-native — that ships every one of those as maintained
infrastructure. This PRD replaces Orchestra's custom runtime with it: Aegra becomes the backend host
process, Orchestra's agent becomes a factory graph, Orchestra's app-specific routers mount as Aegra
custom routes, and the frontend adopts `@langchain/langgraph-sdk`.

## Goals

- Delete ~4.5k LOC of backend runtime and ~1k LOC of frontend transport, replacing them with
  maintained upstream infrastructure.
- Preserve Orchestra's genuinely differentiated code untouched: sandbox backends, the custom
  middleware stack, tools, prompts, projects, RAG, storage, settings.
- Collapse the two near-identical agent-construction paths (`LLMController.llm_invoke` and
  `_execute_agent_stream`) into one factory.
- Reach the cut-over with a rollback that is `git revert` at every stage but one, and a rehearsed
  database restore at that one.
- Lose no existing data: every checkpoint and every store row survives.

## Verified findings that shape this work

Read from Aegra's source via `gh api repos/aegra/aegra`, not from its docs. Three assumptions were
wrong and one was missing entirely.

| Finding | Consequence |
|---|---|
| `core/database.py:60-88` uses LangGraph's own `AsyncPostgresSaver` + `AsyncPostgresStore` | **No data migration.** Existing `store`, `store_vectors`, `checkpoints*` rows survive first boot. |
| `apply_namespace_scoping()` (`api/store.py:282-303`) is called only from `/store/*` REST handlers | **Zero entity repos change.** In-process callers get the raw store. No `store.scopes` config. |
| `core/auth_middleware.py:252-260` passes `@auth.authenticate` **headers only** | Orchestra's body-dependent auth cannot live there; it moves to `@auth.on.threads.create_run`. |
| `routes/v0/__init__.py:63-66` registers a catch-all `@app.get("/{filename:path}")`; Aegra sets `application = user_app` then appends core routers (`main.py:335-355`) | The catch-all would shadow **every** Agent Protocol GET with a 200 `index.html`. Silent failure. |
| Both alembic chains default to `alembic_version`; Aegra migrates on startup | Boot failure against a shared DB, not a manual one. Must be fixed first. |

## User Stories

Ordering is strict: stories must land in numeric order. US-004 through US-011 may be *reviewed* in
parallel but must *merge* in sequence.

---

### Stage 0 — Ground preparation

#### US-001: Isolate Orchestra's alembic version table

**Description:** As an operator, I need Orchestra's migration chain to use its own version table so
Aegra's chain can coexist in the same database without a boot failure.

**Acceptance Criteria:**

- [ ] `version_table="orchestra_alembic_version"` added to **both** `context.configure(...)` calls in
      `backend/migrations/env.py` (offline at `:85`, online at `:102`)
- [ ] A runbook step documents the one-time
      `ALTER TABLE alembic_version RENAME TO orchestra_alembic_version;` — written as a runbook step,
      **not** as an alembic revision (it must run outside either chain)
- [ ] `make migrate.up` then `make migrate.down` both complete cleanly against a restored dump
- [ ] `SELECT * FROM orchestra_alembic_version` returns the current head after upgrade
- [ ] Typecheck/lint passes

#### US-002: Mark superseded issues and clear unrelated queue items

**Description:** As a maintainer, I want the issue queue to reflect what this migration deletes, so
nobody spends effort fixing code that is scheduled for removal.

**Acceptance Criteria:**

- [ ] #974 and #959 each receive a comment stating they are superseded by the Aegra migration, citing
      that `services/schedule.py` is deleted in US-024, and are labelled/closed accordingly
- [ ] #951 (notebook conflict markers) is shipped as its own PR, entangled with nothing else
- [ ] The five frontend issues (#971, #970, #969, #967, #960) are confirmed to touch no file in the
      US-024 deletion list, and are left open for independent scheduling
- [ ] No new GitHub issues are created without operator authorization

---

### Stage 1 — Sidecar

#### US-003: Stand up an Aegra sidecar against a copy database

**Description:** As a developer, I want Aegra running beside the live stack against a restored copy of
the database, so every subsequent stage can be validated without risking production data.

**Acceptance Criteria:**

- [ ] `lg_template_aegra` created via `pg_dump`/`pg_restore` from `lg_template_dev`
- [ ] New **additive** file `infra/docker-compose.aegra.yml` runs `aegra-api` on `:2026` against the
      copy; `infra/docker-compose.yml` is not modified
- [ ] Minimal `aegra.json` with a hello-world graph; `make dev.aegra.up` / `dev.aegra.down` targets added
- [ ] `GET :2026/health` returns `{"status": "healthy"}`
- [ ] Aegra's alembic chain applies cleanly; `SELECT count(*) FROM checkpoints` on the copy is
      **unchanged** from the dump
- [ ] Pre-existing Orchestra store rows are readable through the sidecar's store
- [ ] The sidecar runs in a named tmux window, not in the foreground of an agent session

---

### Stage 2 — Auth

#### US-004: Port both credential paths into an Aegra auth handler

**Description:** As a user, I want my existing JWT and API key to keep working against the new server,
so the migration is invisible to me.

**Acceptance Criteria:**

- [ ] New `backend/aegra_auth.py` with `@auth.authenticate` handling the `x-api-key` branch
      (`ApiTokenRepo("system").get_by_hash_global()`, per `utils/auth.py:124-166`) and the Bearer JWT
      branch (`UserRepo.get_by_email`, per `utils/auth.py:187-236`)
- [ ] The scoped-session discipline from #955 (`utils/auth.py:136-138`) is preserved
- [ ] The handler returns `{"identity", "display_name", "email", "username", "is_authenticated", "permissions"}`
- [ ] `"auth": {"path": "./aegra_auth.py:auth"}` wired into `aegra.json`
- [ ] An existing production JWT authenticates against `:2026`
- [ ] An existing `otk_` API key authenticates against `:2026`
- [ ] Typecheck/lint passes

#### US-005: Make anonymous requests non-fatal

**Description:** As an anonymous visitor, I want share links and embedded assistants to work, so
public surfaces are not 401'd by the new auth layer.

**Acceptance Criteria:**

- [ ] `@auth.authenticate` **never raises** on missing or invalid credentials; it returns
      `{"identity": "anonymous", "is_authenticated": False}`
- [ ] Enforcement moves to per-route `require_auth` and `@auth.on.*` handlers
- [ ] An unauthenticated request to a share/embed route succeeds
- [ ] An unauthenticated request to a protected route returns 401
- [ ] Typecheck/lint passes

#### US-006: Re-home the body-dependent auth gates

**Description:** As a maintainer, I need the public-assistant bypass and the free-model gate to keep
enforcing, given that `@auth.authenticate` cannot see the request body.

**Acceptance Criteria:**

- [ ] `@auth.on.threads.create_run` implements the public-assistant bypass and `is_authorized_model()`
      free-model gate currently at `utils/auth.py:95-110`
- [ ] The handler overwrites `context.user_id` from `ctx.user.identity` before the run is created, so a
      client cannot forge it
- [ ] An anonymous run against a **public** assistant succeeds
- [ ] An anonymous run requesting a **paid** model returns **403** (not 401), with the "Please sign in
      for higher limits" copy relocated to match
- [ ] Typecheck/lint passes

#### US-007: Add tenancy filters to Aegra's own tables

**Description:** As a user, I must not be able to see another user's threads or assistants, because
Aegra's `thread`/`assistant` tables are not namespace-isolated the way the store is.

**Acceptance Criteria:**

- [ ] `@auth.on.threads.search`, `@auth.on.assistants.search`, and the corresponding `read`/`delete`
      handlers return `{"user_id": ctx.user.identity}` as a filter
- [ ] **Cross-tenant test:** user A's `GET /threads/search` returns zero of user B's threads
- [ ] **Cross-tenant test:** user A cannot read user B's thread by id
- [ ] Typecheck/lint passes

---

### Stage 3 — Factory graph (highest risk)

#### US-008: Build the factory graph with an execution guard

**Description:** As a developer, I want Orchestra's per-request agent construction expressed as an
Aegra factory graph, so Aegra can own the run loop.

**Acceptance Criteria:**

- [ ] New `backend/src/agents/factory.py` exporting
      `build_graph(config: RunnableConfig, runtime: ServerRuntime[ContextSchema])` as an
      `@asynccontextmanager` (the only form giving a post-run teardown hook)
- [ ] Registered as `"graphs": {"deepagent": "./src/agents/factory.py:build_graph"}`
- [ ] **First line of the body** is an `is_for_execution(runtime.access_context)` guard returning a
      cheap default graph for `threads.read` / `assistants.read` / schema extraction
- [ ] `user_id` is derived from `runtime.user.identity`, never from client-supplied config
- [ ] The factory returns the compiled agent **without a checkpointer** (Aegra injects it via
      `graph_obj.copy(update={...})` and would overwrite one)
- [ ] The Daytona sandbox is stopped on context-manager exit, closing the leak at
      `agents/__init__.py:269-276`
- [ ] **`GET /assistants/{id}/schemas` creates zero sandboxes**, asserted with a Daytona-client
      call-count spy
- [ ] `construct_agent`/`init_graph`/`Orchestra` remain in place and untouched — `:8000` keeps working
- [ ] Typecheck/lint passes

#### US-009: Collapse the duplicated construction paths into the factory

**Description:** As a maintainer, I want assistant resolution, user settings, memory prep, and backend
resolution to exist once instead of twice.

**Acceptance Criteria:**

- [ ] The factory performs, in order: `ServiceContext(user_id, runtime.store, config)` →
      `llm_service.assistant(params)` → `_resolve_user_settings()` → `prepare_memory_files()` +
      `select_memory_sources()` + `resolve_context_files()` → backend resolution →
      `init_default_middleware(...)`
- [ ] The backend is passed to `create_deep_agent` as a **callable**, not a resolved
      `CompositeBackend`, deleting the synthetic `ToolRuntime(tool_call_id="tc_runtime_init")` and
      `"tc_worker"` objects
- [ ] The callable form is used directly — **verified supported end-to-end**, no fallback needed:
      `deepagents 0.4.11` types the parameter
      `backend: BackendProtocol | Callable[[ToolRuntime], BackendProtocol] | None = None`, and
      `AutoEvictMiddleware._get_backend()` (`utils/middleware.py:207-218`) already resolves the callable
      per-`ToolRuntime`
- [ ] The custom middleware stack (`utils/middleware.py:337-350`) is passed through verbatim, unmodified
- [ ] A full turn with tools + a subagent + memory files produces the **same final message** on `:2026`
      as the identical input on `:8000`
- [ ] A **pre-migration** thread replays correctly through `aget_state_history`
- [ ] Typecheck/lint passes

#### US-010: Rebuild the runtime sandbox fallback as a FailoverBackend

**Description:** As a user, I want a mid-turn sandbox outage to degrade gracefully, because Aegra owns
the stream loop and the current rebuild-and-restart-the-turn mechanism cannot be ported.

**Acceptance Criteria:**

- [ ] New `FailoverBackend(BackendProtocol)` wraps a primary backend and flips to `StateBackend` on
      `DaytonaError` / `McpSandboxError` / `ConnectionError`, retrying **the single failed operation**
- [ ] Unit test injects a `DaytonaError` on the first `execute` and asserts the retry lands on
      `StateBackend`
- [ ] The behavior change is documented in `Changelog.md`: the model now sees one failed tool call
      instead of a full turn restart from message zero
- [ ] The existing integration tests asserting restart semantics
      (`controllers/llm.py:174-243`, `workers/tasks.py:657-700` coverage) are **rewritten before this
      story merges**, not after
- [ ] Typecheck/lint passes

#### US-011: Migrate the config surface off the wire

**Description:** As a maintainer, I want run configuration to live where it belongs, so tenancy cannot
be forged and project filtering is indexed.

**Acceptance Criteria:**

- [ ] `configurable.user_id` removed from the client wire format
- [ ] `project_id` moved to Aegra **thread metadata** (GIN-indexed per migration `20260428000000`), and
      project filtering is an indexed metadata query rather than a store scan
- [ ] `configurable.files` moved into run `input` (state, not config)
- [ ] model / system_prompt / instructions / tools / subagents / reasoning_effort moved to
      `assistant.config`; `stream_mode` becomes a native run parameter and `resolved_stream_mode` is dropped
- [ ] `max_concurrency` and `recursion_limit` set inside the factory
- [ ] `init_config()` (`agents/__init__.py:223-253`) deleted
- [ ] Typecheck/lint passes

---

### Stage 4 — Custom routes

#### US-012: Assemble the custom-routes app without a catch-all

**Description:** As a developer, I need Orchestra's app-specific routers mounted alongside the Agent
Protocol API without shadowing it.

**Acceptance Criteria:**

- [ ] New `backend/custom_app.py` exposing a `FastAPI()` that includes **only** the surviving routers
      under `/api`: auth, api_tokens, share, project, prompt, tool, storage, settings, memory, rag,
      config, info/health, the app-specific half of assistant (publish/fork/embed/distill), and the
      app-specific half of llm (transcribe, models, optimize)
- [ ] **No catch-all route is registered.** The SPA is served from nginx or a `StaticFiles` app at an
      explicit non-conflicting prefix
- [ ] `"http": {"app": "./custom_app.py:app", "enable_custom_route_auth": false}` wired into `aegra.json`
- [ ] **Gate:** `GET :2026/threads/search` returns **JSON, not HTML** — this is the single
      highest-value assertion in the migration
- [ ] `GET :2026/assistants` and `GET :2026/store/items` also return Agent Protocol JSON
- [ ] `POST :2026/api/auth/login` succeeds
- [ ] Typecheck/lint passes

#### US-013: Rewire the MCP server surface

**Description:** As an MCP client, I want Orchestra's tools to remain available, because Aegra has no
MCP server support today.

**Acceptance Criteria:**

- [ ] `FastMCP.from_fastapi(...)` built over the **custom-routes sub-app only** and mounted at `/mcp`
      inside `custom_app.py`
- [ ] Its lifespan is nested inside Orchestra's lifespan, which `merge_lifespans` preserves
- [ ] `GET :2026/mcp` lists exactly the `tags={"mcp"}` tools and nothing else
- [ ] The PR states explicitly that Agent Protocol routes are **not** MCP-exposed, and that this is an
      accepted loss since only `mcp`-tagged routes were exposed before
- [ ] Typecheck/lint passes

#### US-014: Preserve the merged lifespan concerns

**Description:** As an operator, I want the scheduler, cache, and correlation logging to keep working
once Aegra owns the app lifecycle.

**Acceptance Criteria:**

- [ ] The distillation APScheduler job survives in the merged user lifespan (executor migration is
      explicitly deferred — do not migrate trigger and executor in one PR)
- [ ] Correlation-ID middleware rebinds its ContextVar from Aegra's `run_id`; the header name is
      unchanged so `e2e/correlation-id.spec.ts` still passes
- [ ] Rate limiting is re-added as ASGI middleware on the merged app, **or** the PR states plainly that
      it is an accepted abuse-surface regression — Aegra does not provide it
- [ ] The merged lifespan starts and stops the scheduler cleanly, verified across a restart
- [ ] Typecheck/lint passes

---

### Stage 5 — Frontend cut-over (behind a flag)

#### US-015: Add the LangGraph SDK client behind a feature flag

**Description:** As a developer, I want the new transport to coexist with the old one so the cut-over
is a flag flip rather than a rewrite-and-pray.

**Acceptance Criteria:**

- [ ] `@langchain/langgraph-sdk` added to `frontend/package.json`
- [ ] New `frontend/src/lib/api/agentClient.ts`: singleton `new Client({ apiUrl, defaultHeaders })`
      with auth from the existing `getAuthToken()`
- [ ] `VITE_USE_AGENT_PROTOCOL` gates every new path; the flag defaults **off**
- [ ] Nothing is deleted in this story
- [ ] `npm run test` green with the flag **both** on and off
- [ ] `npx tsc -b` passes (note: `tsc --noEmit` is a no-op here — `tsconfig.json` is solution-style
      with `"files": []`)

#### US-016: Rewrite the chat stream consumer

**Description:** As a user, I want streaming to work through the Agent Protocol, so reconnection is
handled by the SDK instead of a hand-rolled retry ladder.

**Acceptance Criteria:**

- [ ] `hooks/useChat.ts` streams via `for await (const chunk of client.runs.stream(...))` when the flag
      is on, with `streamMode: ["messages-tuple", "values", "custom"]` and `streamSubgraphs: true`
- [ ] `context/ChatContext.tsx` is adapted through a single `adaptEvent()` shim so the reducer is
      untouched in this pass
- [ ] The plain-client form is used; `useStream` from `@langchain/langgraph-sdk/react` is explicitly
      deferred to a follow-up (it is a second rewrite)
- [ ] A full chat turn streams token-by-token with the flag on
- [ ] **Reconnect gate:** killing the connection mid-stream resumes from the `seq` cursor with **no
      duplicated and no dropped tokens**
- [ ] Cancel works via `client.runs.cancel(threadId, runId, wait, action)`
- [ ] `npx tsc -b` passes
- [ ] Verify in browser using agent-browser skill

#### US-017: Move thread listing and history onto the SDK

**Description:** As a user, I want the thread list and history to come from the Agent Protocol so
checkpoint history is available without extra endpoints.

**Acceptance Criteria:**

- [ ] `hooks/useThread.tsx` uses `client.threads.search()` and `client.threads.getHistory()` when the
      flag is on
- [ ] Thread list and per-thread history render correctly
- [ ] The split is documented: SDK `client.assistants.*` for the Agent Protocol half, Orchestra's
      custom routes for publish/fork/embed/distill
- [ ] `npx tsc -b` passes
- [ ] Verify in browser using agent-browser skill

#### US-018: Rewrite the four worker-gated e2e specs by intent

**Description:** As a maintainer, I want the e2e suite to test the new architecture's real failure
modes, since the existing four specs test a worker that is being deleted.

**Acceptance Criteria:**

- [ ] `idempotency.spec.ts` **deleted**; replaced by a backend integration test asserting Aegra returns
      409 on a duplicate run id
- [ ] `dlq-replay.spec.ts` **kept**, repointed at the new resume-from-checkpoint route;
      `data-testid='replay-button'` preserved
- [ ] `heartbeat-drain.spec.ts` **rewritten as a reconnect spec**: kill SSE mid-stream, assert `seq`
      resume with no duplicate or dropped tokens
- [ ] `correlation-id.spec.ts` **unchanged** and still passing
- [ ] All four un-gated from `DISTRIBUTED_WORKERS`
- [ ] Verify in browser using agent-browser skill

---

### Stage 6 — Cut-over (one-way door)

#### US-019: Add the resume-from-checkpoint route

**Description:** As a user, I want to retry a permanently failed run, replacing what the DLQ gave me.

**Acceptance Criteria:**

- [ ] One custom route creates a new run on the same thread from the last good checkpoint (~20 LOC)
- [ ] The existing replay button drives it; the user-visible flow is unchanged
- [ ] The PR states that transient crashed-worker failures are now covered by Aegra's automatic
      checkpoint resumption, which is why the DLQ mechanism is not being ported
- [ ] Typecheck/lint passes

#### US-020: Rehearse the database restore

**Description:** As an operator, I need the rollback proven before the irreversible step, not during it.

**Acceptance Criteria:**

- [ ] A written runbook covers: take dump → deploy → detect failure → restore dump → revert PR
- [ ] The restore is **executed at least once** against a non-production database and the result verified
- [ ] The rehearsal outcome is recorded in the PR body — "we tested the restore" is a hard gate, not a
      checkbox
- [ ] A fresh `pg_dump` of production is taken immediately before US-021 deploys

#### US-021: Make Aegra the host process

**Description:** As an operator, I want production served by Aegra.

**Acceptance Criteria:**

- [ ] `infra/docker-compose.yml` `app` service command becomes `uvicorn aegra_api.main:app --port 8000`
- [ ] Aegra points at the live `lg_template_dev`
- [ ] The `worker` service is removed
- [ ] `VITE_USE_AGENT_PROTOCOL` defaults **on**
- [ ] `.github/workflows/{build,deploy-docker,deploy-vm}.yml` updated
- [ ] The e2e job is **blocking**, not `workflow_dispatch`/`continue-on-error`
- [ ] Staging runs green on the full blocking e2e suite for **24 hours** before merge
- [ ] Not merged on a Friday
- [ ] Rollback is documented as `git revert` **plus dump restore** — the only stage where revert alone
      is insufficient

---

### Stage 7 — Deletion (after a ≥1-week soak)

#### US-022: Delete the strangled backend surface

**Description:** As a maintainer, I want the replaced code gone so nobody maintains two runtimes.

**Acceptance Criteria:**

- [ ] Deleted: `routes/v0/thread.py`, `ThreadRepo`, `ThreadService`, the invoke/stream half of
      `routes/v0/llm.py`, `services/checkpoint_resilient.py`, most of `services/checkpoint.py`,
      `services/abort.py`, `services/idempotency.py`, all of `workers/`, most of `utils/stream.py`
- [ ] Deleted (already dead, never mounted): `routes/v0/server.py`, `retrieve.py`, `source.py`
- [ ] `taskiq*` removed from `backend/pyproject.toml`
- [ ] The corresponding slice of the 82 backend test files is purged
- [ ] `cd backend && make format && make lint && make test` green
- [ ] `grep -rn "DISTRIBUTED_WORKERS\|taskiq"` returns nothing in `backend/`

#### US-023: Delete the strangled frontend surface

**Description:** As a maintainer, I want the hand-rolled SSE stack gone.

**Acceptance Criteria:**

- [ ] Deleted: `streamSource.ts`, `fetchStreamReader.ts`, `activeStreamRecovery.ts`,
      `serverService.ts` (dead on both sides), `tests/integration/distributedStream.test.ts`
- [ ] `streamError.ts` deleted **except** the user-facing copy, which moves to `streamErrorCopy.ts`
- [ ] `threadService.ts` `initiateStream` and its 202-vs-200 branch deleted
- [ ] `sse.js` removed from `frontend/package.json`
- [ ] The `adaptEvent()` shim is either removed or filed as a tracked follow-up
- [ ] `npm run test` green; `npx tsc -b` passes
- [ ] `grep -rn "initiateStream"` returns nothing
- [ ] Verify in browser using agent-browser skill

#### US-024: Remove the scheduler and close out superseded issues

**Description:** As a maintainer, I want the APScheduler cron replaced now that the migration is stable.

**Acceptance Criteria:**

- [ ] `services/schedule.py`, `routes/v0/schedule.py`, `schemas/entities/schedule.py` deleted
- [ ] Distillation runs as a second graph registered in `aegra.json` driven by an Aegra cron
- [ ] The orphaned APScheduler `schedules` table is dropped in a migration
- [ ] #974 and #959 are closed, referencing this PR
- [ ] `make test` green

## Functional Requirements

- FR-1: Orchestra's alembic chain must use `orchestra_alembic_version`; Aegra's must use the default.
- FR-2: Aegra must run against a restored copy database for all of Stages 1–5; the live database is
  touched only at US-021.
- FR-3: `@auth.authenticate` must never raise; unauthenticated callers receive
  `{"identity": "anonymous", "is_authenticated": False}`.
- FR-4: The public-assistant bypass and free-model gate must be enforced in
  `@auth.on.threads.create_run`, returning 403 rather than 401.
- FR-5: `@auth.on.*.search` handlers must filter Aegra's `thread` and `assistant` tables by
  `ctx.user.identity`.
- FR-6: The factory graph must guard all expensive work behind
  `is_for_execution(runtime.access_context)`.
- FR-7: The factory graph must not set a checkpointer.
- FR-8: `configurable.user_id` must not be accepted from the client; identity comes from
  `runtime.user.identity`.
- FR-9: The custom-routes app must not register a catch-all route.
- FR-10: `GET /threads/search` must return JSON, verified as a gate before US-012 merges.
- FR-11: The MCP surface must expose exactly the `tags={"mcp"}` routes of the custom-routes app.
- FR-12: The frontend cut-over must remain reversible by a flag flip until US-021.
- FR-13: Mid-stream reconnection must resume from the `seq` cursor with no duplicated or dropped tokens.
- FR-14: US-022 through US-024 must not land until US-021 has soaked for ≥1 week.

## Non-Goals

- **No `useStream` React-hook adoption.** US-016 uses the plain SDK client; the hook is a second
  rewrite and is deferred.
- **No reducer rewrite.** `ChatContext` is adapted through a shim; deleting the shim is a follow-up.
- **No RemoteGraph, webhook callbacks, encryption at rest, or multi-org workspaces** — Aegra does not
  provide them and this migration does not add them.
- **No rate-limiting rebuild** beyond restoring the current `200/day` ASGI equivalent, or an explicit
  written acceptance of the regression.
- **No A2A migration.** Aegra's agent-to-agent support is upstream "coming soon"; Orchestra keeps its
  own.
- **No new GitHub issues** created without operator authorization.
- **No changes to tools, prompts, projects, RAG, storage, or settings** beyond re-mounting them.

## Technical Considerations

- **Aegra reuses LangGraph's tables** — no data migration, but `aegra.json` `store.index` must match
  `services/db.py:82-83` exactly (`dims`, `embed`, `fields`). A mismatch silently degrades semantic
  search to garbage rather than erroring. Assert it in a startup test.
- **The frontend must never call the SDK's store methods.** Items written through Aegra's `/store/*`
  handlers land under `["users", <identity>, ...]` and are invisible to `BaseRepo`, which uses
  `(user_id, entity)`. Orchestra store access goes through custom routes. Enforce with a lint rule.
- **Two alembic chains must not auto-migrate in the same process** — Aegra takes an advisory lock.
  Run Orchestra's chain as a Docker init container or CI step.
- **`npx tsc --noEmit` is a no-op** in this repo; use `tsc -b`.
- Backend tests need a live Postgres (`conftest.py:46` runs `ensure_database_exists` at import).

## Execution environment

- Work in `.oh/worktrees/project/mifunedev/orchestra-<slug>`, one worktree per stage, branched off
  freshly-fetched `origin/development`. Never enter the primary checkout; never bind `:5173`/`:8000`.
- Long-running sidecars live in named tmux windows in the default session, not in agent foreground.
- `/agent-browser` for the visual and timing-dependent gates. Known traps: `TZ` drives browser-local
  hour; find-by-text clicks silently miss — use snapshot refs.
- DebugMCP (`localhost:3001/mcp`) is useful for US-008/US-009 but **requires an attached VS Code
  session** — the headless image ships no VS Code server binary. Every story must be completable
  without it.

## Success Metrics

- ≥4.5k LOC deleted from `backend/src/` and ≥1k LOC from `frontend/src/lib/`.
- Zero rows lost: `count(*)` on `checkpoints`, `store`, and `store_vectors` unchanged across cut-over.
- Zero cross-tenant reads in the US-007 gate.
- Mid-stream reconnect produces byte-identical transcripts with and without a forced disconnect.
- The e2e suite is blocking in CI, where today it gates nothing.
- Every stage before US-021 rolls back with `git revert` alone.

## Open Questions

- ~~Does `deepagents>=0.4.11` accept the callable-backend form, and does `AutoEvictMiddleware`?~~
  **RESOLVED 2026-08-07.** Both do. `deepagents 0.4.11` signature:
  `backend: BackendProtocol | Callable[[ToolRuntime], BackendProtocol] | None = None`;
  `AutoEvictMiddleware._get_backend()` (`utils/middleware.py:216-218`) branches on `callable(...)` and
  resolves per-runtime. US-009 uses the callable form; no eager-resolution fallback.
- Is the residual loss of mid-run checkpoint-write retry (from dropping `ResilientAsyncPostgresSaver`)
  acceptable under production load, or does pool tuning need to precede US-021?
- Should rate limiting be rebuilt as middleware or formally accepted as a regression? US-014 requires a
  decision either way.
- Does anything outside `useChat`/`ChatContext` depend on the exact Orchestra SSE payload shape in a
  way the `adaptEvent()` shim would miss?
