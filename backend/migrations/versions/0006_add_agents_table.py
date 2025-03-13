"""Create agents table for storing agents

Revision ID: 0006_add_agents_table
Revises: 0005_add_user_id_to_settings
Create Date: 2025-02-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0006_add_agents_table'
down_revision = '0005_add_user_id_to_settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
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
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('public', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('revision_number', sa.Integer(), nullable=False),
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
        # Create a unique constraint on slug
        sa.UniqueConstraint('slug', name='uq_agents_slug'),
    )
    
    # Add index on slug for faster lookups
    op.create_index('idx_agents_slug', 'agents', ['slug'])


def downgrade() -> None:
    op.drop_index('idx_agents_slug')
    op.drop_table('agents')
    