from langgraph.store.base import BaseStore, SearchItem
from src.services.db import get_store_in_memory
from langchain_core.documents import Document
from datetime import datetime
from uuid import uuid4
from src.utils.logger import logger
from src.repos.base_repo import BaseRepo

class DocRepo(BaseRepo):
	def __init__(self, 
		user_id: str, 
		store: BaseStore = get_store_in_memory()
	):
		self.user_id = user_id
		self.store: BaseStore = store
		super().__init__(user_id=user_id, store=store, entity_type="documents")

	def _format_docs(self, docs: list[SearchItem]) -> list[Document]:
		return [
			Document(
				page_content=doc.value["page_content"],
				metadata={**doc.value["metadata"], "score": doc.score}
			) for doc in docs
		]

	##################################################################
	## Document CRUD Methods
	##################################################################		
	async def create(self, project_id: str, source_id: str, doc: Document) -> bool:
		try:
			doc.id = str(uuid4())
			doc.metadata = self._filter({
				"project_id": project_id,
				"source_id": source_id,
			})
			doc.created_at = datetime.now()
			doc.updated_at = datetime.now()
			created = await self._set(doc_id=doc.id, doc=doc)
			if created:
				return doc.id
			else:
				raise Exception("Failed to create document")
		except Exception as e:
			logger.error(f"Error adding document: {e}")
			raise e

