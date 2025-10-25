from fastapi import APIRouter, Body, Depends, HTTPException, status, Path, Response

from langgraph.store.postgres import AsyncPostgresStore

from src.contexts.service import ServiceContext
from src.constants.examples import Examples
from src.schemas.models import ProtectedUser
from src.schemas.models.memory import Memory, MemorySearch
from src.services.db import get_store
from src.utils.auth import verify_credentials
from src.utils.logger import logger


################################################################################
### Memory Routes
################################################################################
router = APIRouter(tags=["Memory"], prefix="/memories")


@router.post("/search", name="Query Memories")
async def search_memories(
    memory_search: MemorySearch = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    # If id is provided, return the specific memory
    if "id" in memory_search.filter:
        memory = await service_context.memory_service.get(memory_search.filter["id"])
        return {"memories": [memory.model_dump()] if memory else []}
    # If id is not provided, return all memories (with optional query filter)
    memories: list[Memory] = await service_context.memory_service.search(
        query=memory_search.query,
        limit=memory_search.limit
    )
    return {"memories": [memory.model_dump() for memory in memories]}


@router.post("", name="Create Memory")
async def create_memory(
    memory: Memory = Body(
        ..., examples={"user_preference": Examples.MEMORY_EXAMPLES["user_preference"]}
    ),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        service_context = ServiceContext(user_id=user.id, store=store)
        memory_key = memory.key
        
        # Check if memory already exists
        existing_memory = await service_context.memory_service.get(memory_key)
        if existing_memory:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Memory already exists"
            )
        
        # Store the memory data
        memory_data = {
            "value": memory.value,
            "ttl": memory.ttl,
            "metadata": memory.metadata
        }
        await service_context.memory_service.update(memory_key, memory_data, ttl=memory.ttl)
        return {"memory_key": memory_key}

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception(f"Error creating memory: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{memory_key}", name="Update Memory")
async def update_memory(
    memory_key: str = Path(..., description="The key of the memory to update"),
    memory: Memory = Body(
        ..., examples={"conversation_context": Examples.MEMORY_EXAMPLES["conversation_context"]}
    ),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        service_context = ServiceContext(user_id=user.id, store=store)
        
        # Store the memory data
        memory_data = {
            "value": memory.value,
            "ttl": memory.ttl,
            "metadata": memory.metadata
        }
        await service_context.memory_service.update(memory_key, memory_data, ttl=memory.ttl)
        return {"memory_key": memory_key}

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception(f"Error updating memory: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{memory_key}", name="Delete Memory")
async def delete_memory(
    memory_key: str = Path(..., description="The key of the memory to delete"),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    await service_context.memory_service.delete(memory_key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

