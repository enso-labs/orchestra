# import pytest


# @pytest.mark.asyncio
# async def test_list_tools(async_client, auth_headers):
#     """Test listing all available tools."""
#     response = await async_client.get("/api/tools", headers=auth_headers)
#     assert response.status_code == 200
#     data = response.json()
#     assert "tools" in data
#     assert isinstance(data["tools"], list)
