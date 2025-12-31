from pydantic import BaseModel
from typing import Optional
from dataclasses import dataclass


@dataclass
class ContextSchema:
    model: str
    user_id: Optional[str] = None
