"""Add agent_id to user_threads table

Revision ID: 00000000000006_alter_user_threads
Revises: 00000000000005_add_settings_table
Create Date: 2025-02-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '00000000000006_alter_user_threads'
down_revision = '00000000000005_add_settings_table'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('user_threads',
        sa.Column(
            'agent_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('agents.id', ondelete='SET NULL'),
            nullable=True
        )
    )
    op.create_index('idx_user_threads_agent_id', 'user_threads', ['agent_id'])

def downgrade() -> None:
    op.drop_index('idx_user_threads_agent_id')
    op.drop_column('user_threads', 'agent_id') 