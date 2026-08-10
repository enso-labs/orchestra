"""Orchestra authentication and Agent Protocol authorization for Aegra.

The authentication callback is intentionally fail-soft.  Aegra invokes it for
all requests, including public/share/embed requests; protected operations are
denied by the ``@auth.on`` handlers or by the custom-route dependency rather
than by raising from ``authenticate``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping

import jwt
from fastapi import HTTPException, Request
from jwt import PyJWTError
from langgraph_sdk import Auth


_ANONYMOUS_IDENTITY = "anonymous"


auth = Auth()


@dataclass(slots=True)
class AegraUser:
    """Small custom-route view of Aegra's authenticated user."""

    id: str
    identity: str
    username: str | None = None
    email: str | None = None
    name: str | None = None
    is_authenticated: bool = True
    permissions: list[str] | None = None

    def model_dump(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "identity": self.identity,
            "username": self.username,
            "email": self.email,
            "name": self.name,
            "is_authenticated": self.is_authenticated,
            "permissions": self.permissions or [],
        }


def _anonymous_user() -> dict[str, Any]:
    """Return a fresh anonymous payload for every unauthenticated request."""
    return {
        "identity": _ANONYMOUS_IDENTITY,
        "display_name": "Anonymous User",
        "email": None,
        "username": None,
        "is_authenticated": False,
        "permissions": [],
    }


def _header_value(headers: Mapping[Any, Any] | None, name: str) -> str | None:
    """Read a case-insensitive header from Aegra's bytes or string mapping."""
    if not headers:
        return None
    wanted = name.lower().encode()
    for key, value in headers.items():
        if key == name or key == name.lower() or key == wanted:
            if isinstance(value, bytes):
                return value.decode("utf-8", errors="replace")
            return str(value)
        key_text = key.decode("utf-8", errors="replace") if isinstance(key, bytes) else str(key)
        if key_text.lower() == name.lower():
            if isinstance(value, bytes):
                return value.decode("utf-8", errors="replace")
            return str(value)
    return None


def get_store() -> Any:
    """Return Aegra's process-lifetime store.

    The callback receives headers only in Aegra 0.9.x, so it cannot read
    ``request.app.state``.  ``db_manager`` is the same store placed on the
    custom app lifespan and is therefore the safe shared lookup surface.
    """
    from aegra_api.core.database import db_manager

    return db_manager.get_store()


def _payload_for_user(user: Any) -> dict[str, Any]:
    """Build the stable user shape consumed by Aegra and custom routes."""
    protected = user.protected() if hasattr(user, "protected") else user
    user_id = getattr(protected, "id", None) or getattr(protected, "identity", None)
    identity = str(user_id)
    return {
        "identity": identity,
        "display_name": getattr(protected, "name", None) or getattr(protected, "username", None) or identity,
        "email": getattr(protected, "email", None),
        "username": getattr(protected, "username", None),
        "is_authenticated": True,
        "permissions": list(getattr(protected, "permissions", None) or []),
    }


async def _authenticate_api_key(api_key: str) -> dict[str, Any] | None:
    """Resolve one global API key while scoping the SQL session to the lookup."""
    from src.repos.api_token_repo import ApiTokenRepo
    from src.repos.user_repo import UserRepo
    from src.services.db import AsyncSessionLocal
    from src.utils.auth import hash_token

    store = get_store()
    token_repo = ApiTokenRepo("system", store)
    token = await token_repo.get_by_hash_global(hash_token(api_key))
    if not token:
        return None

    # Do not keep this session open while Aegra executes a graph run.  The
    # session is deliberately nested around the single user lookup.
    async with AsyncSessionLocal() as db:
        user = await UserRepo(db, user_id=token.user_id).get_by_id()
        if not user:
            return None
        payload = _payload_for_user(user)

    # Usage accounting must not turn a valid credential into a failed request.
    try:
        await ApiTokenRepo(token.user_id, store).update_last_used(token.id)
    except Exception:
        pass
    return payload


