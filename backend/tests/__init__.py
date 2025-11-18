import json

from main import app
from starlette.testclient import TestClient

# Sync client for token generation (used in setup)
client = TestClient(app)


def disabled(f):
    def _decorator():
        print(f.__name__ + " has been disabled")

    return _decorator


def get_test_token():
    """Get test token using sync client for setup purposes."""
    data = {"email": "admin@example.com", "password": "test1234"}
    headers = {
        "Content-Type": "application/json",
    }
    response = client.post("/api/auth/login", json=data, headers=headers)
    json_str = json.loads(response.content)
    return json_str["access_token"]
