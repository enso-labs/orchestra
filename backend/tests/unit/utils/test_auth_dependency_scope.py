"""Auth must not hold a pooled DB connection for the duration of a request.

Previously these dependencies took `db: AsyncSession = Depends(get_async_db, scope="function")`.
Function scope releases the session when the *path operation function* returns. A pooled
connection was therefore pinned for the whole request, exhausting the pool under load.

Auth now opens its own short-lived session around the user lookup, so these tests assert
the stronger property: no session dependency at all.
"""

import inspect

from src.utils.auth import (
    get_optional_user,
    get_optional_user_from_token,
    verify_credentials,
)

AUTH_DEPENDENCIES = (
    get_optional_user_from_token,
    get_optional_user,
    verify_credentials,
)


def test_auth_does_not_take_a_session_dependency() -> None:
    """A `db` parameter here would hold the connection for the whole request again."""
    for dependency in AUTH_DEPENDENCIES:
        parameters = inspect.signature(dependency).parameters
        assert "db" not in parameters, (
            f"{dependency.__name__}() declares a 'db' dependency. FastAPI runs dependency "
            f"teardown after the endpoint returns, so this pins a pooled connection for the "
            f"entire request — the pool-exhaustion regression from issue #955."
        )


def test_auth_opens_its_own_short_lived_session() -> None:
    source = inspect.getsource(verify_credentials)

    assert "async with AsyncSessionLocal()" in source, (
        "verify_credentials must scope its session to the user lookup itself"
    )
    assert "Depends(get_async_db" not in source
