import json

from main import app
from starlette.testclient import TestClient

client = TestClient(app)


def disabled(f):
    def _decorator():
        print(f.__name__ + " has been disabled")

    return _decorator


def get_test_token():
    data = {"email": "test@example.com", "password": "test1234"}
    headers = {
        "Content-Type": "application/json",
    }
    response = client.post("/auth/login", json=data, headers=headers)
    json_str = json.loads(response.content)
    return json_str["token"]
