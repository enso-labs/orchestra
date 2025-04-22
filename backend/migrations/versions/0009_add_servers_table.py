"""Add servers table

Revision ID: 0009
Revises: 0008_rename_user_threads
Create Date: 2023-11-01T00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0009'
down_revision: Union[str, None] = '0008_rename_user_threads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create servers table
    op.create_table(
        'servers',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('documentation', sa.Text(), nullable=True),
        sa.Column('documentation_url', sa.String(), nullable=True),
        sa.Column('public', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('servers_user_id_idx', 'servers', ['user_id'], unique=False)
    op.create_index('servers_slug_idx', 'servers', ['slug'], unique=True)
    op.create_index('servers_public_idx', 'servers', ['public'], unique=False)
    op.create_index('servers_type_idx', 'servers', ['type'], unique=False)


def downgrade() -> None:
    # Drop servers table
    op.drop_index('servers_type_idx', table_name='servers')
    op.drop_index('servers_public_idx', table_name='servers')
    op.drop_index('servers_slug_idx', table_name='servers')
    op.drop_index('servers_user_id_idx', table_name='servers')
    op.drop_table('servers') 