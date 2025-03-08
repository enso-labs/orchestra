"""Create agents table for storing agent information

Revision ID: 00000000000005_add_agents_table
Revises: 00000000000004_add_settings_table
Create Date: 2024-06-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '00000000000005_add_agents_table'
down_revision = '00000000000004_add_settings_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # First, create the agents table (without current_revision_id, which we'll add after creating the revisions table)
    op.create_table(
        'agents',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            server_default=sa.text('gen_random_uuid()'),
            primary_key=True
        ),
        sa.Column(
            'user_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False
        ),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('visibility', sa.String(), nullable=False, server_default='private'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
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
        # Create a unique constraint on slug within a user's agents
        sa.UniqueConstraint('user_id', 'slug', name='uq_user_agent_slug')
    )
    
    # Add indexes for faster lookups
    op.create_index('idx_agents_user_id', 'agents', ['user_id'])
    op.create_index('idx_agents_slug', 'agents', ['slug'])
    op.create_index('idx_agents_visibility', 'agents', ['visibility'])


def downgrade() -> None:
    op.drop_index('idx_agents_visibility')
    op.drop_index('idx_agents_slug')
    op.drop_index('idx_agents_user_id')
    op.drop_table('agents') 