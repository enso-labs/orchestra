# `.oh/tasks/`

Task specs live **with the project**, not in the orchestrator repo. Each
`<taskdesc>/` subfolder is one unit of planned work — a PRD, its Ralph-formatted
conversion, and the runner's log.

This replaces the old root-level `tasks/` directory (removed in `c3b72531`) and
the ad-hoc `.claude/specs/` consolidation (`dec32f6b`). Those were both
gitignored, so plans lived only on whoever's laptop wrote them. These are tracked.

## Contents

| File           | Purpose                                                       |
| -------------- | ------------------------------------------------------------- |
| `prd.md`       | Human-readable PRD — the spec of record                        |
| `prd.json`     | Ralph-formatted conversion; the autonomous runner's spec       |
| `progress.txt` | Runner's append-only log; ends `STATUS: COMPLETE` when done    |
| `prompt.md`    | Optional standing prompt prepended to each runner turn         |
| `critique.md`  | Optional critic notes from PRD review                          |

Anything else a task accumulates (audits, decisions, evidence, plans) belongs in
the same folder.

## Conventions

- `<taskdesc>` is kebab-case, `[a-z0-9-]+`, **≤5 words**, and matches the
  `<short-desc>` segment of the branch name — so
  `.oh/tasks/aegra-full-inversion/` pairs with `task/976-aegra-full-inversion`.
- `archive` is reserved and cannot be used as a task name.
- One folder per unit of work. A migration that ships as N sequential PRs gets
  either one folder per stage or one folder whose `prd.json` is re-converted per
  stage — not one folder per PR after the fact.
- **Do not hand-edit `progress.txt`** — the runner appends to it.

## Lifecycle

A task is complete when its work has merged and its `progress.txt` ends with
`STATUS: COMPLETE`. Completed tasks are swept into:

```
.oh/tasks/archive/<YYYY-MM-DD>/<taskdesc>/
```

Archive by moving the whole folder — the PRD is the record of what was intended,
and it is worth more next to the log of what actually happened than deleted.
Re-running the converter on a task that already has run history archives the
previous `prd.json` + `progress.txt` first, under the same dated path.

Nothing here is auto-swept in this repo; archive as part of the PR that closes
the work out, or in a follow-up housekeeping PR.
