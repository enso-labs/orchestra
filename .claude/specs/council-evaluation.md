# Council of Five: OpenShell DeepAgent Spec Evaluation (v2)

**Date:** 2026-03-18
**Evaluators:** Pragmatist, Architect, Security Expert, UX Designer, DevOps Engineer
**Codebase Context:** Orchestra `development` branch, commit `eca77646`
**Change from v1:** Added Spec D (MCP Server Pattern) and A+D hybrid analysis

---

## Preamble: Codebase Reality Check

Before scoring, the council examined the actual codebase state:

- **`_SANDBOX_FACTORIES`** is a simple `dict[str, Callable]` at line 313 of `backend/src/agents/__init__.py` with exactly two entries: `"daytona"` and `"state"`.
- **`resolve_sandbox_backend()`** is ~30 lines of straightforward if/elif logic.
- **Daytona integration** follows a clear pattern: conditional import guard, factory function, `_checked` wrapper, registration in dict, error checker function (`is_daytona_error`), and mirrored error handling in 3 files (`controllers/llm.py`, `utils/stream.py`, `workers/tasks.py`).
- **Frontend sandbox selection** uses `providerKeys` visibility gating (check if `DAYTONA_API_KEY` is set) with static `SANDBOX_OPTIONS` array.
- **The codebase is ~457 lines** in `agents/__init__.py` -- a manageable file, not a monolith begging for extraction.
- **`backend/src/agents/daytona.py`** is only 19 lines -- a tiny helper, not a full provider module.
- **MCP infrastructure is proven:** `MultiServerMCPClient` is used in `agents/__init__.py` (line 177), `services/tool.py` (line 72), and `repos/tool_repo.py` (line 207). It already handles any MCP server generically via `streamable_http` transport.
- **`MCP_TEMPLATES`** in `McpServerPanel.tsx` (line 30) is a static dict with 4 entries (custom, ruska, github, exec). Templates render automatically via `Object.entries(MCP_TEMPLATES).map(...)` at line 194.
- **`docker-compose.services.yml`** has `exec_server` under `profiles: ["tools"]` -- an established pattern for optional sandbox services.

These observations ground every score below.

---

## SPEC A: Minimal Backend Provider (~294 lines, 12 files, 2-3 hours)

### Individual Judge Scores

| Criterion (weight) | Pragmatist | Architect | Security | UX | DevOps | Avg |
|---|---|---|---|---|---|---|
| 1. Alignment with existing patterns (3) | 10 | 9 | 8 | 8 | 9 | 8.8 |
| 2. Implementation risk (3) | 9 | 8 | 8 | 9 | 9 | 8.6 |
| 3. Completeness (2) | 7 | 6 | 7 | 7 | 7 | 6.8 |
| 4. Simplicity (3) | 10 | 8 | 9 | 8 | 10 | 9.0 |
| 5. Extensibility (1) | 5 | 5 | 5 | 5 | 5 | 5.0 |
| 6. Time to implement (2) | 10 | 9 | 9 | 9 | 10 | 9.4 |
| 7. User experience (1) | 7 | 7 | 7 | 7 | 7 | 7.0 |

**Weighted Total: 131.0 / 150**

### Judge Commentary

**Pragmatist:**
> This is the obvious winner for shipping fast. It copies the Daytona pattern line-for-line. A developer familiar with the codebase can read the diff in 5 minutes and know exactly what changed. The `OPENSHELL_API_KEY` sentinel trick for frontend visibility is a pragmatic hack -- not beautiful, but it works today with zero new infrastructure. The 2-3 hour estimate is realistic. My only concern is the duplicated error handling blocks in 3 files, but that is pre-existing technical debt, not introduced by this spec.

**Architect:**
> I respect this spec's discipline. It does not attempt to refactor while adding a feature. The pattern duplication (error handling in llm.py, stream.py, workers/tasks.py) offends my sensibilities -- it is the third copy of identical logic. But the existing code has this debt already, and Spec A does not make it worse in any structural way. The `_SANDBOX_FACTORIES` dict plus `resolve_sandbox_backend()` is a perfectly adequate registry for 3 providers. My extensibility score of 5 reflects that adding a 4th provider later means touching the same 8+ files again -- but that is a problem for another day.

