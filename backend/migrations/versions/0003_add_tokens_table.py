"""Create tokens table for storing encrypted third party tokens

Revision ID: 0003_add_tokens_table
Revises: 0002_add_user_threads
Create Date: 2025-02-09 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0003_add_tokens_table"
down_revision = "0002_add_user_threads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tokens",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            onupdate=sa.text("now()"),
            nullable=True,
        ),
        # Create a unique constraint on user_id and key
        sa.UniqueConstraint("user_id", "key", name="uq_tokens_user_id_key"),
        # Primary key constraint
        sa.PrimaryKeyConstraint("user_id", "key", name="tokens_pkey"),
    )

    # Add index on user_id for faster lookups
    op.create_index("idx_tokens_user_id", "tokens", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_tokens_user_id")
    op.drop_table("tokens")
