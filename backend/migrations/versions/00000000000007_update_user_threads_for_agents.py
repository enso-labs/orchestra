"""Update user_threads table to link with agents and revisions

Revision ID: 00000000000007_update_user_threads_for_agents
Revises: 00000000000006_add_agent_revisions_table
Create Date: 2024-06-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '00000000000007_update_user_threads_for_agents'
down_revision = '00000000000006_add_agent_revisions_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add agent_id and agent_revision_id columns to user_threads
    op.add_column(
        'user_threads',
        sa.Column(
            'agent_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('agents.id', ondelete='SET NULL'),
            nullable=True
        )
    )
    
    op.add_column(
        'user_threads',
        sa.Column(
            'agent_revision_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('agent_revisions.id', ondelete='SET NULL'),
            nullable=True
        )
    )
    
    # Add indexes for faster lookups
    op.create_index('idx_user_threads_agent_id', 'user_threads', ['agent_id'])
    op.create_index('idx_user_threads_agent_revision_id', 'user_threads', ['agent_revision_id'])


def downgrade() -> None:
    op.drop_index('idx_user_threads_agent_revision_id')
    op.drop_index('idx_user_threads_agent_id')
    op.drop_column('user_threads', 'agent_revision_id')
    op.drop_column('user_threads', 'agent_id') 