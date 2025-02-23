"""Create agents table

Revision ID: 00000000000004_add_agents_table
Revises: 00000000000003_add_tokens_table
Create Date: 2025-02-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '00000000000004_add_agents_table'
down_revision = '00000000000003_add_tokens_table'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'agents',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()")
        ),
        sa.Column(
            'owner_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False
        ),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('is_public', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('current_setting_key', sa.String(), nullable=True),
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
    
    op.create_index('idx_agents_owner_id', 'agents', ['owner_id'])

def downgrade() -> None:
    op.drop_index('idx_agents_owner_id')
    op.drop_table('agents') 