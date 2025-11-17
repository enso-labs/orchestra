from uuid import uuid4

from datetime import datetime
from langgraph.store.base import BaseStore, SearchItem
from src.utils.logger import logger

from src.repos.base_repo import BaseRepo
from src.services.db import get_store_in_memory
from src.schemas.entities.store import Source
from src.schemas.entities import SearchFilter
from src.repos.doc_repo import DocRepo

class SourceRepo(BaseRepo):
	def __init__(self, 
		user_id: str, 
		store: BaseStore = get_store_in_memory()
	):
		## Add fields to the store
		store.fields = ["page_content", "metadata"]
		self.user_id = user_id
		self.store: BaseStore = store
		self.doc_repo = DocRepo(user_id=user_id, store=store)
		super().__init__(user_id=user_id, store=store, entity_type="sources")
	
 
	##################################################################
	## Source CRUD Methods
	##################################################################
	async def search(self, search_filter: SearchFilter) -> list[Source]:
		sources: list[SearchItem] = await self._search(search_filter)
		result = []
		for source in sources:
			# Create a copy of the value without metadata
			source_data = dict(source.value)
			del source_data["metadata"]
			result.append(Source.model_validate(source_data))
		return result

	async def create(self, project_id: str, sources: list[Source]) -> list[str]:
		try:
			created_sources = []
			for source in sources:
				source.id = str(uuid4())
				source.metadata["project_id"] = project_id
				source.created_at = datetime.now()
				source.updated_at = datetime.now()
				source =await self.doc_repo.docs_from_sources(source)
				created = await self._set(key=source.id, value=source)
				if not created:
					raise Exception("Failed to create source")
				
				created_sources.append(source)
			return created_sources
		except Exception as e:
			logger.error(f"Error adding source: {e}")
			raise e
