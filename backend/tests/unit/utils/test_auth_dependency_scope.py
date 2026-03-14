import inspect

from src.utils.auth import (
    get_optional_user,
    get_optional_user_from_token,
    verify_credentials,
)


def test_auth_db_dependencies_close_at_function_scope() -> None:
    functions = [
        get_optional_user_from_token,
        get_optional_user,
        verify_credentials,
    ]

    for dependency in functions:
        db_parameter = inspect.signature(dependency).parameters["db"]
        assert db_parameter.default.scope == "function"
