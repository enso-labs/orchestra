# PRD: Aegra Full Cutover — SDK Client and Single API Runtime

## Introduction

Ship one atomic cutover PR for Orchestra. Aegra becomes the only backend runtime and listens on `:8000`; the browser uses `@langchain/langgraph-sdk` as its only graph client. The existing TaskIQ worker, Redis-stream transport, hand-written SSE/reconnect machinery, legacy interactive LLM endpoints, and temporary `:2026` sidecar are removed rather than retained behind a feature flag.

Orchestra-specific capabilities remain: authentication, custom `/api` routes, tools, MCP/A2A integrations, middleware, prompts, projects, storage, settings, files, and the existing chat presentation. Scheduled execution and trajectory distillation are deliberately deferred; their actions must report an explicit unsupported state and must not enqueue or silently accept work.

This PR supersedes the staged/flagged frontend cutover described by the earlier `aegra-full-inversion` plan. It is an all-or-nothing runtime change, not a compatibility release.

## Evidence and current boundaries

- Aegra migration intent and the existing factory/auth/custom-route design are documented in `.oh/tasks/aegra-full-inversion/prd.md`.
- The current browser transport has sync/distributed branches, retry ladders, Redis-stream polling, local-storage recovery, and a legacy fallback in `frontend/src/hooks/useChat.ts`, `frontend/src/lib/services/threadService.ts`, and `frontend/src/lib/utils/streamSource.ts`.
- The current backend distributes interactive runs through `backend/src/routes/v0/llm.py`, `backend/src/workers/tasks.py`, and `DISTRIBUTED_WORKERS`.
- `backend/src/common/client/client.py` is an A2A JSON-RPC client and is not part of the graph transport removal.
- The current Aegra files (`aegra.json`, `infra/aegra.Dockerfile`, `infra/docker-compose.aegra.yml`, and `infra/aegra/*`) are temporary sidecar scaffolding and must not remain as the production deployment shape.

## Implementation gates and dependency order

The PR remains one atomic merge/release, but implementation and review follow these gates in order:

1. Freeze the existing dirty branch as the stage-0/1 baseline; do not discard it. Keep the checked-out `task/976-aegra-full-inversion` branch and PR #977/issue #976; do not silently rename or create a second branch. The captain's clarified full-cutover objective supersedes the original issue wording, and the PR body must state that scope change.
2. Pin the exact installed `aegra-api` and `@langchain/langgraph-sdk` versions and record contract fixtures for route methods, assistant/thread mapping, stream chunks, errors, cancellation, and resumable reconnect before deleting parsers.
3. Extract/import-test the custom app, store/session lifespan, auth hooks, static hosting, router inventory, and middleware before removing eager legacy imports.
4. Implement factory/auth/data compatibility and database fail-closed preflight before the single-runtime image.
5. Implement SDK client, stream adapter, thread/history mapping, and deferred-capability shutdown before deleting legacy worker/stream files.
6. Run blocking backend/frontend/browser/static gates, then `/audit pr`; only a promotable audit with recorded evidence can make the PR ready for review.

## Goals

- Run exactly one Aegra-backed API runtime on `:8000` for interactive Agent Protocol requests and Orchestra custom routes.
- Make `@langchain/langgraph-sdk` the only frontend graph/run/thread client, with no feature flag or fallback transport.
- Move Orchestra's production agent construction into one Aegra factory graph with Aegra-owned run, checkpoint, stream, cancel, and history lifecycles.
- Remove TaskIQ, `DISTRIBUTED_WORKERS`, custom Redis stream/DLQ/worker-recovery infrastructure, and legacy interactive graph endpoints.
- Preserve authenticated/public behavior, tenant isolation, tool/subagent/file/todo output, cancellation, checkpoint history, A2A, MCP, and custom `/api` features.
- Make deferred schedules and trajectory distillation explicit and safe rather than silently accepting work.
- Prove the cutover with backend, frontend, static-removal, and browser gates.

## User Stories

