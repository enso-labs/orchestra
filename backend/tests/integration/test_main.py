from tests import client


def test_ping():
    response = client.get("/api/info/health")
    # print(response.json())
    assert response.status_code == 200
