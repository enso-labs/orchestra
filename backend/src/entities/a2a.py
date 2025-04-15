from pydantic import BaseModel, Field
from typing import List

class A2AServer(BaseModel):
    base_url: str
    agent_card_path: str
    
    model_config = {
        "json_schema_extra": {"example": {"base_url": "https://a2a.enso.sh", "agent_card_path": "/.well-known/agent.json"}}
    }

class A2AServers(BaseModel):
    servers: List[A2AServer] = Field(default=[A2AServer(base_url="https://a2a.enso.sh", agent_card_path="/.well-known/agent.json")])
    
    model_config = {
        "json_schema_extra": {"example": {"servers": [{"base_url": "https://a2a.enso.sh", "agent_card_path": "/.well-known/agent.json"}]}}
    }