**Security Expert:**
> Error handling is thorough -- it mirrors the Daytona fallback pattern exactly, including auto-mode graceful degradation. The `OPENSHELL_API_KEY` sentinel approach is slightly misleading (it is not actually an API key -- OpenShell uses mTLS), but the spec documents this clearly. The sandbox session cleanup on failure (`session.delete()`) is present. I would have liked to see mention of timeout guards on `wait_ready()`, but the spec acknowledges this in the risk section. Adequate.

**UX Designer:**
> The user experience is identical to Daytona's: set a key in Provider Settings, the option appears in the sandbox dropdown. Clean, discoverable, consistent. No new UI paradigms to learn. The description text in `SANDBOX_OPTIONS` is clear. My 7 on completeness reflects the absence of any sandbox health/status visibility -- users cannot tell if the OpenShell gateway is actually reachable before trying to use it. But this matches the current Daytona UX, so it is internally consistent.

**DevOps Engineer:**
> Three env vars, all optional, all with sane defaults. No new Docker services required. No database migrations. The conditional import pattern means deployments without `openshell` installed work identically to today. This is the easiest to deploy by a wide margin. The optional dependency concern (openshell may not be on PyPI) is flagged and mitigated.

### Strengths
- Exact pattern match with existing Daytona integration -- zero learning curve
- Smallest surface area: 1 new file, 11 modifications
- Can be reviewed, tested, and merged in a single PR in a single day
- Zero risk to existing Daytona and State paths
- No database migration, no new API endpoints, no new Docker services

### Weaknesses
- Duplicates error handling blocks in 3 controller/stream/worker files (pre-existing debt)
- `OPENSHELL_API_KEY` sentinel is semantically misleading (not a real API key)
- No sandbox health visibility in the UI
- Adding a 4th provider later requires touching ~12 files again
- No test file included in the spec (testing plan described but not implemented)

---

## SPEC B: Full-Featured Sandbox Service (~1,095 lines, 18 files, ~1 week)

### Individual Judge Scores

| Criterion (weight) | Pragmatist | Architect | Security | UX | DevOps | Avg |
|---|---|---|---|---|---|---|
| 1. Alignment with existing patterns (3) | 4 | 6 | 6 | 6 | 4 | 5.2 |
| 2. Implementation risk (3) | 3 | 4 | 5 | 5 | 3 | 4.0 |
| 3. Completeness (2) | 9 | 9 | 8 | 9 | 7 | 8.4 |
| 4. Simplicity (3) | 2 | 3 | 4 | 5 | 2 | 3.2 |
| 5. Extensibility (1) | 7 | 7 | 7 | 7 | 6 | 6.8 |
| 6. Time to implement (2) | 2 | 3 | 3 | 3 | 2 | 2.6 |
| 7. User experience (1) | 9 | 8 | 7 | 9 | 6 | 7.8 |

**Weighted Total: 64.0 / 150**

### Judge Commentary

**Pragmatist:**
> This spec violates the project's core principle: "Simplicity is beauty, complexity is pain." It introduces a SandboxService with session pooling, 9 new REST endpoints, per-assistant security policies, a management UI component, and Docker Compose integration -- all to add what is fundamentally a third option in a dropdown. The session pooling is premature optimization. The policy management is speculative. The ~1 week estimate is optimistic. This is a feature branch masquerading as an integration.

**Architect:**
> I appreciate the ambition but this conflates two concerns: (1) adding OpenShell as a provider, and (2) building a sandbox management platform. The SandboxService is a new domain object with its own lifecycle, pooling, and storage -- none of which Orchestra has precedent for. The `SessionPool` is an in-memory singleton with no persistence, which means sessions are lost on restart. The 9 new API endpoints need auth, validation, error handling, and documentation -- each one is a maintenance commitment. This should be at least 3 separate PRs.

