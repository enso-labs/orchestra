import uuid
import httpx
import json
from httpx_sse import connect_sse
from typing import Any, AsyncIterable
from src.utils.logger import logger
from fastapi.responses import StreamingResponse, JSONResponse
from src.common.types import (
    AgentCard,
    GetTaskRequest,
    SendTaskRequest,
    SendTaskResponse,
    JSONRPCRequest,
    GetTaskResponse,
    CancelTaskResponse,
    CancelTaskRequest,
    SetTaskPushNotificationRequest,
    SetTaskPushNotificationResponse,
    GetTaskPushNotificationRequest,
    GetTaskPushNotificationResponse,
    A2AClientHTTPError,
    A2AClientJSONError,
    SendTaskStreamingRequest,
    SendTaskStreamingResponse,
    Task,
)


class A2ACardResolver:
    def __init__(self, base_url, agent_card_path="/.well-known/agent.json"):
        self.base_url = base_url.rstrip("/")
        self.agent_card_path = agent_card_path.lstrip("/")

    def get_agent_card(self) -> AgentCard:
        with httpx.Client() as client:
            response = client.get(self.base_url + "/" + self.agent_card_path)
            response.raise_for_status()
            try:
                return AgentCard(**response.json())
            except json.JSONDecodeError as e:
                raise A2AClientJSONError(str(e)) from e


class A2AClient:
    def __init__(self, agent_card: AgentCard = None, url: str = None):
        if agent_card:
            self.url = agent_card.url
        elif url:
            self.url = url
        else:
            raise ValueError("Must provide either agent_card or url")

    async def send_task(self, payload: dict[str, Any]) -> SendTaskResponse:
        """
        Send query to remote agent
        Args:
            payload: dict[str, Any]
        Returns:
            SendTaskResponse
        """
        request = SendTaskRequest(params=payload)
        return SendTaskResponse(**await self._send_request(request))

    async def send_task_streaming(
        self, payload: dict[str, Any]
    ) -> AsyncIterable[SendTaskStreamingResponse]:
        request = SendTaskStreamingRequest(params=payload)
        with httpx.Client(timeout=None) as client:
            with connect_sse(
                client, "POST", self.url, json=request.model_dump()
            ) as event_source:
                try:
                    for sse in event_source.iter_sse():
                        yield SendTaskStreamingResponse(**json.loads(sse.data))
                except json.JSONDecodeError as e:
                    raise A2AClientJSONError(str(e)) from e
                except httpx.RequestError as e:
                    raise A2AClientHTTPError(400, str(e)) from e

    async def _send_request(self, request: JSONRPCRequest) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            try:
                # Image generation could take time, adding timeout
                response = await client.post(
                    self.url, json=request.model_dump(), timeout=30
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                raise A2AClientHTTPError(e.response.status_code, str(e)) from e
            except json.JSONDecodeError as e:
                raise A2AClientJSONError(str(e)) from e

    async def get_task(self, payload: dict[str, Any]) -> GetTaskResponse:
        request = GetTaskRequest(params=payload)
        return GetTaskResponse(**await self._send_request(request))

    async def cancel_task(self, payload: dict[str, Any]) -> CancelTaskResponse:
        request = CancelTaskRequest(params=payload)
        return CancelTaskResponse(**await self._send_request(request))

    async def set_task_callback(
        self, payload: dict[str, Any]
    ) -> SetTaskPushNotificationResponse:
        request = SetTaskPushNotificationRequest(params=payload)
        return SetTaskPushNotificationResponse(**await self._send_request(request))

    async def get_task_callback(
        self, payload: dict[str, Any]
    ) -> GetTaskPushNotificationResponse:
        request = GetTaskPushNotificationRequest(params=payload)
        return GetTaskPushNotificationResponse(**await self._send_request(request))


async def process_a2a_streaming(
    thread: dict,
    thread_id: str,
):
    client = A2AClient(url=thread.a2a.base_url)
    response = client.send_task_streaming(
        payload={
            "id": thread_id,
            "sessionId": thread_id,
            "acceptedOutputModes": ["text"],
            "message": {
                "role": "user",
                "parts": [{"type": "text", "text": thread.query}],
            },
        }
    )

    async def stream_generator():
        try:
            async for chunk in response:
                d = chunk.result.model_dump()
                d["sessionId"] = thread_id
                yield f"data: {json.dumps(d)}\n\n"
        except Exception as e:
            logger.error(f"Error in stream_generator: {str(e)}")
            logger.exception("Stream generation failed")
            raise

    return StreamingResponse(stream_generator(), media_type="text/event-stream")


async def process_a2a(thread: dict, thread_id: str):
    client = A2AClient(url=thread.a2a.base_url)
    response = await client.send_task(
        payload={
            "id": thread_id,
            "sessionId": thread_id,
            "acceptedOutputModes": ["text"],
            "message": {
                "role": "user",
                "parts": [{"type": "text", "text": thread.query}],
            },
        }
    )
    return JSONResponse(content={"answer": response.result.model_dump()})


async def a2a_builder(
    base_url: str,
    query: str,
    thread_id: str = None,
):
    if not thread_id:
        thread_id = str(uuid.uuid4())
    client = A2AClient(url=base_url)
    response = await client.send_task(
        payload={
            "id": thread_id,
            "sessionId": thread_id,
            "acceptedOutputModes": ["text"],
            "message": {"role": "user", "parts": [{"type": "text", "text": query}]},
        }
    )
    return response.result.model_dump_json()
