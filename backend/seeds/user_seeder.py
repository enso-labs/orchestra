import argparse
import asyncio
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
from src.utils.db import get_asyncpg_connect_args, get_asyncpg_url

ASYNC_DB_URI = get_asyncpg_url(DB_URI)
engine = create_async_engine(
    ASYNC_DB_URI,
    connect_args=get_asyncpg_connect_args(DB_URI),
)
AsyncSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine)


async def seed_admin():
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(User).filter(User.email == "admin@example.com"))
            admin = result.scalar_one_or_none()
            if admin:
                print("Admin exists, skipping seeding")
                return
            admin = User(
                username="admin",
                email="admin@example.com",
                name="Admin User",
                hashed_password=User.get_password_hash("test1234"),
            )
            db.add(admin)
            await db.commit()
            print("Admin user created successfully!")
        except Exception as e:
            print(f"Error creating admin user: {e}")
            await db.rollback()


async def seed_user():
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(User).filter(User.email == "user@example.com"))
            user = result.scalar_one_or_none()
            if user:
                print("User exists, skipping seeding")
                return
            user = User(
                username="user",
                email="user@example.com",
                name="Test User",
                hashed_password=User.get_password_hash("test1234"),
            )
            db.add(user)
            await db.commit()
            print("Test user created successfully!")
        except Exception as e:
            print(f"Error creating test user: {e}")
            await db.rollback()


async def main():
    await seed_admin()
    await seed_user()


if __name__ == "__main__":
    asyncio.run(main())
