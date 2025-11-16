from typing import Any
from uuid import uuid4

from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from langgraph.store.base import BaseStore
from langchain_core.documents import Document
from src.utils.logger import logger

from src.repos.base_repo import BaseRepo
from src.services.db import get_store_in_memory
from src.schemas.entities.store import Source

class SourceRepo(BaseRepo):
	def __init__(self, 
		user_id: str, 
		store: BaseStore = get_store_in_memory()
	):
		self.user_id = user_id
		self.store: BaseStore = store
		super().__init__(user_id=user_id, store=store, entity_type="sources")
	
 
	##################################################################
	## Source CRUD Methods
	##################################################################
	async def create(self, project_id: str, source: Source) -> bool:
		try:
			source.id = str(uuid4())
			source.metadata["project_id"] = project_id
			source.created_at = datetime.now()
			source.updated_at = datetime.now()
			created = await self._set(source_id=source.id, source=source)
			if created:
				return source.id
			else:
				raise Exception("Failed to create source")
		except Exception as e:
			logger.error(f"Error adding source: {e}")
			raise e
