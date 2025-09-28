from typing import Optional
from datetime import datetime, timedelta
from fastapi import Request, status, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime
from pydantic import EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.repos.user_repo import UserRepo
from src.constants import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_TOKEN_EXPIRE_MINUTES
from src.schemas.models import User
from src.services.db import get_async_db
from src.utils.logger import logger

security = HTTPBearer(
    auto_error=False
)  # Make auto_error=False to not require the Authorization header


def create_access_token(user: User, expires_delta: timedelta | None = None):
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=JWT_TOKEN_EXPIRE_MINUTES)

    # Create JWT payload with user data
    to_encode = {
        "user": {
            "sub": user.email,
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "name": user.name,
        },
        "exp": expire,
    }

    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_async_db),
) -> Optional[User]:
    if credentials is None:
        return None

    try:
        return await verify_credentials(request, credentials, db)
    except HTTPException:
        return None


async def verify_credentials(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_async_db),  # type: ignore
) -> User:
    try:
        if not credentials or not credentials.credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No credentials provided",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify JWT token
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM]
        )

        # Check if token has expired
        exp = payload.get("exp")
        if exp is None:
            logger.warning(f"Token is missing expiration: {credentials.credentials}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing expiration",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if datetime.utcnow().timestamp() > exp:
            logger.warning(f"Token has expired: {credentials.credentials}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Extract user data from token
        user_data = payload.get("user")
        if user_data is None:
            logger.warning(
                f"Token payload is missing user data: {credentials.credentials}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify user exists in database
        user_repo = UserRepo(db)
        user = await user_repo.get_by_email(user_data["email"])
        if not user:
            logger.warning(f"User not found: {user_data['email']}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        logger.info(f"Authenticated user: {user.id} {user.email}")
        user_repo.user_id = user.id
        request.state.user = user.protected()
        request.state.token = credentials.credentials
        request.state.user_repo = user_repo
        return user.protected()

    except JWTError:
        logger.exception(f"Could not validate credentials: {credentials.credentials}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
