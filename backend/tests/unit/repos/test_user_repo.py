import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.models import Base, User, Token
from src.repos.user_repo import UserRepo
from src.constants import TOKEN_ENCRYPTION_KEY

# Create test database engine
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db_session():
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Create session
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=engine)

@pytest.fixture
def user_repo(db_session):
    return UserRepo(db_session)

@pytest.fixture
def test_user(db_session):
    user = User(
        id=uuid.uuid4(),
        username="testuser",
        email="test@example.com",
        name="Test User",
        hashed_password=User.get_password_hash("password123")
    )
    db_session.add(user)
    db_session.commit()
    return user

@pytest.fixture
def test_token(db_session, test_user):
    token = Token(
        user_id=test_user.id,
        key="github",
        value=Token.encrypt_value("test-token-value", TOKEN_ENCRYPTION_KEY)
    )
    db_session.add(token)
    db_session.commit()
    return token

class TestUserRepo:
    def test_get_by_id(self, user_repo, test_user):
        user = user_repo.get_by_id(test_user.id)
        assert user is not None
        assert user.id == test_user.id
        assert user.username == "testuser"
        assert user.email == "test@example.com"

    def test_get_by_email(self, user_repo, test_user):
        user = user_repo.get_by_email("test@example.com")
        assert user is not None
        assert user.id == test_user.id
        assert user.username == "testuser"

    def test_get_by_username(self, user_repo, test_user):
        user = user_repo.get_by_username("testuser")
        assert user is not None
        assert user.id == test_user.id
        assert user.email == "test@example.com"

    def test_get_token(self, user_repo, test_user, test_token):
        token_value = user_repo.get_token(test_user.id, "github")
        assert token_value == "test-token-value"

    def test_get_nonexistent_token(self, user_repo, test_user):
        token_value = user_repo.get_token(test_user.id, "nonexistent")
        assert token_value is None

    def test_get_all_tokens(self, user_repo, test_user, test_token):
        tokens = user_repo.get_all_tokens(test_user.id)
        assert len(tokens) == 1
        assert tokens[0]["key"] == "github"
        assert tokens[0]["value"] == "test-token-value"

    def test_create_user(self, user_repo):
        user_data = {
            "username": "newuser",
            "email": "new@example.com",
            "name": "New User",
            "hashed_password": User.get_password_hash("newpassword123")
        }
        user = user_repo.create(user_data)
        assert user is not None
        assert user.username == "newuser"
        assert user.email == "new@example.com"
        assert user.name == "New User"

    def test_update_user(self, user_repo, test_user):
        update_data = {
            "name": "Updated Name",
            "email": "updated@example.com"
        }
        updated_user = user_repo.update(test_user.id, update_data)
        assert updated_user is not None
        assert updated_user.name == "Updated Name"
        assert updated_user.email == "updated@example.com"
        assert updated_user.username == test_user.username  # Unchanged field

    def test_update_nonexistent_user(self, user_repo):
        update_data = {"name": "Updated Name"}
        updated_user = user_repo.update(uuid.uuid4(), update_data)
        assert updated_user is None

    def test_delete_user(self, user_repo, test_user):
        # First verify user exists
        assert user_repo.get_by_id(test_user.id) is not None
        
        # Delete user
        result = user_repo.delete(test_user.id)
        assert result is True
        
        # Verify user no longer exists
        assert user_repo.get_by_id(test_user.id) is None

    def test_delete_nonexistent_user(self, user_repo):
        result = user_repo.delete(uuid.uuid4())
        assert result is False

    def test_token_cascade_delete(self, user_repo, test_user, test_token, db_session):
        # First verify token exists
        assert user_repo.get_token(test_user.id, "github") is not None
        
        # Delete user
        user_repo.delete(test_user.id)
        
        # Verify token was cascade deleted
        token = db_session.query(Token).filter(
            Token.user_id == test_user.id,
            Token.key == "github"
        ).first()
        assert token is None