**Security Expert:**
> The per-assistant security policies are genuinely valuable -- they are the only spec that addresses sandboxing policy at the Orchestra level. However, the implementation is advisory-only (depends on gateway enforcement). The session pool introduces a new attack surface: pooled sessions persist across requests, meaning sandbox state from one agent invocation may leak into another. The DELETE endpoint for sandboxes lacks ownership verification -- any authenticated user could destroy another user's sandbox.

**UX Designer:**
> The SandboxManagement.tsx component is well-designed: health badges, session status, create/destroy actions. This is the only spec that gives users visibility into their sandbox infrastructure. However, it is a solution in search of a problem -- most users want to select a sandbox type and forget about it.

**DevOps Engineer:**
> The Docker Compose integration with `profiles: [openshell]` is well done. But the session pool has no observability (no metrics, no logging of pool size over time). For a ~1 week implementation, the DevOps overhead of supporting this in production is disproportionate.

### Strengths
- Most comprehensive: covers health monitoring, session management, policy storage
- Frontend management UI provides real operational visibility
- Per-assistant security policies are forward-thinking

### Weaknesses
- **Violates "simplicity is beauty"** -- 1,095 lines and 18 files for a third dropdown option
- Session pooling is premature optimization with no evidence of need
- 9 new API endpoints = 9 new things to maintain, test, document, and secure
- Spec B's error handling uses `str(type(e).__module__).lower()` string matching instead of Spec A's clean `is_openshell_error()` pattern
- ~1 week estimate is optimistic; realistic estimate is 1.5-2 weeks

---

## SPEC C: Config-Driven Provider Registry (~318 net lines, 16 files, 3-4 days)

### Individual Judge Scores

| Criterion (weight) | Pragmatist | Architect | Security | UX | DevOps | Avg |
|---|---|---|---|---|---|---|
| 1. Alignment with existing patterns (3) | 5 | 7 | 6 | 6 | 5 | 5.8 |
| 2. Implementation risk (3) | 5 | 6 | 6 | 7 | 6 | 6.0 |
| 3. Completeness (2) | 8 | 8 | 6 | 8 | 7 | 7.4 |
| 4. Simplicity (3) | 4 | 6 | 6 | 6 | 5 | 5.4 |
| 5. Extensibility (1) | 9 | 10 | 8 | 8 | 9 | 8.8 |
| 6. Time to implement (2) | 5 | 6 | 5 | 6 | 5 | 5.4 |
| 7. User experience (1) | 8 | 8 | 7 | 8 | 7 | 7.6 |

**Weighted Total: 91.8 / 150**

### Judge Commentary

**Pragmatist:**
> This spec refactors the sandbox system to add a third provider. That is refactoring under the guise of a feature. The `backend/src/sandbox/` package with 7 new files is architecturally elegant but over-engineered for a system that has exactly 3 providers and may never have a 4th. The phased migration approach means this is not really a 3-4 day effort.

**Architect:**
> This is the spec I want to love. The Protocol-based provider interface is clean, the priority-based auto resolution is elegant, and the `GET /settings/sandbox-providers` endpoint eliminates the frontend's dependency on `providerKeys` for sandbox visibility. However, we are extracting ~70 lines of working code into a 7-file package because we *might* add more providers later. The `SandboxProvider` protocol with 8 required members is heavy for what are essentially factory functions. The existing `_SANDBOX_FACTORIES` dict achieves the same dispatch in 4 lines.

**Security Expert:**
> The spec's error handling strategy has a critical gap. It proposes replacing `is_daytona_error(e)` with `if effective_type != "state"` -- a provider-generic approach. This loses the ability to distinguish between sandbox errors (which should trigger fallback) and application errors (which should not). Additionally, the `is_available()` method on `OpenShellProvider` calls `SandboxClient.from_active_cluster()` which is a network call on every health check.

**UX Designer:**
> The dynamic provider discovery via `GET /settings/sandbox-providers` is the right UX pattern long-term. It introduces a loading state where the dropdown is empty until the API responds, which is a UX regression from the current instant-render static list. But the pattern scales better.

