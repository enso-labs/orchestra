"""Explicit shutdown responses for capabilities deferred past the Aegra cutover.

This module intentionally has no database, scheduler, queue, or trajectory
imports.  Every handler returns the same 501 contract without mutating state,
so old clients receive an actionable response instead of a false success.
"""

from __future__ import annotations

from typing import Final

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

UNSUPPORTED_CODE: Final[str] = "unsupported_capability"
UNSUPPORTED_STATUS: Final[int] = status.HTTP_501_NOT_IMPLEMENTED
FOLLOW_UP_MESSAGE: Final[str] = (
    "Scheduled execution and trajectory distillation are unavailable in this runtime. "
    "Aegra-native jobs and trajectory support are planned as a follow-up."
)

router = APIRouter(tags=["Deferred capabilities"])


def unsupported_response(capability: str) -> JSONResponse:
    """Return the stable, side-effect-free response for a deferred operation."""

    return JSONResponse(
        status_code=UNSUPPORTED_STATUS,
        content={
            "code": UNSUPPORTED_CODE,
            "capability": capability,
            "message": FOLLOW_UP_MESSAGE,
        },
        headers={"X-Capability-Status": "unsupported"},
    )


# Schedule reads remain addressable so existing clients do not mistake a missing
# route for an empty schedule list.  Records are preserved in storage, but all
# schedule operations are unavailable until a native jobs implementation exists.
@router.get("/schedules", operation_id="ruska_schedules_unsupported")
@router.post("/schedules", operation_id="ruska_create_schedule_unsupported")
async def schedules_unsupported() -> JSONResponse:
    return unsupported_response("scheduled_execution")


@router.get("/schedules/{schedule_id}", operation_id="ruska_get_schedule_unsupported")
@router.put("/schedules/{schedule_id}", operation_id="ruska_update_schedule_unsupported")
@router.patch("/schedules/{schedule_id}", operation_id="ruska_patch_schedule_unsupported")
@router.delete("/schedules/{schedule_id}", operation_id="ruska_delete_schedule_unsupported")
async def schedule_unsupported(schedule_id: str) -> JSONResponse:
    del schedule_id
    return unsupported_response("scheduled_execution")


# These paths cover clients that used the old execution-history and manual-run
# helpers.  They intentionally do not expose MCP tags, so deferred operations
# cannot be advertised as callable MCP tools.
@router.get("/schedules/executions", operation_id="ruska_schedule_executions_unsupported")
@router.get("/schedules/executions/recent", operation_id="ruska_recent_schedule_executions_unsupported")
async def schedule_executions_unsupported() -> JSONResponse:
    return unsupported_response("scheduled_execution")


@router.get("/schedules/{schedule_id}/executions", operation_id="ruska_schedule_history_unsupported")
@router.post("/schedules/{schedule_id}/execute", operation_id="ruska_execute_schedule_unsupported")
@router.post("/schedules/{schedule_id}/enable", operation_id="ruska_enable_schedule_unsupported")
@router.post("/schedules/{schedule_id}/disable", operation_id="ruska_disable_schedule_unsupported")
async def schedule_action_unsupported(schedule_id: str) -> JSONResponse:
    del schedule_id
    return unsupported_response("scheduled_execution")


@router.post("/llm/optimize", operation_id="ruska_optimize_prompt_unsupported")
async def prompt_optimization_unsupported() -> JSONResponse:
    return unsupported_response("trajectory_distillation")


@router.post("/assistants/{assistant_id}/distill", operation_id="ruska_distill_assistant_unsupported")
async def distillation_unsupported(assistant_id: str) -> JSONResponse:
    del assistant_id
    return unsupported_response("trajectory_distillation")


@router.api_route(
    "/trajectories/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
async def trajectory_unsupported(path: str) -> JSONResponse:
    del path
    return unsupported_response("trajectory_distillation")


@router.api_route(
    "/distillation/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
async def distillation_path_unsupported(path: str) -> JSONResponse:
    del path
    return unsupported_response("trajectory_distillation")


__all__ = [
    "FOLLOW_UP_MESSAGE",
    "UNSUPPORTED_CODE",
    "UNSUPPORTED_STATUS",
    "router",
    "unsupported_response",
]
