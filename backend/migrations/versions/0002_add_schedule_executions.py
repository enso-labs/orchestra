"""Add schedule_executions table for tracking job execution history

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-14 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect as sa_inspect

# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa_inspect(bind)
    if "schedule_executions" in inspector.get_table_names():
        return

    op.create_table(
        "schedule_executions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("schedule_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("thread_id", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="scheduled"),
        sa.Column("scheduled_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_index("ix_schedule_executions_schedule_id", "schedule_executions", ["schedule_id"])
    op.create_index("ix_schedule_executions_user_id", "schedule_executions", ["user_id"])
    op.create_index("ix_schedule_executions_status", "schedule_executions", ["status"])
    op.create_index(
        "ix_schedule_executions_created_at", "schedule_executions", ["created_at"], postgresql_using="btree"
    )


def downgrade() -> None:
    op.drop_index("ix_schedule_executions_created_at")
    op.drop_index("ix_schedule_executions_status")
    op.drop_index("ix_schedule_executions_user_id")
    op.drop_index("ix_schedule_executions_schedule_id")
    op.drop_table("schedule_executions")
