"""Create PostgreSQL tables for TaskIQ distributed workers

Revision ID: 0002
Revises: 0001
Create Date: 2026-01-25 00:00:00.000000

This migration adds tables for:
- taskiq_stream_events: Stores streaming events from workers
- taskiq_abort_signals: Stores abort signals for task cancellation
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create stream events table for worker -> API streaming
    op.create_table(
        "taskiq_stream_events",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(always=True),
            primary_key=True,
        ),
        sa.Column("thread_id", sa.String(255), nullable=False, index=True),
        sa.Column("data", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("done", sa.Boolean(), default=False, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Create index for efficient querying by thread_id and id
    op.create_index(
        "idx_taskiq_stream_events_thread_id_id",
        "taskiq_stream_events",
        ["thread_id", "id"],
    )

    # Create abort signals table for task cancellation
    op.create_table(
        "taskiq_abort_signals",
        sa.Column("thread_id", sa.String(255), primary_key=True),
        sa.Column("requested_by", sa.String(255), nullable=False),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )

    # Create index for cleanup of expired signals
    op.create_index(
        "idx_taskiq_abort_signals_expires_at",
        "taskiq_abort_signals",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_taskiq_abort_signals_expires_at")
    op.drop_table("taskiq_abort_signals")
    op.drop_index("idx_taskiq_stream_events_thread_id_id")
    op.drop_table("taskiq_stream_events")
