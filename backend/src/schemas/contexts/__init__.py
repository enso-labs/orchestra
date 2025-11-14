from dataclasses import dataclass


@dataclass
class ContextSchema:
    model: str = None
    user_id: str = None