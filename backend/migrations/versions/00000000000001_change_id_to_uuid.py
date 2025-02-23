"""Migrate users.id from integer to UUID

Revision ID: 00000000000001_change_id_to_uuid
Revises: 00000000000000_init
Create Date: 2025-02-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '00000000000001_change_id_to_uuid'
down_revision = '00000000000000_init'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure PostgreSQL's uuid-ossp extension is enabled.
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    
    # 1. Add a new UUID column with a default generator.
    op.add_column('users', sa.Column(
        'new_id',
        sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=True,
        server_default=sa.text('uuid_generate_v4()')
    ))
    
    # 2. Populate the new_id column for existing rows.
    op.execute("UPDATE users SET new_id = uuid_generate_v4() WHERE new_id IS NULL;")
    
    # 3. Drop the primary key constraint on the old integer id.
    op.drop_constraint('users_pkey', 'users', type_='primary')
    
    # 4. Drop the index on the integer id column if it exists.
    op.drop_index('ix_users_id', table_name='users')
    
    # 5. Drop the old integer id column.
    op.drop_column('users', 'id')
    
    # 6. Rename new_id to id.
    op.alter_column('users', 'new_id', new_column_name='id',
                    existing_type=sa.dialects.postgresql.UUID(as_uuid=True))
    
    # 7. Create a new primary key constraint on the new UUID id column.
    op.create_primary_key('users_pkey', 'users', ['id'])
    
    # Note: The indexes on "email" and "username" remain intact.
    

def downgrade() -> None:
    # Downgrade: revert from UUID id back to an integer id.
    # WARNING: This downgrade creates new integer IDs and cannot recover the original IDs.
    
    # 1. Drop the primary key constraint on the UUID id.
    op.drop_constraint('users_pkey', 'users', type_='primary')
    
    # 2. Rename the current id column (UUID) temporarily.
    op.alter_column('users', 'id', new_column_name='old_uuid',
                    existing_type=sa.dialects.postgresql.UUID(as_uuid=True))
    
    # 3. Add a new integer id column.
    op.add_column('users', sa.Column('id', sa.Integer(), nullable=True))
    
    # 4. Create a temporary sequence for generating integer ids.
    op.execute("CREATE SEQUENCE temp_user_id_seq OWNED BY users.id;")
    op.execute("UPDATE users SET id = nextval('temp_user_id_seq');")
    
    # 5. Alter the new integer id column to be non-nullable.
    op.alter_column('users', 'id', nullable=False)
    
    # 6. Recreate the primary key constraint on the new integer id.
    op.create_primary_key('users_pkey', 'users', ['id'])
    
    # 7. Drop the temporary sequence.
    op.execute("DROP SEQUENCE temp_user_id_seq;")
    
    # 8. Drop the old UUID column.
    op.drop_column('users', 'old_uuid')
    
    # Note: You may need to re-create the dropped index on id if required.