"""Create schedule_executions table

Revision ID: 0002
Revises: 0001
Create Date: 2025-02-09 00:00:00.000000

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
    op.create_table(
        "schedule_executions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("schedule_id", sa.String(), nullable=False),
        sa.Column("thread_id", sa.String(), nullable=True),
        sa.Column(
            "status", sa.String(), nullable=False, server_default="scheduled"
        ),
        sa.Column(
            "scheduled_time", sa.DateTime(timezone=True), nullable=False
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("user_id", sa.String(), nullable=False),
    )

    op.create_index(
        "idx_schedule_executions_id", "schedule_executions", ["id"]
    )
    op.create_index(
        "idx_schedule_executions_schedule_id",
        "schedule_executions",
        ["schedule_id"],
    )
    op.create_index(
        "idx_schedule_executions_user_id",
        "schedule_executions",
        ["user_id"],
    )
    op.create_index(
        "idx_schedule_executions_scheduled_time",
        "schedule_executions",
        ["scheduled_time"],
    )


def downgrade() -> None:
    op.drop_index("idx_schedule_executions_scheduled_time")
    op.drop_index("idx_schedule_executions_user_id")
    op.drop_index("idx_schedule_executions_schedule_id")
    op.drop_index("idx_schedule_executions_id")
    op.drop_table("schedule_executions")
