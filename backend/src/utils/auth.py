from typing import Optional
from datetime import datetime, timedelta, timezone
import secrets
import hashlib
from fastapi import Request, status, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWTError
from src.constants.llm import get_free_models
from src.repos.user_repo import UserRepo
from src.repos.api_token_repo import ApiTokenRepo
from src.constants import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_TOKEN_EXPIRE_MINUTES
from src.schemas.entities import LLMRequest
from src.schemas.models import User
from src.services.db import AsyncSessionLocal
from src.services.assistant import AssistantService
from src.utils.logger import logger

security = HTTPBearer(auto_error=False)  # Make auto_error=False to not require the Authorization header


def generate_api_key_str() -> str:
    return f"otk_{secrets.token_urlsafe(32)}"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(user: User, expires_delta: timedelta | None = None):
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_TOKEN_EXPIRE_MINUTES)

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


def is_authorized_model(model: str) -> bool:
    return model in get_free_models()


async def get_optional_user_from_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[User]:
    """
    Get optional user from Bearer token or API key.
    Use for GET endpoints that don't have a request body.
    Returns None if no valid credentials provided.
    """
    if credentials is None:
        # Check for API Key if no Bearer token
        api_key = request.headers.get("x-api-key")
        if api_key:
            try:
                return await verify_credentials(request, credentials)
            except HTTPException:
                pass
        return None

    try:
        return await verify_credentials(request, credentials)
    except HTTPException:
        return None


async def get_optional_user(
    request: Request,
    params: LLMRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[User]:
    if credentials is None:
        # Check for API Key if no Bearer token
        api_key = request.headers.get("x-api-key")
        if api_key:
            try:
                return await verify_credentials(request, credentials)
            except HTTPException:
                pass

        # Allow unauthenticated access for public assistants
        if params.metadata and params.metadata.assistant_id:
            store = getattr(request.app.state, "store", None)
            if store:
                assistant_service = AssistantService(user_id=None, store=store)
                public_assistant = await assistant_service.get_public(params.metadata.assistant_id)
                if public_assistant:
                    logger.info(f"Allowing unauthenticated access for public assistant: {params.metadata.assistant_id}")
                    return None

        # Empty model is allowed — the controller resolves it to DEFAULT_CHAT_MODEL
        if params.model and not is_authorized_model(params.model):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(f"Unauthorized [{params.model}]\nPlease sign in for higher limits and better models!"),
                headers={"WWW-Authenticate": "Bearer"},
            )
        return None

    try:
        return await verify_credentials(request, credentials)
    except HTTPException:
        return None


async def verify_credentials(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> User:
    # 1. Check for API Key in headers
    api_key = request.headers.get("x-api-key")
    if api_key:
        try:
            store = getattr(request.app.state, "store", None)
            if store:
                hashed = hash_token(api_key)
                # Use 'system' to look up in global index
                token_repo = ApiTokenRepo("system", store)
                token = await token_repo.get_by_hash_global(hashed)

                if token:
                    # Scope the pooled connection to the lookup itself. Holding it as a
                    # FastAPI dependency would pin it for the whole request — including
                    # an entire agent turn — and exhaust the pool. See issue #955.
                    async with AsyncSessionLocal() as db:
                        user_repo = UserRepo(db, user_id=token.user_id)
                        user = await user_repo.get_by_id()

                        if not user:
                            logger.warning(f"User {token.user_id} not found for valid token {token.id}")
                            raise HTTPException(
                                status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="User not found",
                            )

                        # Build the detached payload before the session closes
                        protected_user = user.protected()

                    # Update last used timestamp
                    user_token_repo = ApiTokenRepo(token.user_id, store)
                    await user_token_repo.update_last_used(token.id)

                    logger.info(f"Authenticated user via API Token: {protected_user.id} {protected_user.email}")
                    request.state.user = protected_user
                    request.state.token = api_key
                    return protected_user

                # If api_key provided but invalid
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid API Key",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            else:
                logger.warning("Store not available for API key verification")
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            logger.exception("Error verifying API key")
            # Fallthrough to Bearer check if API key verification failed (or maybe invalid API key should block?)
            # If x-api-key is present but invalid, we should probably reject.
            # But the logic above raises 401.

    # 2. Check Bearer Token
    try:
        if not credentials or not credentials.credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No credentials provided",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify JWT token
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

        # Check if token has expired
        exp = payload.get("exp")
        if exp is None:
            logger.warning(f"Token is missing expiration: {credentials.credentials}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing expiration",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if datetime.now(timezone.utc).timestamp() > exp:
            logger.warning(f"Token has expired: {credentials.credentials}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Extract user data from token
        user_data = payload.get("user")
        if user_data is None:
            logger.warning(f"Token payload is missing user data: {credentials.credentials}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify user exists in database. The session is scoped to this lookup only —
        # see the note on the API-key branch above and issue #955.
        async with AsyncSessionLocal() as db:
            user_repo = UserRepo(db)
            user = await user_repo.get_by_email(user_data["email"])
            if not user:
                logger.warning(f"User not found: {user_data['email']}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Build the detached payload before the session closes
            protected_user = user.protected()

        logger.info(f"Authenticated user: {protected_user.id} {protected_user.email}")
        request.state.user = protected_user
        request.state.token = credentials.credentials
        return protected_user

    except PyJWTError:
        logger.exception(f"Could not validate credentials: {credentials.credentials}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
