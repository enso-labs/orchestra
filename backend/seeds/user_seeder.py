from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from src.constants import DB_URI
from src.schemas.models import User

engine = create_engine(DB_URI)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def seed_admin():
    db = SessionLocal()
    try:
        result = db.execute(select(User).filter(User.email == "admin@example.com"))
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
        db.commit()
        print("Admin user created successfully!")
    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