### US-001: Create the production Aegra factory graph

**Description:** As the runtime, I want one Aegra factory graph to construct Orchestra's agent from Aegra execution context so Aegra owns the run lifecycle without duplicate legacy execution paths.

**Acceptance Criteria:**

- [ ] Add `backend/src/agents/factory.py` exporting the production graph factory with the Aegra `RunnableConfig` and `ServerRuntime` contract.
- [ ] The factory has an execution-context guard and returns a cheap schema/read graph for non-execution requests; schema extraction and assistant/thread reads create zero sandboxes.
- [ ] User identity comes only from `runtime.user.identity`; client-supplied `configurable.user_id` is rejected or ignored.
- [ ] The factory resolves assistant settings, user settings, memory/context files, backend, tools, subagents, and middleware exactly once, reusing existing differentiated Orchestra helpers where they remain useful.
- [ ] The compiled graph is returned without a client-supplied checkpointer so Aegra can inject its own checkpoint runtime.
- [ ] Sandbox cleanup happens on factory context exit.
- [ ] `backend/src/common/client/client.py` remains importable and its A2A behavior is unchanged.
- [ ] Backend unit tests cover execution versus schema/read contexts, identity sourcing, zero-sandbox schema reads, and cleanup.
- [ ] `make lint` and the affected backend tests pass.

### US-002: Port auth, tenancy, and custom routes into Aegra

**Description:** As a user, I want existing JWT, API-key, public, and tenant-isolation behavior to survive the runtime change while Agent Protocol routes remain distinct from Orchestra's custom API.

**Acceptance Criteria:**

- [ ] Add `backend/aegra_auth.py` with the existing JWT and global API-key credential behavior, preserving scoped database-session cleanup.
- [ ] Missing/invalid credentials remain non-fatal at authentication time; protected handlers enforce auth and public/share/embed handlers remain guest-capable.
- [ ] Add `backend/custom_app.py` mounting only surviving Orchestra custom routes under `/api` and the MCP surface; it contains no SPA catch-all and wires the Aegra-provided store/session lifespan required by `get_store()` and API-key auth.
- [ ] Split or replace eager `src.routes.v0` imports so importing `custom_app` cannot import TaskIQ, scheduler, or legacy graph execution modules.
- [ ] Keep app-specific endpoints such as auth, settings, tools, storage, memory, RAG, project, prompt, health/config, assistant publish/fork/embed, and non-graph LLM utilities where they remain supported.
- [ ] Orchestra assistant records remain canonical in their existing custom `/api` namespace and are never replaced by unscoped Aegra SDK store calls; the SDK run uses one production graph identifier plus authenticated custom assistant ID/config metadata.
- [ ] Assistant CRUD, publish, fork, embed, public access, and per-assistant model/prompt/tool settings all use that mapping for pre-existing and newly-created assistants.
- [ ] Public/embed chat is migrated to the same Agent Protocol run contract with anonymous authorization tests; it cannot retain `LLMController.llm_stream` or be silently marked unsupported.
- [ ] Remove graph/run/thread handlers from the legacy custom route surface when their Agent Protocol equivalents exist, while explicitly classifying HITL, semantic search, project filtering, and other non-equivalent routes as retained, migrated, or removed.
- [ ] A user cannot read, search, update, or delete another user's Aegra thread/assistant through Agent Protocol routes; missing identity never falls back to a shared `TEST_USER_ID` tenant.
- [ ] The exact SDK method/path/HTTP verb contract is pinned in fixtures (including the current `POST /threads/search`, assistant search, thread history, and store calls); tests prove invalid methods do not reach the SPA.
- [ ] Root protocol routes, `/api` routes, MCP, CORS, rate limiting, correlation IDs, logging, and production static hosting are route-ordered and tested without SPA shadowing.
- [ ] Tests cover JWT, API key precedence/rotation, missing versus invalid credentials, anonymous/public isolation, protected 401, paid-model 403, cross-tenant access, store lifespan, MCP nested lifespan/tag filtering, assistant mapping, and custom-app import without legacy dependencies.
- [ ] Python compile check, `make lint`, and affected backend tests pass.

