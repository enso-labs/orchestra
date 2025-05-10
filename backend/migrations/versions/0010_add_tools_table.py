"""Add tools table

Revision ID: 0010
Revises: 0009
Create Date: 2025-05-09T00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0010'
down_revision: Union[str, None] = '0009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Create tools table
    op.create_table(
        'tools',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('url', sa.String(), nullable=True),
        sa.Column('spec', sa.JSON(), nullable=True),
        sa.Column('headers', sa.JSON(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('tools_user_id_idx', 'tools', ['user_id'], unique=False)
    op.create_index('tools_name_idx', 'tools', ['name'], unique=False)
    op.create_index('tools_url_idx', 'tools', ['url'], unique=False)
    # op.create_index('tools_tags_idx', 'tools', ['tags'], unique=False)
    # Create unique index on name and user_id
    op.create_index('tools_name_user_id_idx', 'tools', ['name', 'user_id'], unique=True)
    
def downgrade() -> None:
    # Drop tools table
    op.drop_table('tools')