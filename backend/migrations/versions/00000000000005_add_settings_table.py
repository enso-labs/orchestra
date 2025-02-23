"""Create settings table

Revision ID: 00000000000005_add_settings_table
Revises: 00000000000004_add_agents_table
Create Date: 2025-02-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '00000000000005_add_settings_table'
down_revision = '00000000000004_add_agents_table'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'settings',
        sa.Column(
            'user_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            primary_key=True
        ),
        sa.Column(
            'agent_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('agents.id', ondelete='CASCADE'),
            primary_key=True
        ),
        sa.Column('key', sa.String(), primary_key=True),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            onupdate=sa.text('now()'),
            nullable=True
        )
    )
    
    op.create_index('idx_settings_user_id', 'settings', ['user_id'])
    op.create_index('idx_settings_agent_id', 'settings', ['agent_id'])

def downgrade() -> None:
    op.drop_index('idx_settings_agent_id')
    op.drop_index('idx_settings_user_id')
    op.drop_table('settings') 