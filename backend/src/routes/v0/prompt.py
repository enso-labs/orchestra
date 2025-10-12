import uuid
from fastapi import APIRouter, Body, Depends, HTTPException, status, Path, Response

from langgraph.store.postgres import AsyncPostgresStore

from src.schemas.models import ProtectedUser
from src.services.db import get_store
from src.utils.auth import verify_credentials
from src.utils.logger import logger
from src.services.prompt import prompt_service, PromptSearch, Prompt, PROMPT_EXAMPLES
from src.utils.format import raw_html


router = APIRouter(tags=["Prompt"], prefix="/prompts")

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
    prompts = await prompt_service.search()
    return {"prompts": prompts}

################################################################################
### Search Prompts
################################################################################
@router.get("/{prompt_id}/public", name="Toggle Prompt Public")
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


################################################################################
### Prompt Revision
################################################################################
@router.post("/{prompt_id}/v", name="Prompt Revision")
async def revise_prompt(
    prompt_id: str = Path(..., description="The ID of the prompt to update"),
    prompt: Prompt = Body(..., example=PROMPT_EXAMPLES["pirate_prompt"]),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        prompt_service.store = store
        prompt_service.user_id = user.id
        revisions = await prompt_service.list_revisions(prompt_id)
        existing_prompt = revisions[-1]
        if not existing_prompt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found"
            )
        if prompt.content is not None:
            existing_prompt.content = prompt.content
        if prompt.name is not None:
            existing_prompt.name = prompt.name
        v = await prompt_service.revision(prompt_id, existing_prompt)
        return {"prompt_id": prompt_id, "v": v}

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception(f"Error creating prompt: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

################################################################################
### List Prompt Revisions
################################################################################
@router.get("/{prompt_id}/v", name="List Prompt Revisions")
async def list_prompt_revisions(
    prompt_id: str = Path(..., description="The ID of the prompt to list revisions"),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    prompt_service.store = store
    prompt_service.user_id = user.id
    revisions = await prompt_service.list_revisions(prompt_id)
    return {"revisions": revisions}

################################################################################
### Delete Prompt
################################################################################
@router.delete("/{prompt_id}/v/{v}", name="Delete Prompt")
async def delete_prompt(
    prompt_id: str = Path(..., description="The ID of the prompt to delete"),
    v: int = Path(..., description="The version of the prompt to delete"),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    prompt_service.user_id = user.id
    prompt_service.store = store
    await prompt_service.delete(prompt_id, v)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


static_router = APIRouter(tags=["Static"], prefix="/static")
@static_router.get("/{prompt_id}")
async def view_static_prompt(
    prompt_id: str = Path(..., description="The ID of the prompt to get"),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    prompt_service.user_id = user.id
    prompt_service.store = store
    revisions = await prompt_service.list_revisions(prompt_id)
    if not revisions:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")
    html_content = raw_html(revisions[-1].content)
    return Response(content=html_content, media_type="text/html")

static_router = APIRouter(tags=["Static"], prefix="/static")
@static_router.get("/public/prompts/{prompt_id}")
async def view_public_prompt(
    prompt_id: str = Path(..., description="The ID of the prompt to get"),
    store: AsyncPostgresStore = Depends(get_store),
):
    prompt_service.store = store
    revisions = await prompt_service.list_revisions(prompt_id, public=True)
    if not revisions:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")
    html_content = raw_html(revisions[-1].content)
    return Response(content=html_content, media_type="text/html")

@static_router.get("/{prompt_id}/public")
async def view_static_prompt(
    prompt_id: str = Path(..., description="The ID of the prompt to get"),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    prompt_service.user_id = user.id
    prompt_service.store = store
    revisions = await prompt_service.list_revisions(prompt_id)
    if not revisions:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")
    html_content = raw_html(revisions[-1].content)
    return Response(content=html_content, media_type="text/html")