### US-004: Complete the database and migration cutover preflight

**Description:** As an operator, I want both migration chains and the selected database to be unambiguous before Aegra boots.

**Acceptance Criteria:**

- [ ] Orchestra owns `orchestra_alembic_version`; Aegra owns its upstream `alembic_version` table.
- [ ] The runbook documents the one-time rename, rollback precondition, fresh-copy restore, and startup order; it is not implemented as an Alembic revision.
- [ ] The production migration init/preflight is the single startup mechanism: it verifies configured database identity, `orchestra_alembic_version`, Aegra `alembic_version`, and required checkpoint/store tables, refuses the wrong database or ambiguous ownership, and completes before the API health check.
- [ ] Existing `checkpoints`, `store`, and `store_vectors` stable keys and content digests remain unchanged across first Aegra boot.
- [ ] An authenticated Aegra Agent Protocol store read returns a known pre-existing LangGraph item in its expected namespace, while Orchestra assistant records remain accessed through their custom `/api` namespace; a pre-existing assistant/thread fixture retains its custom ID, project metadata, files, todos, and message history through the SDK mapping.
- [ ] No code or environment default points the validation runtime at `lg_template_dev` when a copy database is required.
- [ ] The database preflight and restore evidence are recorded with the task artifacts.

### US-003: Replace the sidecar deployment with one Aegra API runtime

**Description:** As an operator, I want one deployable API service so there is no second Aegra process, port, database runtime, or worker to coordinate.

**Acceptance Criteria:**

- [ ] Before cleanup, record a SHA-256 manifest and final disposition for the dirty stage-0/1 paths (`Makefile`, `aegra.json`, `infra/aegra*`, sidecar Compose/Docker files, and runbook changes); no reset or cleanup discards them silently.
- [ ] Move the production Aegra configuration to `/app/aegra.json` in the backend image and register only the production graph, for example `"orchestra": "./src/agents/factory.py:build_graph"`; do not register `hello` or development-only `deepagent` smoke graphs in production.
- [ ] Add the Aegra runtime dependency to the backend dependency set and lockfile; the shipped image contains Aegra and all factory dependencies.
- [ ] Update `infra/backend.Dockerfile` and `infra/docker-compose.yml` so the single API service runs `aegra_api.main:app` on `:8000` with the configured `POSTGRES_CONNECTION_STRING`, `DATABASE_URL`, Redis, and provider environment.
- [ ] The image build preserves/imports the factory, custom app, auth adapter, route modules, migration hooks, static assets, and any modules required by the configured Aegra graph; bytecode/source cleanup cannot delete an importable runtime module.
- [ ] Keep the existing Postgres and Redis services as dependencies; do not create a second Postgres service or hardcode a database name in application code.
- [ ] Create one production-wired migration init/preflight command that runs Orchestra's `orchestra_alembic_version` chain, then the pinned Aegra migration chain, and make the API depend on its successful completion; do not race migrations from API lifespan.
- [ ] Remove the worker service/image target and all production references to `:2026`.
- [ ] Delete `infra/docker-compose.aegra.yml`, `infra/aegra.Dockerfile`, `infra/aegra/hello_graph.py`, `infra/aegra/deepagent_graph.py`, `infra/aegra/pyproject.toml`, and `infra/aegra/uv.lock` after their production-only responsibilities are replaced.
- [ ] Remove `make dev.aegra.*` targets and update development/runbook instructions to start the single API runtime.
- [ ] The deployment exposes Agent Protocol routes at the root and custom Orchestra routes below `/api`, with static frontend serving ordered after both.
- [ ] Every CI/deployment/VM/Make entrypoint uses Python 3.12 and the Aegra app; no workflow builds or starts TaskIQ, sets `DISTRIBUTED_WORKERS`, or masks browser failures with `continue-on-error`.
- [ ] CI runs the relevant deployment/infrastructure workflow when `infra/**`, Dockerfiles, workflows, or backend runtime files change; the browser job is blocking rather than dispatch-only.
- [ ] A clean image starts one API process, the Aegra-native health route and retained custom health route succeed, `/chat` and its assets are reachable, and no worker or `:2026` process is required.

