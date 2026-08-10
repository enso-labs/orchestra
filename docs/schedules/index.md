---
slug: /schedules
title: Scheduled execution
sidebar_position: 8
---

# Scheduled execution

Scheduled execution and trajectory distillation are deferred in the single Aegra
runtime. The application does not start a scheduler, enqueue background work, or
extract trajectories after a run.

## API behavior

Existing schedule and trajectory records are preserved for migration and future
read-only inspection, but every schedule or distillation operation returns
`501 Not Implemented` with this JSON shape:

```json
{
  "code": "unsupported_capability",
  "capability": "scheduled_execution",
  "message": "Scheduled execution and trajectory distillation are unavailable in this runtime. Aegra-native jobs and trajectory support are planned as a follow-up."
}
```

Trajectory and prompt-optimization requests use `"capability":
"trajectory_distillation"`. The response is side-effect free: it does not create,
update, delete, enable, execute, or enqueue anything.

The web client removes create, edit, delete, replay, and execution controls and
shows an unavailable state instead of an empty success state. MCP exposes no
schedule or distillation tools.

## Follow-up

A future change may add Aegra-native jobs and trajectory support. It must define
its storage, authorization, cancellation, retry, and audit contracts before
reintroducing user-facing controls.
