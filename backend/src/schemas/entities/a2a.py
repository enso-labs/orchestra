from pydantic import BaseModel, Field
from typing import List

class A2AServer(BaseModel):
    base_url: str
    agent_card_path: str
    
    model_config = {
        "json_schema_extra": {"example": {"base_url": "https://a2a.enso.sh", "agent_card_path": "/.well-known/agent.json"}}
    }

class A2AServers(BaseModel):
    a2a: dict[str, A2AServer] = Field(default={"enso_a2a": A2AServer(base_url="https://a2a.enso.sh", agent_card_path="/.well-known/agent.json")})
    
    model_config = {
        "json_schema_extra": {"example": {"a2a": {"enso_a2a": {"base_url": "https://a2a.enso.sh", "agent_card_path": "/.well-known/agent.json"}}}}
    }