# Aegra Full Cutover Plan Critique and Approval

## Scope

Two adversarial critics reviewed the plan against the current Orchestra checkout, then two post-revision critics rechecked the revised PRD/JSON and runtime readiness. The final alignment gate ran after the branch/order/PR fixes.

## Initial critic findings

| Lens | Severity | Finding | Mitigation in final plan |
|---|---|---|---|
| Backend architecture/deployment | High | The backend image cleanup could delete factory/custom-app imports; legacy `v0` imports eagerly load TaskIQ/scheduler/graph modules; custom app lacks store/session wiring; assistant/thread mapping and migration startup were unspecified. | US-002/003/004 require import-boundary tests, `/app/aegra.json` image-relative paths, preserved runtime modules, explicit store/MCP lifespan, assistant mapping, and one ordered migration init/preflight. |
| Backend architecture/deployment | High | SDK route verbs, public/embed behavior, CI launch commands, Python version, static hosting, and resumable stream contracts were misstated or incomplete. | Final plan pins SDK/Aegra contracts, mandates public/embed Agent Protocol runs, updates all CI/deployment entrypoints to Python 3.12/Aegra, preserves static hosting, and requires resumable fixtures. |
| Frontend/security/QA | High | Stream event payloads, auth/anonymous tenancy, cancel/resume races, history metadata, scheduler/trajectory entry points, and browser/static gates lacked concrete acceptance criteria. | US-002/004/005/006/007/009/010 add versioned fixtures, no shared anonymous tenant, run-scoped idempotent cancel, compatibility fixtures, complete deferred-entry inventory, blocking browser CI, and tracked/untracked scans. |
| Frontend/security/QA | High | Worker-era CI was non-blocking/dispatch-only and could continue to exercise the old runtime. | US-003/010 require infra-triggered blocking browser jobs without TaskIQ, `DISTRIBUTED_WORKERS`, legacy endpoints, or `continue-on-error`. |

## Post-revision alignment findings and resolution

- Acceptance counts and ordering were regenerated from the final Markdown; `prd.md` and `prd.json` now match one-to-one.
- Branch identity was corrected to the existing `task/976-aegra-full-inversion` / PR #977; the PR body now states that the stage-only scope is superseded by the atomic cutover.
- Database US-004 now precedes runtime US-003 in the PRD and JSON priority order.
- Deferred-capability US-009 now precedes deletion US-008; US-008 explicitly gates deletion on US-009's no-side-effect shutdown tests.
- `baseline.md` records SHA-256 hashes and final dispositions for every pre-existing dirty stage-0/1 sidecar artifact.

## Final approval gates

### Final PRD/JSON alignment critic

**PASS** — 10 stories and every acceptance criterion match exactly; current branch/PR identity, database-before-runtime order, deferred-before-deletion order, no-fallback requirements, and PR scope wording are correct. No secret patterns were found in task artifacts.

### Final runtime-readiness critic

**PASS** — the final plan explicitly covers image import retention, custom-app store/auth/MCP lifespan, assistant and Orchestra-store mapping, one ordered migration init, exact SDK/resumable/cancel contracts, public/embed migration, scheduler/distillation shutdown, blocking infrastructure CI, documentation, static scans, and executable validation.

## Decision

**APPROVED for implementation.** Approval covers the plan only. Every story remains `passes: false` until implementation evidence, operator-only database/browser evidence, and the native `/audit pr` gate are complete.
