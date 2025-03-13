"""Create revisions table for storing settings revisions

Revision ID: 0007_add_revisions_table
Revises: 0006_add_agents_table
Create Date: 2025-02-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0007_add_revisions_table'
down_revision = '0006_add_agents_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'revisions',
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
            'user_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False
        ),
        sa.Column(
            'settings_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('settings.id', ondelete='CASCADE'),
            nullable=False
        ),
        sa.Column('revision_number', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            onupdate=sa.text('now()'),
            nullable=False
        ),
        # Create a unique constraint for agent_id + revision_number
        sa.UniqueConstraint('agent_id', 'revision_number', name='uq_revisions_agent_revision')
    )
    
    # Add index on agent_id for faster lookups
    op.create_index('idx_revisions_agent_id', 'revisions', ['agent_id'])
    # Add index on settings_id for faster joins
    op.create_index('idx_revisions_settings_id', 'revisions', ['settings_id'])
    # Add index on revision_number for faster max/min operations
    op.create_index('idx_revisions_revision_number', 'revisions', ['revision_number'])


def downgrade() -> None:
    op.drop_index('idx_revisions_revision_number')
    op.drop_index('idx_revisions_settings_id')
    op.drop_index('idx_revisions_agent_id')
    op.drop_table('revisions') 