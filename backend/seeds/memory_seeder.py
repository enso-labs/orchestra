import argparse
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

# Parse args and load env BEFORE importing database-related modules
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", type=str, help="Path to .env file")
    args = parser.parse_args()

    if args.env_file:
        env_path = Path(args.env_file).expanduser()
        load_dotenv(env_path, override=True)
    else:
        load_dotenv()
else:
    # When imported as a module, load default .env
    load_dotenv()

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from src.constants import DB_URI
from src.schemas.models import User
from src.services.db import get_store_db
from src.utils.memory_seed import seed_default_memories

if DB_URI.startswith("postgresql+asyncpg://"):
    ASYNC_DB_URI = DB_URI
elif DB_URI.startswith("postgres://"):
    ASYNC_DB_URI = "postgresql+asyncpg://" + DB_URI[len("postgres://") :]
else:
    ASYNC_DB_URI = "postgresql+asyncpg://" + DB_URI[len("postgresql://") :]
DB_SSL_DISABLED = os.getenv("DB_SSL_DISABLED", "false").lower() in ("true", "1", "yes")
engine = create_async_engine(
    ASYNC_DB_URI,
    **({"connect_args": {"ssl": False}} if DB_SSL_DISABLED else {}),
)
AsyncSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine)


async def main() -> None:
    # Get all users
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()

    print(f"Found {len(users)} users to process")

    total_added = 0
    users_processed = 0

    async with get_store_db() as store:
        for user in users:
            try:
                added = await seed_default_memories(str(user.id), store)
                total_added += added
                users_processed += 1
                if added > 0:
                    print(f"  Added {added} memories for {user.email}")
                else:
                    print(f"  {user.email}: all defaults present")
            except Exception as e:
                print(f"  Error seeding memories for {user.email}: {e}")

    print(f"\nDone! Processed {users_processed} users, added {total_added} total memories")


if __name__ == "__main__":
    asyncio.run(main())
