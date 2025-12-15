from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List
from src.schemas.models import User
from src.utils.auth import verify_credentials, generate_api_key_str, hash_token
from src.repos.api_token_repo import ApiTokenRepo
from src.schemas.entities.auth import ApiToken
from src.services.db import get_store

router = APIRouter(tags=["api-tokens"])

class CreateApiTokenRequest(BaseModel):
    name: str

class CreateApiTokenResponse(BaseModel):
    token: str
    api_token: ApiToken

@router.get("/tokens", response_model=List[ApiToken])
async def list_api_tokens(
    user: User = Depends(verify_credentials),
    store = Depends(get_store)
):
    repo = ApiTokenRepo(str(user.id), store)
    return await repo.list_tokens()

@router.post("/tokens", response_model=CreateApiTokenResponse)
async def create_api_token(
    req: CreateApiTokenRequest,
    user: User = Depends(verify_credentials),
    store = Depends(get_store)
):
    repo = ApiTokenRepo(str(user.id), store)
    
    # Generate token
    raw_token = generate_api_key_str()
    hashed = hash_token(raw_token)
    prefix = raw_token[:10] + "..." # Store prefix for display
    
    token = await repo.create_token(req.name, hashed, prefix)
    
    return CreateApiTokenResponse(token=raw_token, api_token=token)

@router.delete("/tokens/{token_id}")
async def revoke_api_token(
    token_id: str,
    user: User = Depends(verify_credentials),
    store = Depends(get_store)
):
    repo = ApiTokenRepo(str(user.id), store)
    success = await repo.revoke_token(token_id)
    if not success:
        raise HTTPException(status_code=404, detail="Token not found")
    return {"status": "success"}