**DevOps Engineer:**
> The registry initialization at import time means module import order matters. If `src.sandbox` is imported before env vars are loaded, providers may incorrectly report `is_available() = False`. The current code avoids this by reading env vars lazily in factory functions. 7 new files means 7 new paths to get Python module resolution right.

### Strengths
- Best extensibility story: adding a 4th provider means creating 1 new file
- Dynamic `GET /settings/sandbox-providers` endpoint is architecturally sound
- Protocol-based interface is Pythonic
- Net reduction of code in `agents/__init__.py` once fully migrated

### Weaknesses
- **Refactors working code to add a feature** -- violates YAGNI principle
- 7 new files for 3 providers is a high file-to-value ratio
- Phased migration means two sandbox resolution paths during transition
- Error handling strategy (Phase 3) is underspecified and may lose precision
- Import-time registry initialization risks env var ordering issues
- `is_available()` on OpenShellProvider makes a network call -- not suitable for hot path
- 3-4 day estimate only covers Phase 1

---

## SPEC D: MCP Server Pattern (~300 lines, ~5 files, 5-7 days)

### Individual Judge Scores

| Criterion (weight) | Pragmatist | Architect | Security | UX | DevOps | Avg |
|---|---|---|---|---|---|---|
| 1. Alignment with existing patterns (3) | 9 | 9 | 7 | 7 | 10 | 8.4 |
| 2. Implementation risk (3) | 10 | 9 | 7 | 8 | 8 | 8.4 |
| 3. Completeness (2) | 5 | 6 | 6 | 5 | 7 | 5.8 |
| 4. Simplicity (3) | 9 | 9 | 7 | 7 | 9 | 8.2 |
| 5. Extensibility (1) | 8 | 8 | 7 | 7 | 9 | 7.8 |
| 6. Time to implement (2) | 6 | 6 | 6 | 7 | 7 | 6.4 |
| 7. User experience (1) | 5 | 5 | 6 | 4 | 6 | 5.2 |

**Weighted Total: 117.8 / 150**

### Judge Commentary

**Pragmatist:**
> This spec is radical in the best way: it achieves "add OpenShell tools to agents" with ONE line changed in Orchestra (`McpServerPanel.tsx`). Zero backend Python changes. The MCP infrastructure already works -- `MultiServerMCPClient` is proven in 3 files across the codebase. The exec_server pattern in `docker-compose.services.yml` is exactly the same shape. The risk to Orchestra's codebase is literally zero; the worst case is you remove a Docker service. The 5-7 day estimate feels high for what is essentially a Node.js Express server with 7 tool definitions, but includes testing against a real OpenShell gateway which is fair. My concern: the CLI-shelling pattern (`execFileSync("openshell", ...)`) is a pragmatic but fragile bridge -- if the CLI changes its interface, every tool breaks.

