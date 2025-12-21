from pydantic import BaseModel
from typing import Optional


class ContextSchema(BaseModel):
    model: str
    user_id: Optional[str] = None
