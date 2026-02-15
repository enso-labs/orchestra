from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from langgraph.store.base import BaseStore
from deepagents.backends.utils import create_file_data

from src.repos.memory_repo import MemoryRepo
from src.schemas.entities.memory import (
    Memory,
    MemoryCreate,
    MemoryListResponse,
    MemoryUpdate,
)
from src.schemas.models import ProtectedUser
from src.services.db import get_store
from src.utils.auth import verify_credentials
from src.utils.logger import logger

router = APIRouter(tags=["Memory"], prefix="/memories")


def _get_repo(user: ProtectedUser, store: BaseStore) -> MemoryRepo:
    return MemoryRepo(str(user.id), store)


@router.get("", response_model=MemoryListResponse)
async def list_memories(
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    query: str = Query(default=""),
) -> MemoryListResponse:
    try:
        repo = _get_repo(user, store)
        memories, total = await repo.list(limit=limit, offset=offset, query=query)
        return MemoryListResponse(
            memories=memories, total=total, limit=limit, offset=offset
        )
    except Exception as e:
        logger.exception(f"Error listing memories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get("/files")
async def get_memory_files(
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> dict:
    repo = _get_repo(user, store)
    memories, _ = await repo.list(limit=1000)
    result = {}
    for m in memories:
        if not m.enabled:
            continue
        path = f"/{m.id}" if not m.id.startswith("/") else m.id
        result[path] = create_file_data(
            m.content,
            created_at=m.created_at.isoformat() if m.created_at else None,
        )
    return result


@router.get("/{memory_id}", response_model=Memory)
async def get_memory(
    memory_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> Memory:
    repo = _get_repo(user, store)
    memory = await repo.get(memory_id)
    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found"
        )
    return memory


@router.post("", response_model=Memory, status_code=status.HTTP_201_CREATED)
async def create_memory(
    body: MemoryCreate,
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> Memory:
    try:
        repo = _get_repo(user, store)
        return await repo.create(
            content=body.content, metadata=body.metadata, path=body.path
        )
    except Exception as e:
        logger.exception(f"Error creating memory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.put("/{memory_id}", response_model=Memory)
async def update_memory(
    memory_id: str,
    body: MemoryUpdate,
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> Memory:
    repo = _get_repo(user, store)
    memory = await repo.update(
        memory_id=memory_id,
        content=body.content,
        metadata=body.metadata,
        enabled=body.enabled,
    )
    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found"
        )
    return memory


@router.patch("/{memory_id}/toggle", response_model=Memory)
async def toggle_memory(
    memory_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> Memory:
    repo = _get_repo(user, store)
    memory = await repo.get(memory_id)
    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found"
        )
    updated = await repo.update(
        memory_id=memory_id,
        content=memory.content,
        metadata=memory.metadata,
        enabled=not memory.enabled,
    )
    return updated


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> Response:
    repo = _get_repo(user, store)
    success = await repo.delete(memory_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found"
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
