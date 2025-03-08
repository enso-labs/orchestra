"""Create agent_revisions table for storing agent version history

Revision ID: 00000000000006_add_agent_revisions_table
Revises: 00000000000005_add_agents_table
Create Date: 2024-06-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '00000000000006_add_agent_revisions_table'
down_revision = '00000000000005_add_agents_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the agent_revisions table
    op.create_table(
        'agent_revisions',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            server_default=sa.text('gen_random_uuid()'),
            primary_key=True
        ),
        sa.Column(
            'agent_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('agents.id', ondelete='CASCADE'),
            nullable=False
        ),
        sa.Column(
            'settings_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('settings.id', ondelete='CASCADE'),
            nullable=False
        ),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('revision_name', sa.String(), nullable=True),
        sa.Column('change_notes', sa.Text(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False
        ),
        # Each agent should have unique version numbers
        sa.UniqueConstraint('agent_id', 'version_number', name='uq_agent_version_number')
    )
    
    # Add index for faster lookups
    op.create_index('idx_agent_revisions_agent_id', 'agent_revisions', ['agent_id'])
    
    # Now, add the current_revision_id column to the agents table
    op.add_column(
        'agents',
        sa.Column(
            'current_revision_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('agent_revisions.id', ondelete='SET NULL'),
            nullable=True
        )
    )


def downgrade() -> None:
    # First, drop the current_revision_id column from agents
    op.drop_column('agents', 'current_revision_id')
    
    # Then drop the agent_revisions table
    op.drop_index('idx_agent_revisions_agent_id')
    op.drop_table('agent_revisions') 