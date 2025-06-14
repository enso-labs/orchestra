"""Add tools table (internal pk, external id)

Revision ID: 0010
Revises: 0009
Create Date: 2025-05-09 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # pgcrypto supplies digest(); install once per DB
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "tools",
        # 1️⃣ internal surrogate key
        sa.Column("pk", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        # 2️⃣ external key still named **id**
        sa.Column(
            "id",
            sa.String(),
            sa.Computed(
                "encode(digest(pk::text, 'sha256'), 'base64')",
                persisted=True,
            ),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("url", sa.String(), nullable=True),
        sa.Column("spec", sa.JSON(), nullable=True),
        sa.Column("headers", sa.JSON(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("pk"),
        sa.UniqueConstraint("id"),
    )

    # supporting indexes
    op.create_index("tools_user_id_idx", "tools", ["user_id"])
    op.create_index("tools_name_idx", "tools", ["name"])
    op.create_index("tools_url_idx", "tools", ["url"])
    op.create_index(
        "tools_name_user_id_idx", "tools", ["name", "user_id"], unique=True
    )


def downgrade() -> None:
    op.drop_table("tools")
    op.execute("DROP EXTENSION IF EXISTS pgcrypto")
