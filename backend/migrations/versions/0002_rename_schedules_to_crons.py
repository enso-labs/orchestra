"""Rename schedules table to crons

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-16 00:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.rename_table("schedules", "crons")
    op.execute("ALTER INDEX IF EXISTS ix_schedules_next_run_time RENAME TO ix_crons_next_run_time")


def downgrade() -> None:
    op.rename_table("crons", "schedules")
    op.execute("ALTER INDEX IF EXISTS ix_crons_next_run_time RENAME TO ix_schedules_next_run_time")
