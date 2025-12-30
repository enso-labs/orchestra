from typing import Optional, List
import uuid
from datetime import datetime, timezone
from src.repos.base_repo import BaseRepo
from src.schemas.entities.auth import ApiToken


class ApiTokenRepo(BaseRepo):
    def __init__(self, user_id: str, store):
        super().__init__(user_id, store, "api_tokens")

    async def create_token(self, name: str, token_hash: str, prefix: str) -> ApiToken:
        token_id = str(uuid.uuid4())
        token = ApiToken(
            id=token_id,
            name=name,
            token_hash=token_hash,
            prefix=prefix,
            user_id=self.user_id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        # Store in user namespace
        await self._set(token_id, token)

        # Store in global index for fast lookup
        # namespace=("system", "api_token_index")
        # key=token_hash
        # value={user_id, token_id}
        await self.store.aput(
            namespace=("system", "api_token_index"),
            key=token_hash,
            value={"user_id": self.user_id, "token_id": token_id},
        )
        return token

    async def get_by_hash_global(self, token_hash: str) -> Optional[ApiToken]:
        """
        Look up a token globally by its hash.
        Note: This is a bit unusual for a user-scoped repo, but we need it for auth.
        The user_id in __init__ might be ignored or irrelevant here if we use the global index.
        """
        index_item = await self.store.aget(("system", "api_token_index"), token_hash)
        if not index_item:
            return None

        data = index_item.value
        user_id = data["user_id"]
        token_id = data["token_id"]

        # Now get the actual token from user namespace
        item = await self.store.aget((user_id, "api_tokens"), token_id)
        if item:
            return self._format(item)
        return None

    async def revoke_token(self, token_id: str) -> bool:
        token = await self.get_token(token_id)
        if token:
            await self._delete(token_id)
            await self.store.adelete(("system", "api_token_index"), token.token_hash)
            return True
        return False

    async def get_token(self, token_id: str) -> Optional[ApiToken]:
        item = await self._get(token_id)
        if item:
            return self._format(item)
        return None

    async def list_tokens(self) -> List[ApiToken]:
        # List all tokens for the current user (scoped by _get_namespace)
        items = await self.store.asearch(self._get_namespace(), limit=100)
        return [self._format(item) for item in items]

    async def update_last_used(self, token_id: str):
        token = await self.get_token(token_id)
        if token:
            token.last_used_at = datetime.now(timezone.utc)
            await self._set(token_id, token)
