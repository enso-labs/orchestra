from pydantic import BaseModel, EmailStr, Field, field_serializer
from typing import Optional
from datetime import datetime
from src.schemas.entities.store import BaseEntity


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
    user: UserResponse


class ApiToken(BaseEntity):
    name: str = Field(..., description="The name of the token")
    token_hash: str = Field(..., description="The hash of the token")
    prefix: str = Field(..., description="The prefix of the token for display")
    last_used_at: Optional[datetime] = Field(
        None, description="When the token was last used"
    )
    user_id: str = Field(..., description="ID of the user who owns this token")

    @field_serializer("last_used_at")
    def serialize_last_used_at(self, dt: Optional[datetime], _):
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return dt.isoformat()
        return dt