**Architect:**
> This spec makes the architecturally correct observation that Spec A and Spec D operate at **different layers**. Spec A modifies the DeepAgents sandbox backend (the layer that powers built-in `execute`/`write_file`/`read_file` tools). Spec D adds OpenShell tools via MCP (the layer that adds *additional* tools to the agent's toolbelt). These are genuinely complementary. The separation of concerns is clean: the MCP server owns all OpenShell knowledge; Orchestra remains completely agnostic. Adding a new sandbox type via MCP requires zero code changes in Orchestra -- just a new Docker service and an entry in MCP_TEMPLATES. The 7-tool surface (execute, read_file, write_file, edit_file, glob, grep, ls) is richer than Spec A's single `execute()` pipeline.

**Security Expert:**
> The multi-layer auth model is well-considered: MCP `x-api-key` for transport, mTLS for the OpenShell gateway, `policy.yaml` for sandbox runtime. The container runs as `node` user (non-root). The `policy.yaml` default is conservative -- restricted network access to package registries and GitHub only. My concerns: (1) the `openshellExec` function shells out to a CLI binary with user-provided commands, creating a command injection surface if tool inputs are not properly sanitized (JSON.stringify provides some protection but is not bulletproof for shell contexts); (2) the `execFileSync` pattern blocks the Node.js event loop; (3) mounting `~/.config/openshell` into the container exposes gateway credentials. These are manageable but need attention. Score of 7 reflects that the isolation boundary (separate container) is inherently stronger than Spec A's in-process approach.

**UX Designer:**
> This is the weakest spec on UX. Users do not get a "sandbox selector" dropdown -- they must manually configure an MCP server per-assistant via the MCP panel. This is per-assistant, not global. Discoverability is poor: a user must know that OpenShell exists as an MCP template, navigate to the assistant's tool configuration, select the template, fill in the API key, and fetch tools. Compare this to Spec A where the user sets one provider key and OpenShell appears in every sandbox dropdown globally. For power users who already configure MCP servers, this is fine. For typical users, it is a significant friction increase. My score of 4-5 reflects this gap.

**DevOps Engineer:**
> This is the easiest spec to deploy, roll back, and isolate. The MCP server is a standalone Docker container under `profiles: ["tools"]`, following the exact `exec_server` pattern already in `docker-compose.services.yml`. Rolling back means removing one service from the compose file. No database changes, no backend changes, no frontend build changes. The health check endpoint is included. Resource limits match the existing exec_server pattern. The credential mounting (`~/.config/openshell`) needs a production secret management story (Kubernetes secrets, etc.) but that is an operational concern, not an architectural one. The separate repo (`ruska-ai/sandboxes`) is the right home for this -- it keeps Orchestra clean.

### Strengths
- **Zero Orchestra backend code changes** -- the single biggest advantage
- Follows proven `exec_server` pattern in `docker-compose.services.yml` exactly
- MCP infrastructure already handles any MCP server generically -- zero integration cost
- Rollback is trivial: remove Docker service, delete template entry
- 7 tools (execute, read_file, write_file, edit_file, glob, grep, ls) vs Spec A's single `execute()` pipeline
- Separate container provides stronger isolation boundary than in-process SDK
- Per-assistant opt-in: some assistants get OpenShell tools, others do not

### Weaknesses
- **UX friction**: per-assistant MCP configuration vs global sandbox selector
- CLI-shelling pattern (`execFileSync`) is fragile -- depends on `openshell` CLI interface stability
- `execFileSync` blocks Node.js event loop (should use `execFile` with promises)
- 5-7 day estimate is longer than Spec A's 2-3 hours
- Command injection surface in `openshellExec` needs careful sanitization review
- OpenShell CLI availability as pip package or standalone binary is uncertain
- No global default -- each assistant must be individually configured
- Different architectural layer than Spec A -- does NOT replace the DeepAgents sandbox backend

---

## SPEC D CRITICAL DISTINCTION

The council wishes to emphasize a point that may be non-obvious:

**Spec A and Spec D are NOT competing. They operate at different architectural layers.**

| Layer | What it does | Spec A | Spec D |
|---|---|---|---|
| DeepAgents Sandbox Backend | Powers the agent's built-in `execute`, `write_file`, `read_file` tools | YES -- OpenShell replaces StateBackend | NO -- does not touch this layer |
| MCP Tool Layer | Adds additional tools to the agent's toolbelt | NO -- does not touch this layer | YES -- adds 7 OpenShell tools via MCP |

An agent could have Spec A's OpenShell backend for its built-in DeepAgents tools AND Spec D's OpenShell MCP for explicit tool calls. In practice you would choose one, but they can coexist without conflict.

---

## Comparative Summary (All Four Specs)

| Criterion (weight) | Spec A | Spec B | Spec C | Spec D |
|---|---|---|---|---|
| 1. Alignment with existing patterns (3) | **8.8** | 5.2 | 5.8 | 8.4 |
| 2. Implementation risk (3) | 8.6 | 4.0 | 6.0 | **8.4** |
| 3. Completeness (2) | 6.8 | **8.4** | 7.4 | 5.8 |
| 4. Simplicity (3) | **9.0** | 3.2 | 5.4 | 8.2 |
| 5. Extensibility (1) | 5.0 | 6.8 | **8.8** | 7.8 |
| 6. Time to implement (2) | **9.4** | 2.6 | 5.4 | 6.4 |
| 7. User experience (1) | **7.0** | 7.8 | 7.6 | 5.2 |
| **WEIGHTED TOTAL (/150)** | **131.0** | **64.0** | **91.8** | **117.8** |

### Weighted Score Calculation Detail

For transparency, here is how weighted totals are computed (Avg * Weight, summed):

**Spec A:** (8.8*3) + (8.6*3) + (6.8*2) + (9.0*3) + (5.0*1) + (9.4*2) + (7.0*1) = 26.4 + 25.8 + 13.6 + 27.0 + 5.0 + 18.8 + 7.0 = **123.6**

**Spec B:** (5.2*3) + (4.0*3) + (8.4*2) + (3.2*3) + (6.8*1) + (2.6*2) + (7.8*1) = 15.6 + 12.0 + 16.8 + 9.6 + 6.8 + 5.2 + 7.8 = **73.8**

**Spec C:** (5.8*3) + (6.0*3) + (7.4*2) + (5.4*3) + (8.8*1) + (5.4*2) + (7.6*1) = 17.4 + 18.0 + 14.8 + 16.2 + 8.8 + 10.8 + 7.6 = **93.6**

**Spec D:** (8.4*3) + (8.4*3) + (5.8*2) + (8.2*3) + (7.8*1) + (6.4*2) + (5.2*1) = 25.2 + 25.2 + 11.6 + 24.6 + 7.8 + 12.8 + 5.2 = **112.4**

**Corrected Weighted Totals:**

| Spec | Weighted Total |
|---|---|
| **Spec A** | **123.6** |
| Spec D | 112.4 |
| Spec C | 93.6 |
| Spec B | 73.8 |

---

## A+D HYBRID ANALYSIS

The council carefully evaluated whether implementing both Spec A and Spec D together would be the optimal path.

### Arguments FOR A+D Hybrid

1. **Complementary layers.** Spec A gives global sandbox backend selection (Settings > Sandbox > OpenShell). Spec D gives per-assistant MCP tool opt-in. Different users want different things.
2. **Defense in depth.** If Spec A's in-process SDK has issues, Spec D's container-isolated MCP server is an independent fallback.
3. **Richer tool surface.** Spec A exposes OpenShell through DeepAgents' `execute()` protocol. Spec D exposes 7 discrete tools (execute, read_file, write_file, edit_file, glob, grep, ls) which give agents finer-grained control.
4. **Spec D is zero-risk to Orchestra.** Even if Spec A has issues during integration, Spec D is a completely independent deliverable.

### Arguments AGAINST A+D Hybrid

1. **Doubled scope.** 2-3 hours (Spec A) + 5-7 days (Spec D) = ~6-8 days total. This is longer than any individual spec except Spec B.
2. **User confusion.** Two ways to use OpenShell (sandbox backend vs MCP tools) creates a "which one do I use?" decision for users. Documentation must explain the distinction clearly.
3. **Doubled dependency risk.** Both specs depend on the `openshell` package being available -- Spec A needs the Python SDK in the backend, Spec D needs the CLI in the container. If the package is unavailable, both are blocked.
4. **Maintenance surface.** Two codepaths to maintain for the same underlying service (OpenShell). Bug in the gateway? Debug in two places.
5. **YAGNI.** The user asked for "OpenShell DeepAgent support." Spec A delivers that completely. Spec D adds MCP tools which is a different (if related) capability. Shipping both at once violates "achieve the goal in the least amount of changes."

### Hybrid Verdict

The council recommends **Spec A first, Spec D as a fast-follow if MCP-level tools prove valuable.** The two specs have zero code overlap and zero conflicts, so Spec D can be added at any time without modifying Spec A's work. Shipping them together doubles the review/test surface without doubling the immediate value.

---

## FINAL RECOMMENDATION

### Winner: SPEC A -- Minimal Backend Provider

**Confidence: HIGH (9/10)**

### Ranking

| Rank | Spec | Score | Verdict |
|---|---|---|---|
| 1 | **Spec A** | **123.6** | Ship now. Follows existing patterns exactly. |
| 2 | Spec D | 112.4 | Strong alternative / fast-follow. Zero Orchestra backend risk. |
| 3 | Spec C | 93.6 | Good architecture, wrong time. Consider if 4+ providers are planned. |
| 4 | Spec B | 73.8 | Over-engineered. Violates project simplicity principles. |

### Rationale

The council is unanimous that Spec A is the right choice for this feature at this time. Here is why:

1. **The project's own design principle settles it.** "Simplicity is beauty, complexity is pain" and "achieve the goal in the least amount of changes" -- these are from CLAUDE.md. Spec A achieves the goal (add OpenShell as a sandbox option) in ~294 lines across 12 files by copying an established, working pattern. Spec D scores well but operates at a different layer and does not replace the sandbox backend.

2. **Spec A vs Spec D on the core ask.** The user wants "OpenShell DeepAgent support" -- meaning the DeepAgent's built-in sandbox backend should support OpenShell. Spec A does exactly this. Spec D adds OpenShell as MCP tools, which is valuable but is a different capability. If forced to pick one, Spec A delivers the core ask.

3. **The existing `_SANDBOX_FACTORIES` dict IS a registry.** It maps provider names to factory functions in 4 lines. Spec C's `SandboxProviderRegistry` with `Protocol`, priority ordering, and auto-discovery is an abstraction over an abstraction that is already clean enough.

4. **Premature abstraction is as costly as premature optimization.** Spec C's extensibility advantage matters if Orchestra needs 5+ sandbox providers. Today it has 2 and is adding a 3rd. There is no evidence of a 4th.

5. **Spec B solves problems nobody has.** Session pooling, per-assistant security policies, sandbox CRUD APIs, and a management UI are features that may become valuable, but zero user stories demand them today.

6. **Risk profile is unambiguous.** Spec A touches 11 existing files with minimal, additive changes. Its blast radius for a first integration of an early-stage SDK is the smallest of all specs.

7. **Spec D is the best "Plan B."** If Spec A's in-process SDK integration proves problematic (dependency conflicts, gRPC issues, wheel availability), Spec D is an independent fallback that requires zero backend changes. It can be shipped alongside or instead of Spec A at any point.

### Suggested Improvements to Spec A Before Implementation

1. **Rename sentinel to `OPENSHELL_GATEWAY`** instead of `OPENSHELL_API_KEY` in `UserTokenKey`. This is more accurate (OpenShell authenticates via mTLS, not API keys) and matches the actual configuration variable. Spec C got this right.

2. **Add the test file.** Write `backend/tests/unit/agents/test_openshell_backend.py` as part of the PR.

3. **Consider wrapping `create_openshell_backend()` in `asyncio.to_thread()`.** The spec acknowledges that sync gRPC calls block the event loop. Flag this in a code comment for future optimization.

4. **Steal one idea from Spec C:** After shipping Spec A, consider adding `GET /settings/sandbox-providers` in a follow-up PR. Decoupling the frontend from `providerKeys` for sandbox visibility is a clean improvement that does not require the full registry refactor.

5. **Consider Spec D as Phase 2.** Once Spec A ships and OpenShell works as a backend, evaluate whether the richer MCP tool surface (7 tools vs 1 `execute()` pipeline) provides additional value worth the container overhead.

### If Circumstances Change

- **If the `openshell` Python wheel is unavailable or causes dependency conflicts:** Pivot to Spec D, which isolates the dependency in a container and requires zero Orchestra backend changes.
- **If 2+ more sandbox providers are planned for the next quarter:** Reconsider Spec C's registry pattern, but implement it as a separate refactoring PR *after* Spec A ships.
- **If users demand sandbox lifecycle management:** Extract Spec B's SandboxService into a separate feature spec, scoped and reviewed independently.
- **If per-assistant sandbox tool opt-in is needed:** Ship Spec D as a complement to Spec A. The two coexist without conflict.

---

*Evaluation produced by the Council of Five, 2026-03-18.*
*All scores are consensus-derived from independent judge assessments.*
*v2: Added Spec D (MCP Server Pattern) evaluation and A+D hybrid analysis.*
