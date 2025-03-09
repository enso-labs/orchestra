"""Create user_threads join table

Revision ID: 00000000000002_add_user_threads
Revises: 00000000000001_change_id_to_uuid
Create Date: 2025-02-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '00000000000002_add_user_threads'
down_revision = '00000000000001_change_id_to_uuid'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'user_threads',
        # The "user" column references users.id, which is a UUID.
        sa.Column(
            'user',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            primary_key=True,
            nullable=False
        ),
        # The "thread" column references threads.id.
        # Change sa.Integer to postgresql.UUID(as_uuid=True) if threads.id is a UUID.
        sa.Column(
            'thread',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False
        ),
        # Composite primary key ensures no duplicate (user, thread) pair can exist.
        sa.PrimaryKeyConstraint('user', 'thread', name='user_threads_pkey')
    )
    
    # Add index on user column for faster lookups
    op.create_index('idx_user_threads_user', 'user_threads', ['user'])

def downgrade() -> None:
    op.drop_index('idx_user_threads_user')
    op.drop_table('user_threads')
