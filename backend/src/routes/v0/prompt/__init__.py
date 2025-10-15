import uuid
from fastapi import APIRouter, Body, Depends, HTTPException, status, Path, Response

from langgraph.store.postgres import AsyncPostgresStore

from .revision import router as revision_router
from src.schemas.models import ProtectedUser
from src.services.db import get_store
from src.utils.auth import verify_credentials
from src.utils.logger import logger
from src.services.prompt import prompt_service, PromptSearch, Prompt, PROMPT_EXAMPLES
from src.utils.format import raw_html


router = APIRouter(tags=["Prompt"], prefix="/prompts")

################################################################################
### Search Prompts
################################################################################
@router.post("/search", name="Query Prompts")
async def search_prompts(
    prompt_search: PromptSearch = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    prompt_service.store = store
    prompt_service.user_id = user.id
    # Return single prompt revision
    if "id" in prompt_search.filter and "v" in prompt_search.filter:
        prompt = await prompt_service.get(prompt_search.filter["id"], prompt_search.filter["v"])
        return {"prompts": [prompt]}
    ## Return single prompt
    if "id" in prompt_search.filter:
        prompt = await prompt_service.get(prompt_search.filter["id"])
        return {"prompts": [prompt]}
    # Return all prompts
    prompts = await prompt_service.search(prompt_search)
    return {"prompts": prompts}


################################################################################
### Create Prompt
################################################################################
@router.post("", name="Create Prompt")
async def create_prompt(
    prompt: Prompt = Body(..., example=PROMPT_EXAMPLES["default_prompt"]),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        prompt_service.store = store
        prompt_service.user_id = user.id
        prompt_id = str(uuid.uuid4())
        prompt = await prompt_service.revision(prompt_id, prompt)
        return {"prompt_id": prompt_id}

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception(f"Error creating prompt: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# static_router = APIRouter(tags=["Static"], prefix="/static")
@router.get("/{prompt_id}")
async def view_public_prompt(
    prompt_id: str = Path(..., description="The ID of the prompt to get"),
    store: AsyncPostgresStore = Depends(get_store),
):
    prompt_service.store = store
    revisions = await prompt_service.list_revisions(prompt_id, public=True)
    if not revisions:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")
    return Response(content=revisions[-1].content, media_type="text/plain")

################################################################################
### Search Prompts
################################################################################
@router.put("/{prompt_id}/public", name="Toggle Prompt Public")
async def toggle_prompt_public(
    prompt_id: str = Path(..., description="The ID of the prompt to toggle public"),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        prompt_service.store = store
        prompt_service.user_id = user.id
        public = await prompt_service.toggle_public(prompt_id)
        return {"prompt_id": prompt_id, "public": public}

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception(f"Error creating prompt: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
router.include_router(revision_router)