async def _authenticate_bearer(authorization: str | None) -> dict[str, Any] | None:
    """Validate a JWT and confirm its subject still exists in Orchestra."""
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None

    from src.constants import JWT_ALGORITHM, JWT_SECRET_KEY
    from src.repos.user_repo import UserRepo
    from src.services.db import AsyncSessionLocal

    payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    exp = payload.get("exp")
    if exp is None or datetime.now(timezone.utc).timestamp() > float(exp):
        return None
    user_data = payload.get("user") or {}
    email = user_data.get("email")
    if not email:
        return None

    # As with API keys, detach the protected user before leaving the lookup
    # session.  No auth dependency holds a connection for the graph lifetime.
    async with AsyncSessionLocal() as db:
        user = await UserRepo(db).get_by_email(email)
        if not user:
            return None
        return _payload_for_user(user)


@auth.authenticate
async def authenticate(
    headers: Mapping[Any, Any] | None = None,
    authorization: str | None = None,
) -> dict[str, Any]:
    """Authenticate API keys or JWTs, returning anonymous on every failure.

    ``x-api-key`` intentionally has precedence over Bearer credentials to
    preserve Orchestra's existing credential behavior.  An invalid key does
    not raise here; protected handlers will turn the anonymous result into a
    401 and public handlers can continue without credentials.
    """
    try:
        api_key = _header_value(headers, "x-api-key")
        if api_key:
            # A supplied API key is authoritative.  Do not silently fall back
            # to a different credential when a rotated/revoked key is sent.
            return await _authenticate_api_key(api_key) or _anonymous_user()

        authorization = authorization or _header_value(headers, "authorization")
        return await _authenticate_bearer(authorization) or _anonymous_user()
    except (PyJWTError, HTTPException, KeyError, TypeError, ValueError):
        return _anonymous_user()
    except Exception:
        # Database outages and malformed credential records are auth failures,
        # not reasons for Aegra's authentication middleware to crash a public
        # route.  The protected authorization handler will enforce access.
        return _anonymous_user()


def _user_from_scope(request: Request) -> AegraUser | None:
    """Convert Aegra's Starlette user stored on the request scope."""
    raw = request.scope.get("user")
    if raw is None:
        return None
    data = raw.to_dict() if hasattr(raw, "to_dict") else raw
    if not isinstance(data, Mapping):
        data = {
            "identity": getattr(raw, "identity", None),
            "display_name": getattr(raw, "display_name", None),
            "is_authenticated": getattr(raw, "is_authenticated", False),
            "permissions": getattr(raw, "permissions", []),
        }
    identity = data.get("identity")
    if not identity:
        return None
    return AegraUser(
        id=str(identity),
        identity=str(identity),
        username=data.get("username"),
        email=data.get("email"),
        name=data.get("display_name") or data.get("name"),
        is_authenticated=bool(data.get("is_authenticated", False)),
        permissions=list(data.get("permissions") or []),
    )


def get_custom_user(request: Request) -> AegraUser:
    """Require the authenticated Aegra user for an Orchestra custom route."""
    user = _user_from_scope(request)
    if user is None or not user.is_authenticated or user.identity == _ANONYMOUS_IDENTITY:
        raise HTTPException(status_code=401, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})
    return user


def get_optional_custom_user(request: Request) -> AegraUser | None:
    """Return a guest-capable custom-route user without enforcing auth."""
    user = _user_from_scope(request)
    if user is None or not user.is_authenticated:
        return None
    return user


def _require_tenant(ctx: Any) -> dict[str, str]:
    """Require an authenticated tenant and return the protocol filter shape."""
    user = ctx.user
    if user is None or not getattr(user, "is_authenticated", False) or user.identity == _ANONYMOUS_IDENTITY:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Authentication required")
    # Aegra 0.9.25 already pins user_id in its SQL queries.  Keep this filter
    # explicit as the authorization contract for versions that consume auth
    # filters directly, too.
    return {"user_id": str(user.identity)}


@auth.on.threads.create
async def authorize_thread_create(ctx: Any, value: dict[str, Any]) -> dict[str, str]:
    return _require_tenant(ctx)


@auth.on.threads.search
async def authorize_thread_search(ctx: Any, value: dict[str, Any]) -> dict[str, str]:
    return _require_tenant(ctx)


@auth.on.threads.read
async def authorize_thread_read(ctx: Any, value: dict[str, Any]) -> dict[str, str]:
    return _require_tenant(ctx)


@auth.on.threads.update
async def authorize_thread_update(ctx: Any, value: dict[str, Any]) -> dict[str, str]:
    return _require_tenant(ctx)


