from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from langchain_core.documents import Document
from pydantic import field_serializer

class Project(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    documents: Optional[list[Document]] = None
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @field_serializer("created_at", "updated_at")
    def serialize_dt(self, dt: Optional[datetime], _):
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return dt.isoformat()
        # Assume it's already a string (e.g., loaded from db or elsewhere), return as-is
        return dt
    
class Source(BaseModel):
	id: Optional[str] = None
	type: str
	docs: Optional[list[Document]] = None
	metadata: dict = {}
	updated_at: Optional[datetime] = None
	created_at: Optional[datetime] = None