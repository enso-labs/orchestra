import uuid
from fastapi import APIRouter, Body, Depends, HTTPException, status, Path, Response
from fastapi_cache.decorator import cache

from langgraph.store.postgres import AsyncPostgresStore

from src.contexts.service import ServiceContext
from src.constants.examples import Examples
from src.schemas.models import ProtectedUser
from src.services.db import get_store
from src.utils.auth import verify_credentials
from src.utils.logger import logger
from src.services.assistant import (
    AssistantSearch,
    Assistant,
    ASSISTANT_EXAMPLES,
)


################################################################################
### Create Assistant
################################################################################
router = APIRouter(tags=["Assistant"], prefix="/assistants")


@router.post("/search", name="Query Assistants", operation_id="ruska_search_assistants")
@cache(expire=30)
async def search_assistants(
    assistant_search: AssistantSearch = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    # If id is provided, return the assistant
    if "id" in assistant_search.filter:
        assistant = await service_context.assistant_service.get(
            assistant_search.filter["id"]
        )
        return {"assistants": [assistant.model_dump()]}
    # If id is not provided, return all assistants
    assistants: list[Assistant] = await service_context.assistant_service.search()
    if assistants:
        return {"assistants": [assistant.model_dump() for assistant in assistants]}
    return {"assistants": []}


@router.post("", name="Create Assistant", operation_id="ruska_create_assistant")
async def create_assistant(
    assistant: Assistant = Body(
        ..., examples={"currency_agent": ASSISTANT_EXAMPLES["currency_agent"]}
    ),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        assistant_id = str(uuid.uuid4())
        service_context = ServiceContext(user_id=user.id, store=store)
        existing_assistant = await service_context.assistant_service.get(assistant_id)
        if existing_assistant:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Assistant already exists"
            )
        assistant = await service_context.assistant_service.update(
            assistant_id, assistant.model_dump()
        )
        return {"assistant_id": assistant_id}

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception(f"Error creating assistant: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put(
    "/{assistant_id}", name="Update Assistant", operation_id="ruska_update_assistant"
)
async def update_assistant(
    assistant_id: str = Path(..., description="The ID of the assistant to update"),
    assistant: Assistant = Body(
        ..., examples={"currency_agent": Examples.ASSISTANT_EXAMPLES["currency_agent"]}
    ),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        service_context = ServiceContext(user_id=user.id, store=store)
        await service_context.assistant_service.update(
            assistant_id, assistant.model_dump()
        )
        return {"assistant_id": assistant_id}

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception(f"Error creating assistant: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete(
    "/{assistant_id}", name="Delete Assistant", operation_id="ruska_delete_assistant"
)
async def delete_assistant(
    assistant_id: str = Path(..., description="The ID of the assistant to delete"),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    await service_context.assistant_service.delete(assistant_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
