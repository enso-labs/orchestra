from fastapi import status, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.constants import JWT_SECRET_KEY, JWT_ALGORITHM
from src.models import User
from src.services.db import get_async_db

security = HTTPBearer()

async def verify_credentials(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_async_db) # type: ignore
) -> User:
    try:
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

        
        return user.protected()

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
