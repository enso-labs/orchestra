from pydantic.dataclasses import dataclass
from typing import Optional


@dataclass
class ContextSchema:
    model: str
    user_id: Optional[str] = None
