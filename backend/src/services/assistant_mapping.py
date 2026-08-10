"""Mapping between canonical Orchestra assistants and Aegra run records.

Orchestra assistants remain in the existing ``(user_id, "assistants")`` store
namespace.  Aegra receives one production graph/default assistant ID; the
canonical Orchestra ID and its configuration travel in authenticated run
context.  This prevents the Agent Protocol store from becoming a second,
unscoped assistant database.
"""

from __future__ import annotations

import hashlib
from typing import Any
from uuid import uuid5

PRODUCTION_GRAPH_ID = "orchestra"


def production_assistant_id(graph_id: str = PRODUCTION_GRAPH_ID) -> str:
    """Return Aegra's deterministic system assistant ID for one graph."""
    from aegra_api.constants import ASSISTANT_NAMESPACE_UUID

    return str(uuid5(ASSISTANT_NAMESPACE_UUID, graph_id))


def assistant_run_context(assistant: Any) -> dict[str, Any]:
    """Serialize an Orchestra assistant as factory context, without its owner."""
    if hasattr(assistant, "model_dump"):
        values = assistant.model_dump()
    elif isinstance(assistant, dict):
        values = dict(assistant)
    else:
        values = {
            key: getattr(assistant, key, None)
            for key in (
                "id",
                "model",
                "system_prompt",
                "instructions",
                "tools",
                "subagents",
                "mcp",
                "a2a",
                "files",
                "metadata",
                "project_id",
            )
        }

    # Only graph construction settings cross the Agent Protocol boundary.  In
    # particular, owner_id/public/published_at are authorization data and are
    # never treated as client-configurable graph settings.
    return {
        "assistant_id": values.get("id") or values.get("assistant_id"),
        "model": values.get("model"),
        "system_prompt": values.get("system_prompt"),
        "instructions": values.get("instructions"),
        "tools": values.get("tools") or [],
        "subagents": values.get("subagents") or [],
        "mcp": values.get("mcp") or {},
        "a2a": values.get("a2a") or {},
        "files": values.get("files") or {},
        "metadata": values.get("metadata") or {},
        "project_id": values.get("project_id"),
    }


def build_run_request(assistant: Any, message: str, thread_id: str) -> dict[str, Any]:
    """Build the Agent Protocol payload used by public/embed chat."""
    context = assistant_run_context(assistant)
    config = {"configurable": dict(context)}
    return {
        "assistant_id": production_assistant_id(),
        "input": {
            "messages": [{"role": "user", "content": message}],
            "files": context.get("files") or {},
        },
        "config": config,
        "context": context,
        "stream": True,
        "stream_mode": ["messages-tuple", "values", "custom"],
        "stream_subgraphs": True,
        "metadata": {
            "orchestra_assistant_id": str(context.get("assistant_id")),
            "orchestra_thread_id": str(thread_id),
        },
    }


def public_identity(assistant_id: str, client_ip: str | None) -> str:
    """Create a non-authenticated, assistant/IP-scoped guest tenant."""
    digest = hashlib.sha256((client_ip or "anonymous").encode()).hexdigest()[:20]
    return f"public:{assistant_id}:{digest}"


__all__ = [
    "PRODUCTION_GRAPH_ID",
    "assistant_run_context",
    "build_run_request",
    "production_assistant_id",
    "public_identity",
]
