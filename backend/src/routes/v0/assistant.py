import uuid
from fastapi import APIRouter, Body, Depends, HTTPException, status, Path, Response

from langgraph.store.postgres import AsyncPostgresStore

from src.constants.examples import Examples
from src.schemas.models import ProtectedUser
from src.services.db import get_store
from src.utils.auth import verify_credentials
from src.utils.logger import logger
from src.services.assistant import (
    assistant_service,
    AssistantSearch,
    Assistant,
    ASSISTANT_EXAMPLES,
)


################################################################################
### Create Assistant
################################################################################
router = APIRouter(tags=["Assistant"], prefix="/assistants")


@router.post("/search", name="Query Assistants")
async def search_assistants(
    assistant_search: AssistantSearch = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    assistant_service.store = store
    assistant_service.user_id = user.id
    assistants = await assistant_service.search(
        limit=assistant_search.limit,
    )
    return {"assistants": assistants}


@router.post("", name="Create Assistant")
async def create_assistant(
    assistant: Assistant = Body(..., example=ASSISTANT_EXAMPLES["currency_agent"]),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        assistant_service.store = store
        assistant_service.user_id = user.id
        assistant_id = str(uuid.uuid4())
        existing_assistant = await assistant_service.get(assistant_id)
        if existing_assistant:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Assistant already exists"
            )
        assistant = await assistant_service.update(assistant_id, assistant.model_dump())
        return {"assistant_id": assistant_id}

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception(f"Error creating assistant: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{assistant_id}", name="Update Assistant")
async def update_assistant(
    assistant_id: str = Path(..., description="The ID of the assistant to update"),
    assistant: Assistant = Body(
        ..., example=Examples.ASSISTANT_EXAMPLES["currency_agent"]
    ),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        assistant_service.store = store
        assistant_service.user_id = user.id
        assistant = await assistant_service.update(assistant_id, assistant.model_dump())
        return {"assistant_id": assistant_id}

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception(f"Error creating assistant: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{assistant_id}", name="Delete Assistant")
async def delete_assistant(
    assistant_id: str = Path(..., description="The ID of the assistant to delete"),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    assistant_service.store = store
    assistant_service.user_id = user.id
    await assistant_service.delete(assistant_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
