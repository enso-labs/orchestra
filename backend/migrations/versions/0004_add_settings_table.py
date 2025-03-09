"""Create settings table for storing application settings

Revision ID: 0004_add_settings_table
Revises: 0003_add_tokens_table
Create Date: 2025-02-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0004_add_settings_table'
down_revision = '0003_add_tokens_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'settings',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            server_default=sa.text('gen_random_uuid()'),
            primary_key=True
        ),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('value', sa.JSON(), nullable=False),
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
        # Create a unique constraint on slug as it's generated from name
        sa.UniqueConstraint('slug', name='uq_settings_slug')
    )
    
    # Add index on slug for faster lookups
    op.create_index('idx_settings_slug', 'settings', ['slug'])


def downgrade() -> None:
    op.drop_index('idx_settings_slug')
    op.drop_table('settings') 