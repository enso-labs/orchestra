from tests import client, disabled, get_test_token

@disabled
def test_list_tools():
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/tools", headers=headers)
    assert response.status_code == 200