### US-005: Add the sole authenticated LangGraph SDK client

**Description:** As a frontend maintainer, I want one official SDK client so authentication and Agent Protocol transport are not reimplemented in each hook or service.

**Acceptance Criteria:**

- [ ] Add a pinned, supported `@langchain/langgraph-sdk` version to `frontend/package.json` and `frontend/package-lock.json`, paired with the exact Aegra version in the backend lockfile.
- [ ] Add `frontend/src/lib/api/agentClient.ts` exporting the sole SDK client/factory for runs, threads, assistants, and Agent Protocol requests.
- [ ] Commit versioned fixtures/tests for the SDK's exact search/history/store methods, assistant-to-production-graph mapping, stream event variants, terminal/error payloads, cancel responses, and resumable cursor headers/body.
- [ ] The client attaches the current `getAuthToken()` value on every request, handles token changes after login/logout, and does not log credentials.
- [ ] Production uses the same-origin Agent Protocol base URL; local Vite development proxies root Agent Protocol prefixes (`/threads`, `/assistants`, `/runs`, `/store`, and other required protocol paths) to the single backend while `/api` remains the custom-route proxy.
- [ ] No `VITE_USE_AGENT_PROTOCOL` or equivalent feature flag is added.
- [ ] No localStorage stream records, custom reconnect ladder, distributed polling, legacy SSE fallback, or compatibility transport remains; the plain SDK `Client` is the only graph client.
- [ ] No other frontend module constructs an Agent Protocol client or manually calls Agent Protocol run/thread URLs.
- [ ] Unit tests cover base URL, auth header, token rotation, and non-JSON/error responses.
- [ ] `npm run test` and `npx tsc -b` pass.

### US-006: Replace chat streaming, cancellation, and reconnect with SDK runs

**Description:** As a user, I want chat turns to stream through Aegra's native run protocol so tokens, tools, subagents, cancellation, and reconnect are handled by maintained infrastructure.

**Acceptance Criteria:**

- [ ] Rewrite `frontend/src/hooks/useChat.ts` to use `client.runs.stream(...)` as its only interactive graph transport.
- [ ] Request `messages-tuple`, `values`, and `custom` stream modes with subgraph streaming enabled, using the production assistant/config contract rather than the legacy `/llm/stream` payload.
- [ ] Add one `adaptEvent()` boundary that converts SDK chunks into the existing `ChatContext`/reducer event contract; do not rewrite the reducer or duplicate event parsing across components.
- [ ] Token streaming preserves assistant messages, tool calls, subagent activity, files, todos, metadata, TTFT, and auto-scroll/user-scroll behavior.
- [ ] Cancel invokes the SDK run-cancel API and immediately stops local rendering without discarding already received content.
- [ ] Reconnect explicitly requests the installed Aegra resumable-stream mode and resumes with its documented cursor/`Last-Event-ID` contract; transcript equality proves no duplicated or dropped tokens.
- [ ] Cancel is idempotent and run-scoped: cancel-before-first-token, cancel-after-partial-output, repeated/late cancel, refresh during cancellation, and stale-run cancellation cannot affect another run on the same thread.
- [ ] 401/403, rate limit, timeout, cancellation, malformed/non-JSON, and terminal run errors map to explicit existing UI states without browser alerts or silent hangs; status/reconnect uses accessible live regions and focus remains usable.
- [ ] Delete the legacy `streamThread`, `initiateStream`, `SyncStreamSource`, `DistributedStreamSource`, `fetchStreamReader`, and legacy SSE fallback paths after the SDK path is live.
- [ ] Unit/integration tests cover message tuples, values/custom updates, tools/subgraphs, cancellation, error mapping, and forced disconnect/resume.
- [ ] `npm run test` and `npx tsc -b` pass.
- [ ] Verify in browser using the agent-browser skill.

