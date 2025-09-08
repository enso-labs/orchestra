"""Rename user_threads to threads and add agent_id column

Revision ID: 0008_rename_user_threads
Revises: 0007_add_revisions_table
Create Date: 2025-02-11 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0008_rename_user_threads"
down_revision = "0007_add_revisions_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename the user_threads table to threads
    op.rename_table("user_threads", "threads")

    # Rename the index to match the new table name
    op.execute("ALTER INDEX idx_user_threads_user RENAME TO idx_threads_user")

    # Rename the primary key constraint
    op.execute(
        "ALTER TABLE threads RENAME CONSTRAINT user_threads_pkey TO threads_pkey"
    )

    # Add agent_id column
    op.add_column(
        "threads",
        sa.Column(
            "agent",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("agents.id", ondelete="CASCADE"),
            nullable=True,  # Using nullable=True to allow for existing rows
        ),
    )

    # Add index on agent_id for faster lookups
    op.create_index("idx_threads_agent", "threads", ["agent"])


def downgrade() -> None:
    # Drop the index on agent_id
    op.drop_index("idx_threads_agent")

    # Drop the agent_id column
    op.drop_column("threads", "agent")

    # Rename the primary key constraint back
    op.execute(
        "ALTER TABLE threads RENAME CONSTRAINT threads_pkey TO user_threads_pkey"
    )

    # Rename the index back to the original name
    op.execute("ALTER INDEX idx_threads_user RENAME TO idx_user_threads_user")

    # Rename the table back to user_threads
    op.rename_table("threads", "user_threads")
