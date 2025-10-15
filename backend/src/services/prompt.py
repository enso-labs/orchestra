import uuid
import asyncio
from typing import Any, Optional
from pydantic import BaseModel, computed_field, field_serializer
from datetime import datetime
from fastapi.openapi.models import Example
from langgraph.store.base import SearchItem
from langgraph.store.memory import InMemoryStore
from langgraph.store.base import BaseStore

from src.utils.format import get_time
from src.utils.logger import logger
from src.utils.format import slugify

IN_MEMORY_STORE = InMemoryStore()
STORE_KEY = "prompts"

class PromptSearch(BaseModel):
    limit: int = 500
    offset: int = 0
    sort: str = "updated_at"
    sort_order: str = "desc"
    filter: dict = {}

class Prompt(BaseModel):
    id: Optional[str] = None
    name: str
    content: str
    public: bool = False
    v: Optional[int] = None
    updated_at: Optional[datetime] = None

    @computed_field
    @property
    def slug(self) -> str:
        return slugify(self.name)
    
    @field_serializer("updated_at")
    def serialize_dt(self, dt: Optional[datetime], _):
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return dt.isoformat()
        # Assume it's already a string (e.g., loaded from db or elsewhere), return as-is
        return dt


class PromptService:
    def __init__(self, user_id: str = None, store: BaseStore = IN_MEMORY_STORE):
        self.user_id = user_id
        self.store: BaseStore = store
        
    def _get_namespace(self, prompt_id: str = "", public: bool = False):
        if public:
            return ("public", STORE_KEY, prompt_id)
        if prompt_id is None:
            return (self.user_id, STORE_KEY)
        return (self.user_id, STORE_KEY, prompt_id)
    
    async def toggle_public(self, prompt_id: str) -> bool:
        revisions = await self.list_revisions(prompt_id)
        prompt: Prompt = revisions[0] # reverse order
        prompt.public = not prompt.public
        
        prompt.updated_at = get_time()
        if prompt.public:
            await self.store.aput(
                namespace=self._get_namespace(prompt_id=prompt_id, public=True), 
                key=str(prompt.v), 
                value=prompt.model_dump()
            )
        else:
            await self.store.adelete(self._get_namespace(prompt_id, public=True), str(prompt.v))
            
        await self._update_revision(prompt_id, prompt)
        return prompt.public

    async def revision(self, prompt_id: str, data: Prompt) -> int:
        try:
            if data.v is not None:
                data.v += 1
            else:
                data.v = 1
            data.id = prompt_id
            data.updated_at = get_time()
            await self.store.aput(
                namespace=self._get_namespace(prompt_id), key=str(data.v), value=data.model_dump()
            )
            return data.v
        except Exception as e:
            logger.exception(f"Error updating {STORE_KEY} {prompt_id}: {e}")
            return False
        
    async def _update_revision(self, prompt_id: str, data: Prompt) -> Prompt:
        try:
            data.updated_at = get_time()
            await self.store.aput(
                namespace=self._get_namespace(prompt_id), key=str(data.v), value=data.model_dump()
            )
            return data
        except Exception as e:
            logger.exception(f"Error updating {STORE_KEY} {prompt_id}: {e}")
            return None

    async def list_revisions(self, prompt_id: str, limit: int = 1000, public: bool = False) -> list[Prompt]:
        revisions = await self.store.asearch(self._get_namespace(prompt_id, public), limit=limit)
        return [self._format([revision])[0] for revision in revisions]

    async def get(self, prompt_id: str, v: int = 1) -> Any:
        prompt_raw = await self.store.aget(self._get_namespace(prompt_id), v)
        if prompt_raw:
            return self._format([prompt_raw])[0]
        return None

    async def delete(self, prompt_id: str, v: int) -> bool:
        try:
            await self.store.adelete(self._get_namespace(prompt_id), str(v))
            return True
        except Exception as e:
            logger.exception(f"Error deleting {STORE_KEY} {prompt_id}: {e}")
            return False

    async def search(
        self,
        params: PromptSearch,
    ) -> list[dict]:
        try:
            prompts = []
            if isinstance(self.store, InMemoryStore):
                prompts = await self._in_memory_search(params)
            else:
                prompts = await self._postgres_search(params)
            return self._format(prompts)
        except Exception as e:
            logger.error(f"Error searching {STORE_KEY}: {e}")
            return []

    ###########################################################################
    ## Search
    ###########################################################################
    async def _in_memory_search(self, params: PromptSearch) -> list[dict]:
        items = await self.store.asearch(self._get_namespace(), limit=params.limit)
        return sorted(
            [item for item in items],
            key=lambda x: (x.updated_at, getattr(x, "v", 1)),
            reverse=True,
        )

    async def _postgres_search(self, params: PromptSearch) -> list[dict]:
        max_retries = 3
        retry_delay = 1  # seconds
        
        namespace = self._get_namespace()
        if "public" in params.filter:
            namespace = self._get_namespace(public=params.filter["public"])

        for attempt in range(max_retries):
            try:
                async with self.store as store:
                    items = await store.asearch(namespace, limit=params.limit)
                    return sorted(
                        [item for item in items],
                        key=lambda x: (x.updated_at, getattr(x, "v", 1)),
                        reverse=True,
                    )
            except Exception as e:
                error_msg = str(e).lower()
                if "connection" in error_msg and "closed" in error_msg:
                    logger.warning(
                        f"Store connection closed on attempt {attempt + 1}/{max_retries}: {e}"
                    )
                    if attempt < max_retries - 1:
                        await asyncio.sleep(
                            retry_delay * (2**attempt)
                        )  # Exponential backoff
                        continue
                raise e

    def _format(self, items: list[SearchItem]) -> list[Prompt]:
        prompts = []
        for item in items:
            prompt = Prompt(**item.dict()["value"])
            prompt.id = item.namespace[-1] # last item in namespace is the prompt id
            prompt.updated_at = item.updated_at
            prompts.append(prompt)
        return prompts


prompt_service = PromptService()

PROMPT_EXAMPLES = {
    "default_prompt": Example(
		name="Default Prompt",
        content="You are a helpful assistant.",
        public=False,
	),
    "pirate_prompt": Example(
		name="Pirate Prompt",
        content="You are a helpful assistant, that speaks like a pirate.",
        public=True,
	),
}