### US-007: Move thread listing and history to the SDK

**Description:** As a user, I want thread lists, history, read, and delete operations to use the same Agent Protocol as chat runs.

**Acceptance Criteria:**

- [ ] Rewrite `frontend/src/hooks/useThread.ts` to use the pinned SDK thread search, read, history, and delete operations with their actual HTTP methods and pagination semantics.
- [ ] Define and test the mapping from Orchestra assistant IDs to the production Aegra graph/assistant identifier plus custom assistant metadata; preserve per-assistant model, prompt, tools, and tenant settings.
- [ ] Preserve pagination, project metadata filtering, selected-thread navigation, message formatting, files, todos, model metadata, and empty/error states across multiple checkpoints and history pages.
- [ ] Use SDK assistant/thread methods for Agent Protocol resources; retain `apiClient`/custom services only for non-Protocol Orchestra routes such as publish, fork, embed, and app-specific updates.
- [ ] A pre-existing thread reloads with its latest history and workspace context through the single Aegra API.
- [ ] Tests cover first page, pagination, project filtering, history replay, missing history, delete, authorization failure, and API error states.
- [ ] `npm run test` and `npx tsc -b` pass.
- [ ] Verify in browser using the agent-browser skill.

### US-009: Make deferred jobs explicitly unsupported

**Description:** As a user, I want removed scheduled/background capabilities to fail clearly rather than appear to succeed without execution.

**Acceptance Criteria:**

