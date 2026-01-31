import enum
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import String, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.services.db import get_db_base

Base = get_db_base()


class ServerTransport(str, enum.Enum):
    SSE = "sse"
    STREAMABLE_HTTP = "streamable_http"


class Server(Base):
    __tablename__ = "servers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        index=True,
        server_default=sa.text("uuid_generate_v4()"),
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, nullable=False, index=True)
    url: Mapped[str] = mapped_column(String, nullable=False)
    transport: Mapped[ServerTransport] = mapped_column(
        sa.Enum(
            ServerTransport,
            name="servertransport",
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=ServerTransport.SSE,
    )
    config: Mapped[str] = mapped_column(Text, nullable=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    __table_args__ = (
        sa.UniqueConstraint("user_id", "name", name="uq_servers_user_id_name"),
    )
