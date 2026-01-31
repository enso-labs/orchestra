"""Add servers table for MCP server configurations

Revision ID: 0002
Revises: 0001
Create Date: 2026-01-31 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the enum type first
    servertransport = postgresql.ENUM(
        "sse", "streamable_http", name="servertransport", create_type=True
    )
    servertransport.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "servers",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column(
            "transport",
            servertransport,
            nullable=False,
            server_default="sse",
        ),
        sa.Column("config", sa.Text(), nullable=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.UniqueConstraint("user_id", "name", name="uq_servers_user_id_name"),
    )

    op.create_index("idx_servers_user_id", "servers", ["user_id"])
    op.create_index("idx_servers_slug", "servers", ["slug"])


def downgrade() -> None:
    op.drop_index("idx_servers_slug")
    op.drop_index("idx_servers_user_id")
    op.drop_table("servers")
    sa.Enum(name="servertransport").drop(op.get_bind(), checkfirst=True)
