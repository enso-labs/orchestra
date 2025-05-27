import json
from typing import Optional
from fastapi import Request, status, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.repos.user_repo import UserRepo
from src.constants import JWT_SECRET_KEY, JWT_ALGORITHM
from src.models import User
from src.services.db import get_async_db
from src.utils.logger import logger
from src.constants import Config

security = HTTPBearer(auto_error=False)  # Make auto_error=False to not require the Authorization header

async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_async_db)
) -> Optional[User]:
    if credentials is None:
        return None
        
    try:
        return await verify_credentials(request, credentials, db)
    except HTTPException as e:
        logger.warning(f"Error resolving user: {e}")
        return None

async def verify_credentials(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_async_db) # type: ignore
) -> User:
    try:
        logger.info(f"Request: {json.dumps(request.__dict__, default=str)}")
        
        # Verify JWT token
        payload = jwt.decode(
            credentials.credentials, 
            JWT_SECRET_KEY, 
            algorithms=[JWT_ALGORITHM]
        )
        
        # Check if token has expired
        exp = payload.get("exp")
        if exp is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing expiration",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if datetime.utcnow().timestamp() > exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Extract user data from token
        user_data = payload.get("user")
        if user_data is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify user exists in database
        user = (await db.execute(select(User).filter(User.email == user_data["email"]))).scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        logger.info(f"Authenticated user: {user.id}")
        request.state.user = user.protected()
        request.state.user_repo = UserRepo(db, request.state.user.id)
        return user.protected()

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

##################################################################################################################
## Auth to resolve user object.
##################################################################################################################
"""Auth to resolve user object."""

from typing import Annotated

from fastapi import Depends
from fastapi.exceptions import HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from gotrue.types import User
from starlette.authentication import BaseUser
from supabase import create_client

security = HTTPBearer()


class AuthenticatedUser(BaseUser):
    """An authenticated user following the Starlette authentication model."""

    def __init__(self, id: str, display_name: str) -> None:
        """Initialize the AuthenticatedUser.

        Args:
            user_id: Unique identifier for the user.
            display_name: Display name for the user.
        """
        self.id = id
        self._display_name = display_name

    @property
    def is_authenticated(self) -> bool:
        """Return True if the user is authenticated."""
        return True

    @property
    def display_name(self) -> str:
        """Return the display name of the user."""
        return self._display_name

    @property
    def identity(self) -> str:
        """Return the identity of the user. This is a unique identifier."""
        return self.id


def get_current_user(authorization: str) -> User:
    """Authenticate a user by validating their JWT token against Supabase.

    This function verifies the provided JWT token by making a request to Supabase.
    It requires the SUPABASE_URL and SUPABASE_KEY environment variables to be
    properly configured.

    Args:
        authorization: JWT token string to validate

    Returns:
        User: A Supabase User object containing the authenticated user's information

    Raises:
        HTTPException: With status code 500 if Supabase configuration is missing
        HTTPException: With status code 401 if token is invalid or authentication fails
    """
    supabase = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
    response = supabase.auth.get_user(authorization)
    user = response.user

    if not user:
        raise HTTPException(status_code=401, detail="Invalid token or user not found")
    return user


def resolve_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> AuthenticatedUser | None:
    """Resolve user from the credentials."""
    if credentials.scheme != "Bearer":
        raise HTTPException(status_code=401, detail="Invalid authentication scheme")

    if not credentials.credentials:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if Config.IS_TESTING:
        if credentials.credentials in {"user1", "user2"}:
            return AuthenticatedUser(credentials.credentials, credentials.credentials)
        raise HTTPException(
            status_code=401, detail="Invalid credentials or user not found"
        )

    user = get_current_user(credentials.credentials)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return AuthenticatedUser(user.id, user.user_metadata.get("name", "User"))


# def get_optional_user(
#     # request: Request,
#     credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
#     # db: AsyncSession = Depends(get_async_db)
# ) -> Optional[User]:
#     if credentials is None:
#         return None
        
#     try:
#         return resolve_user(credentials)
#     except HTTPException as e:
#         logger.warning(f"Error resolving user: {e}")
#         return None