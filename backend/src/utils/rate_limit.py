from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


limiter = Limiter(key_func=get_remote_address, default_limits=["200/day"])


def get_limiter(request: Request) -> Limiter:
    return request.app.state.limiter
