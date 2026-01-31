import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.schemas.entities.server import ServerCreate, ServerUpdate
from src.schemas.models.server import Server
from src.utils.format import slugify
from src.utils.security import decrypt_value, encrypt_value


class ServerService:
    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id

    async def create(self, data: ServerCreate) -> Server:
        """Create a new server configuration."""
        # Check name uniqueness per user
        existing = await self._get_by_name(data.name)
        if existing:
            raise ValueError(f"Server with name '{data.name}' already exists")

        encrypted_config: Optional[str] = None
        if data.config is not None:
            encrypted_config = encrypt_value(data.config)

        server = Server(
            user_id=self.user_id,
            name=data.name,
            slug=slugify(data.name),
            url=data.url,
            transport=data.transport,
            config=encrypted_config,
        )

        self.db.add(server)
        await self.db.commit()
        await self.db.refresh(server)
        return self._decrypt_server_config(server)

    async def get_by_id(self, server_id: uuid.UUID) -> Optional[Server]:
        """Get a server by ID, scoped to the current user."""
        result = await self.db.execute(
            select(Server).filter(
                Server.id == server_id,
                Server.user_id == self.user_id,
            )
        )
        server = result.scalar_one_or_none()
        if server:
            return self._decrypt_server_config(server)
        return None

    async def list_by_user(self) -> list[Server]:
        """List all servers for the current user."""
        result = await self.db.execute(
            select(Server)
            .filter(Server.user_id == self.user_id)
            .order_by(Server.created_at.desc())
        )
        servers = result.scalars().all()
        return [self._decrypt_server_config(s) for s in servers]

    async def update(
        self, server_id: uuid.UUID, data: ServerUpdate
    ) -> Optional[Server]:
        """Update a server configuration."""
        server = await self._get_raw(server_id)
        if not server:
            return None

        # Check name uniqueness if name is being changed
        if data.name is not None and data.name != server.name:
            existing = await self._get_by_name(data.name)
            if existing:
                raise ValueError(f"Server with name '{data.name}' already exists")
            server.name = data.name
            server.slug = slugify(data.name)

        if data.url is not None:
            server.url = data.url

        if data.transport is not None:
            server.transport = data.transport

        if data.config is not None:
            server.config = encrypt_value(data.config)

        await self.db.commit()
        await self.db.refresh(server)
        return self._decrypt_server_config(server)

    async def delete(self, server_id: uuid.UUID) -> bool:
        """Delete a server configuration."""
        server = await self._get_raw(server_id)
        if not server:
            return False

        await self.db.delete(server)
        await self.db.commit()
        return True

    # ── Private helpers ──────────────────────────────────────────────

    async def _get_raw(self, server_id: uuid.UUID) -> Optional[Server]:
        """Get a server by ID without decrypting config."""
        result = await self.db.execute(
            select(Server).filter(
                Server.id == server_id,
                Server.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def _get_by_name(self, name: str) -> Optional[Server]:
        """Check if a server with the given name exists for this user."""
        result = await self.db.execute(
            select(Server).filter(
                Server.name == name,
                Server.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _decrypt_server_config(server: Server) -> Server:
        """Decrypt the config field in-place and return the server."""
        if server.config:
            try:
                decrypted = decrypt_value(server.config)
                # Store as dict on the instance for downstream use
                server._decrypted_config = decrypted  # type: ignore[attr-defined]
            except ValueError:
                server._decrypted_config = None  # type: ignore[attr-defined]
        else:
            server._decrypted_config = None  # type: ignore[attr-defined]
        return server
