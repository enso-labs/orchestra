from typing import Any
from pydantic import BaseModel, EmailStr

from src.models import ProtectedUser

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    name: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    name: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: ProtectedUser
    # refresh_token: str
    # expires_in: int
    # expires_at: int
    