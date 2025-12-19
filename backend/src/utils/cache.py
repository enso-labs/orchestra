"""
Cache utilities for fastapi-cache2 integration.
Provides user-scoped caching for API endpoints.
"""

import hashlib
from typing import Optional
from fastapi import Request, Response
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend


def user_cache_key_builder(
    func,
    namespace: str = "",
    request: Optional[Request] = None,
    response: Optional[Response] = None,
    args: tuple = (),
    kwargs: dict = {},
) -> str:
    """
    Build a cache key that includes the user ID for proper isolation.
    
    Cache keys are scoped per user to ensure data isolation between users.
    The key includes: namespace, module, function name, user ID, and hashed kwargs.
    """
    # Extract user from kwargs (injected by Depends)
    user = kwargs.get("user")
    user_id = user.id if user else "anonymous"
    
    # Build base key with user scope
    prefix = f"{namespace}:{func.__module__}:{func.__name__}:{user_id}"
    
    # Hash relevant kwargs (exclude non-serializable objects)
    excluded_keys = {"user", "store", "request", "response"}
    filtered_kwargs = {
        k: v for k, v in kwargs.items() 
        if k not in excluded_keys and v is not None
    }
    
    # Create hash of kwargs for cache key uniqueness
    if filtered_kwargs:
        # Convert kwargs to stable string representation
        kwargs_str = str(sorted(filtered_kwargs.items()))
        kwargs_hash = hashlib.md5(kwargs_str.encode()).hexdigest()[:8]
        return f"{prefix}:{kwargs_hash}"
    
    return prefix


def init_cache() -> None:
    """Initialize FastAPICache with InMemoryBackend."""
    FastAPICache.init(
        InMemoryBackend(),
        prefix="orchestra-cache",
        key_builder=user_cache_key_builder,
    )