@auth.on.threads.delete
async def authorize_thread_delete(ctx: Any, value: dict[str, Any]) -> dict[str, str]:
    return _require_tenant(ctx)


@auth.on.assistants.create
async def authorize_assistant_create(ctx: Any, value: dict[str, Any]) -> dict[str, str]:
    return _require_tenant(ctx)


@auth.on.assistants.search
async def authorize_assistant_search(ctx: Any, value: dict[str, Any]) -> dict[str, str]:
    return _require_tenant(ctx)


@auth.on.assistants.read
async def authorize_assistant_read(ctx: Any, value: dict[str, Any]) -> dict[str, str]:
    return _require_tenant(ctx)


@auth.on.assistants.update
async def authorize_assistant_update(ctx: Any, value: dict[str, Any]) -> dict[str, str]:
    return _require_tenant(ctx)


@auth.on.assistants.delete
async def authorize_assistant_delete(ctx: Any, value: dict[str, Any]) -> dict[str, str]:
    return _require_tenant(ctx)


@auth.on(resources="runs")
async def authorize_runs(ctx: Any, value: dict[str, Any]) -> dict[str, str]:
    return _require_tenant(ctx)


@auth.on.store
async def authorize_store(ctx: Any, value: dict[str, Any]) -> None:
    """Keep protocol store operations tenant-scoped; guests cannot use store."""
    user = ctx.user
    if user is None or not getattr(user, "is_authenticated", False) or user.identity == _ANONYMOUS_IDENTITY:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Authentication required")
    # Aegra applies its reserved users/<identity> scope after this handler.
    # Rewriting the namespace here prevents a client from selecting another
    # tenant on Aegra versions that do not apply the default scope.
    namespace = value.get("namespace") or []
    if isinstance(namespace, str):
        namespace = [part for part in namespace.split(".") if part]
    if not isinstance(namespace, list):
        namespace = list(namespace)
    prefix = ["users", str(user.identity)]
    if namespace[: len(prefix)] != prefix:
        value["namespace"] = prefix + namespace


async def _public_assistant(assistant_id: str | None) -> Any:
    if not assistant_id:
        return None
    from src.services.assistant import AssistantService

    try:
        return await AssistantService(user_id=None, store=get_store()).get_public(str(assistant_id))
    except Exception:
        return None


@auth.on.threads.create_run
async def authorize_create_run(ctx: Any, value: dict[str, Any]) -> dict[str, Any] | None:
    """Authorize authenticated runs and anonymous runs for public assistants."""
    user = ctx.user
    authenticated = bool(user and getattr(user, "is_authenticated", False) and user.identity != _ANONYMOUS_IDENTITY)
    config = value.get("config") if isinstance(value.get("config"), dict) else {}
    configurable = config.get("configurable") if isinstance(config.get("configurable"), dict) else {}
    context = value.get("context") if isinstance(value.get("context"), dict) else {}
    assistant_id = context.get("assistant_id") or configurable.get("assistant_id")
    assistant = None

    if not authenticated:
        assistant = await _public_assistant(assistant_id)
        if assistant is None:
            raise Auth.exceptions.HTTPException(status_code=401, detail="Authentication required")

        model = context.get("model") or configurable.get("model") or getattr(assistant, "model", None)
        from src.utils.auth import is_authorized_model

        if model and not is_authorized_model(model):
            raise Auth.exceptions.HTTPException(
                status_code=403,
                detail=f"Unauthorized [{model}]\nPlease sign in for higher limits and better models!",
            )

    # The runtime identity is authoritative even when the client includes a
    # forged configurable.user_id.  Aegra copies these values into the run
    # payload, and the factory removes them again before ServiceContext.
    identity = str(user.identity) if user is not None else _ANONYMOUS_IDENTITY
    value_context = dict(context)
    value_context["user_id"] = identity
    value["context"] = value_context
    value_config = dict(config)
    value_configurable = dict(configurable)
    value_configurable["user_id"] = identity
    value_config["configurable"] = value_configurable
    value["config"] = value_config

    if authenticated:
        return None
    return {"context": value_context, "config": value_config}


__all__ = [
    "AegraUser",
    "auth",
    "authenticate",
    "get_custom_user",
    "get_optional_custom_user",
    "get_store",
]
