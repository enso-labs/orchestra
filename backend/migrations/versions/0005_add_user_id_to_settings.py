"""Add user_id to settings table

Revision ID: 0005_add_user_id_to_settings
Revises: 00000000000004_add_settings_table
Create Date: 2023-02-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0005_add_user_id_to_settings'
down_revision = '00000000000004_add_settings_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add user_id column to settings table
    op.add_column('settings', 
                  sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add index on user_id for faster lookups
    op.create_index('idx_settings_user_id', 'settings', ['user_id'])


def downgrade() -> None:
    # Remove index first
    op.drop_index('idx_settings_user_id')
    
    # Remove the column
    op.drop_column('settings', 'user_id') 