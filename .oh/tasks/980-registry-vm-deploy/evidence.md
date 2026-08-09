# Evidence — 980-registry-vm-deploy

- **PR**: [#981](https://github.com/mifunedev/orchestra/pull/981) (`mifunedev/orchestra`, base `development`) · **Branch**: `feat/980-registry-vm-deploy`
- **Audit run**: `audit-20260809T202321Z-2021491` · **Verdict**: `PR-AUDIT-PROMOTABLE`

## What was broken, and what now holds

Orchestra had development-only Docker infrastructure and no production registry Compose entry point. The new `deploy/docker-compose.yml` resolves to API and worker registry services only; the explicitly named database overlay adds private dependency services, while the Ollama service remains profile-gated. The branch is clean and mergeable against the current `development` head, CI is green, and the PR remains intentionally draft-only.

## Proof by gate

| Gate | What was checked | Observed | Result |
|------|------------------|----------|--------|
| Task graph | No PRD/task graph was supplied for this deployment request | N/A — acceptance was tracked directly in the issue and PR | N/A |
| Deployment static validation | YAML parse plus assertions for service sets, no builds, loopback API binding, private dependency ports, profile gating, dependency conditions, image tags, and SearXNG settings | `deployment static validation: PASS` | PASS |
| Python/config checks | Fernet recipe validation, backend syntax compilation, and diff whitespace check | `Fernet generation recipe: PASS`; `python syntax check: PASS`; `branch diff check: PASS` | PASS |
| Regression / CI | GitHub Actions workflow for PR head `bfdee05a` | `test-backend success`; `test-frontend success`; `test-e2e skipped` | PASS |
| PR audit | `pr-acquire.sh` + `pr-classify.sh`, correlated to the run above | `CI PASS`, `mergeable MERGEABLE`, `mergeStateStatus CLEAN`, `evidenceComplete true`, `promotable true` | PASS |
| VM runtime | Pull/start/health smoke test | Not run from this sandbox per operator instruction not to manage Docker here | N/A |

## Observed output

```text
$ backend/.venv/bin/python - <<'PY'  # deployment assertions
...
PY
 deployment static validation: PASS

$ backend/.venv/bin/python -m compileall -q backend/src/utils/security.py
python syntax check: PASS

$ git diff origin/development..HEAD --check
branch diff check: PASS
```

```text
$ gh run view 31334017466 --repo mifunedev/orchestra --json status,conclusion,jobs
{"conclusion":"success","jobs":[{"conclusion":"success","name":"test-backend","status":"completed"},{"conclusion":"success","name":"test-frontend","status":"completed"},{"conclusion":"skipped","name":"test-e2e","status":"completed"}],"status":"completed"}
```

```text
$ git log --format='%h %G? %s' -3
bfdee05a G Merge origin/development into feat/980-registry-vm-deploy
23716b1d G fix: document Fernet key generation
fb31a2ff G fix: clarify overlay secret encoding
```

```text
$ .oh/skills/audit/scripts/audit-run.sh pr 981 --repo mifunedev/orchestra --base development -- .oh/skills/audit/scripts/route-driver.sh
Run: audit-20260809T202321Z-2021491
Acquisition: pr-acquire.sh exit 0, schema v1 envelope, evidence intact
Classification: pr-classify.sh exit 0
CI: PASS
mergeable: MERGEABLE
mergeStateStatus: CLEAN
primary state: draft
readyForReview: true
readyToMerge: false
evidenceComplete: true
promotable: true
AUDIT-EVIDENCE: PR-AUDIT-PROMOTABLE
```

## Acceptance criteria → proof

| Criterion | Proof |
|-----------|-------|
| Base Compose contains API and worker only | Static validation assertion and `deploy/docker-compose.yml` |
| Dependency overlay is explicit and disabled by default | Separate `deploy/docker-compose.database.yml`; base service-set assertion |
| Ollama is separately opt-in | `profiles: [ollama]` assertion and overlay profile runbook |
| API is loopback-only and dependencies have no host ports | Static port assertions; `deploy/docker-compose.yml` and `deploy/docker-compose.database.yml` |
| Production secrets use ignored runtime files/templates | `deploy/.example.env`, `.gitignore`, and tracked SearXNG example without a usable secret |
| Existing deployment workflows and development compose remain unchanged | Current PR diff has no paths under `.github/workflows/` or `infra/` relative to `origin/development` |
| Draft PR is delivered against `development` | PR #981 title/base/head and final PR audit |

## Gaps and non-gating findings

- `readyToMerge: false` is expected because the requested completion gate is a draft PR; the PR was not marked ready and was not merged.
- The repository's E2E job is skipped by workflow configuration.
- `pre-commit` was unavailable in the current environment (`pre-commit: command not found`); no matching pre-commit hooks target the changed deploy/docs paths.
- VM pull/start/log/health smoke testing remains an operator-side step because Docker management was explicitly excluded from this sandbox session.