- [ ] Remove TaskIQ-backed scheduled LLM execution and trajectory-distillation dispatch; no replacement worker is introduced in this PR.
- [ ] Disable scheduler startup, schedule CRUD mutators, manual assistant distillation, MCP-exposed schedule/distillation operations, post-run trajectory extraction, and every other discovered enqueue/execute entry point before deleting their worker dependencies.
- [ ] Preserve existing stored schedule/trajectory records unless deletion is required solely to remove dead runtime code.
- [ ] Schedule create/enable/execute and every trajectory-distillation entry point return a documented unsupported response (501 or the repository's equivalent) and never enqueue, mutate, or execute work.
- [ ] Frontend schedule/distillation creation, edit, submit, and replay affordances are removed or rendered visibly unavailable with actionable copy; no empty success state is shown.
- [ ] Existing read-only data has a clear unavailable-state treatment.
- [ ] Add tests proving unsupported operations do not create tasks and return the expected status/body.
- [ ] Documentation names Aegra-native jobs/trajectory work as a follow-up, not as a hidden compatibility path.
- [ ] `npm run test`, backend tests, and `npx tsc -b` pass.
- [ ] Verify in browser using the agent-browser skill.

### US-008: Remove TaskIQ and legacy interactive runtime infrastructure

**Description:** As an operator, I want no separate worker architecture so interactive runs execute only through Aegra's API lifecycle.

**Acceptance Criteria:**

- [ ] Complete US-009's explicit schedule/distillation shutdown and no-side-effect tests before deleting any worker or stream dependency.
- [ ] Remove `DISTRIBUTED_WORKERS` and all interactive branching that enqueues `run_agent_stream`.
- [ ] Remove TaskIQ and TaskIQ-Redis dependencies, broker configuration, worker service/image, worker state/heartbeat, Redis stream polling, DLQ/replay, custom abort signaling, idempotency keys, and worker-only resilient checkpointer code when no remaining caller requires them.
- [ ] Remove legacy interactive `/llm/stream` and `/llm/invoke` graph execution routes/controllers; preserve only explicitly supported non-graph LLM utilities under custom `/api` routes.
- [ ] Remove duplicate controller/worker execution paths while retaining reusable agent tools, middleware, prompts, services, and factory helpers that the Aegra graph still calls.
- [ ] Remove frontend worker-loss, DLQ replay, active-stream recovery, and distributed-stream copy/UI; run errors use Aegra/SDK semantics.
- [ ] Preserve `backend/src/common/client/client.py` and its A2A tests.
- [ ] A repository scan finds no runtime references to `DISTRIBUTED_WORKERS`, `taskiq`, `run_agent_stream`, the removed Redis stream/DLQ symbols, or interactive `/llm/stream`.
- [ ] Python compile check, backend dependency/import/unit/integration/lint checks pass.

### US-010: Replace migration-era tests with single-runtime gates

**Description:** As a maintainer, I want tests to prove the final architecture rather than preserve tests for the deleted worker and sidecar.

**Acceptance Criteria:**

- [ ] Replace worker-loss/Redis-polling e2e coverage with an Agent Protocol reconnect test that kills the stream and verifies cursor-based continuation with no duplicate or missing tokens.
- [ ] Replace DLQ replay coverage with Aegra run-error/cancellation behavior; the UI no longer offers DLQ Replay.
- [ ] Replace distributed-worker duplicate coverage with an Agent Protocol duplicate-run/idempotency test using Aegra's documented contract.
- [ ] Keep correlation/request identity coverage and update it to Aegra `run_id` where needed.
- [ ] Add a startup/route smoke test using the pinned SDK methods/HTTP verbs proving the protocol search/history/store calls are JSON, the Aegra-native and retained custom health routes are healthy, `/api/auth/login` works, and no SPA catch-all shadows protocol routes.
- [ ] Add a deployment/static gate scanning tracked and untracked source, tests, CI, Docker, Make targets, lockfiles, and built assets for one API runtime, no worker service, no `:2026`, no feature flag, and no deleted transport symbols, with an explicit historical-document allowlist.
- [ ] Run backend Python compile/lint/tests, `frontend/npm run test`, `frontend/npx tsc -b`, and a blocking browser smoke suite (not dispatch-only or `continue-on-error`) covering auth/public chat, tools, history, cancel, reconnect, route precedence, deferred UI, mobile, and accessibility.
- [ ] Update active `README.md` and `infra/README.md` worker/runtime documentation, and explicitly classify every dirty sidecar artifact in the final disposition.
- [ ] The task evidence records the commands, route results, and browser outcomes.

## Functional Requirements

- **FR-1:** Aegra is the only process serving interactive Agent Protocol runs, threads, assistants, stores, streams, checkpoints, and cancellation on `:8000`.
- **FR-2:** Orchestra custom routes are mounted under `/api` without a catch-all that can shadow Agent Protocol routes.
- **FR-3:** The production graph factory obtains identity from Aegra runtime context and never trusts client-supplied user identity.
- **FR-4:** The frontend uses one authenticated `@langchain/langgraph-sdk` client for all graph/run/thread/assistant operations.
- **FR-5:** The frontend has no feature flag, fallback transport, manual distributed polling, local-storage stream recovery record, or custom reconnect ladder.
- **FR-6:** Existing chat output semantics for messages, tools, subagents, files, todos, metadata, cancel, errors, and history remain observable through one adapter and the existing reducer.
- **FR-7:** Existing JWT/API-key/public/tenant behavior remains enforced across Aegra and custom routes.
- **FR-8:** TaskIQ, `DISTRIBUTED_WORKERS`, worker services, Redis stream/DLQ runtime, legacy graph endpoints, and temporary sidecar files are absent from the final runtime and dependency graph.
- **FR-9:** Schedule and trajectory-distillation operations are explicitly unsupported and cannot silently enqueue or accept work.
- **FR-10:** The A2A client remains supported and is not treated as the replaced graph client.
- **FR-11:** Database migration ownership is explicit: Orchestra uses `orchestra_alembic_version`; Aegra uses `alembic_version`; existing LangGraph data is preserved by content digest.

## Non-Goals

- No feature-flagged rollout, dual transport, compatibility release, or fallback to the old client.
- No implementation of Aegra-native cron, scheduled LLM execution, or trajectory distillation in this PR.
- No migration to the SDK React `useStream` wrapper; use the plain `Client` API.
- No A2A protocol/client rewrite.
- No visual redesign or ChatContext reducer rewrite.
- No unrelated cleanup of tools, prompts, MCP, RAG, storage, settings, or project features.
- No second Postgres service or permanent Aegra network hop behind a separate Orchestra API.

## Design Considerations

- Preserve existing Tailwind/shadcn chat surfaces and the current message/tool/file/todo presentation.
- Loading and reconnecting use existing inline status treatment with an accessible `role="status"`.
- Run errors use an inline `role="alert"`, plain-language cause, and a retry-from-checkpoint action only when the SDK/Aegra contract supports it; never mention DLQ.
- Cancellation keeps partial output visible and announces that the run stopped.
- Auth failures clear expired credentials and route to login; public assistant/share paths remain usable anonymously.
- Deferred schedule/distillation surfaces show an explicit unavailable panel and remain keyboard/focus/reflow accessible.
- Preserve mobile composer behavior, visible focus, non-color status cues, reduced-motion-safe indicators, and narrow-width reflow.

## Technical Considerations

- The existing migration table isolation from the Aegra preparation work is a hard precondition. Aegra must not boot against a database whose migration ownership is ambiguous.
- `backend/pyproject.toml` and `backend/uv.lock` become the source of truth for Aegra dependencies; the temporary `infra/aegra/pyproject.toml` is removed.
- `backend/aegra.json` is copied to `/app/aegra.json` and uses image-relative paths such as `./src/agents/factory.py:build_graph`; the final image import/boot smoke test is authoritative.
- `infra/backend.Dockerfile`, `infra/docker-compose.yml`, CI, and deployment entrypoints must agree on `aegra_api.main:app`; no command may continue to launch `main:app` or TaskIQ.
- `VITE_API_URL` remains the custom `/api` base where applicable. Agent Protocol root prefixes need same-origin production routing and explicit Vite development proxy rules; exact prefixes and methods come from the pinned SDK, not assumptions in this document.
- SDK stream event and error/resume payloads must be pinned by contract tests against the Aegra version used by the image; do not infer field names from the legacy SSE shape. Unknown/malformed events must be handled without silently corrupting reducer state.
- Existing assistant IDs, graph IDs, thread metadata, files, todos, project filters, and static frontend hosting need explicit compatibility fixtures; checkpoint presence alone is not evidence of UI parity.
- The deployment must run the single production-wired migration init/preflight step (Orchestra chain first, Aegra chain second) before Aegra can serve traffic; a database dump/restore is operator-owned and cannot be claimed from local code tests.
- MCP is mounted through its nested lifespan with explicit route tags, excludes Agent Protocol routes, carries the shared store state, and exposes no schedule/distillation tools after deferral.
- Backend validation uses Python compile/lint/tests; frontend validation uses `npx tsc -b` plus tests. No nonexistent backend mypy/pyright command is implied.
- The Aegra factory must not pass a client checkpointer and must clean up sandbox resources on context exit.
- No secrets or `.env` contents belong in the repository or task artifacts.

## Success Metrics

- One API container/process on `:8000` serves both Agent Protocol and `/api`; no worker container/process and no `:2026` sidecar are required.
- A normal authenticated chat turn, multi-turn continuation, thread list, history reload, tool/subagent run, file/todo update, cancellation, and forced reconnect pass in the browser.
- Reconnect produces zero duplicated and zero missing tokens under the test interruption scenario.
- Existing database content digests remain unchanged across first Aegra boot.
- Static scans find zero old transport/worker/feature-flag runtime references, except explicitly retained A2A symbols and historical task documentation.
- Schedule/distillation attempts produce an explicit unsupported response and never enqueue work.
- Backend and frontend test/type/lint gates are green.

## Open Questions

None are blocking product decisions. During implementation, pin the exact installed Aegra/SDK stream, error, cancellation, and resume payloads in contract tests before deleting the legacy parser; any mismatch is an implementation blocker, not permission to restore a compatibility path.
