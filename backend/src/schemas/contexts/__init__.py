from dataclasses import dataclass
from src.schemas.models import ProtectedUser


@dataclass
class ContextSchema:
    user: ProtectedUser
