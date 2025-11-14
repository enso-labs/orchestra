import json

from main import app
from starlette.testclient import TestClient
from src.services.db import get_async_db
from src.repos.user_repo import UserRepo

client = TestClient(app)


def disabled(f):
    def _decorator():
        print(f.__name__ + " has been disabled")

    return _decorator


def get_test_token():
    data = {"email": "admin@example.com", "password": "test1234"}
    headers = {
        "Content-Type": "application/json",
    }
    response = client.post("/api/auth/login", json=data, headers=headers)
    json_str = json.loads(response.content)
    return json_str["token"]

async def get_test_user():
    async for db in get_async_db():
        user_repo = UserRepo(db=db)
        user = await user_repo.get_by_email("admin@example.com")
        return user.protected()
