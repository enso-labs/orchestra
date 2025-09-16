from typing import Annotated, Literal
from fastapi import Body, HTTPException, status, Depends, APIRouter
from fastapi.responses import UJSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from src.repos.user_repo import UserRepo
from src.services.airtable import AirtableService
from src.services.oauth import OAuthService
from src.services.db import get_async_db
from src.utils.auth import verify_credentials, create_access_token
from src.utils.logger import logger
from src.schemas.models import User
from src.schemas.entities.auth import UserCreate, UserLogin, UserResponse, TokenResponse

airtable_service = AirtableService()
router = APIRouter(tags=["Auth"])


@router.post(
    "/auth/register",
    include_in_schema=False,
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        status.HTTP_201_CREATED: {
            "description": "User successfully registered",
            "content": {
                "application/json": {
                    "example": {
                        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                        "token_type": "bearer",
                        "user": {
                            "id": "123e4567-e89b-12d3-a456-426614174000",
                            "username": "johndoe",
                            "email": "john@example.com",
                            "name": "John Doe",
                        },
                    }
                }
            },
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Username or email already exists"
        },
    },
)
async def register(
    user_data: Annotated[UserCreate, Body()], db: AsyncSession = Depends(get_async_db)
):
    user_repo = UserRepo(db)
    # Check if username exists
    if await user_repo.get_by_username(user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    # Check if email exists
    if await user_repo.get_by_email(user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Create new user
    user = await user_repo.create(user_data)
    # Create user response
    user_response = UserResponse(
        id=str(user.id), username=user.username, email=user.email, name=user.name
    )
    await airtable_service.create_contact(user_response)

    # Create access token with full user object
    access_token = create_access_token(user)

    return TokenResponse(
        access_token=access_token, token_type="bearer", user=user_response
    )


@router.post(
    "/auth/login",
    response_model=TokenResponse,
    responses={
        status.HTTP_200_OK: {
            "description": "Successfully logged in",
            "content": {
                "application/json": {
                    "example": {
                        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                        "token_type": "bearer",
                        "user": {
                            "id": "123e4567-e89b-12d3-a456-426614174000",
                            "username": "johndoe",
                            "email": "john@example.com",
                            "name": "John Doe",
                        },
                    }
                }
            },
        },
        status.HTTP_401_UNAUTHORIZED: {"description": "Incorrect email or password"},
    },
)
async def login(
    credentials: UserLogin = Body(
        default=UserLogin(email="admin@example.com", password="test1234")
    ),
    db: AsyncSession = Depends(get_async_db),
):
    try:
        user_repo = UserRepo(db)
        user = await user_repo.get_by_email(credentials.email)
        if not user:
            logger.warning(f"User not found: {credentials.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Basic"},
            )

        if not User.verify_password(credentials.password, user.hashed_password):
            logger.warning(f"Incorrect password for user: {credentials.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Basic"},
            )

        # Create user response
        user_response = UserResponse(
            id=str(user.id), username=user.username, email=user.email, name=user.name
        )

        # Create access token with full user object
        access_token = create_access_token(user)
        # Update airtable with latest login

        await airtable_service.latest_login(user.email)
    except Exception as e:
        logger.exception(f"Error logging in: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

    return TokenResponse(
        access_token=access_token, token_type="bearer", user=user_response
    )


@router.get("/auth/user", tags=["Auth"])
async def read_user_details(user: User = Depends(verify_credentials)):
    return {"user": user.model_dump()}


##################################################################################################################
## OAuth2
##################################################################################################################
@router.get("/auth/{provider}", tags=["Auth"], include_in_schema=False)
async def auth(provider: Literal["github", "google", "azure"]):
    try:
        oauth_service = OAuthService(provider)
        return await oauth_service.oauth.create_authorization_url(
            redirect_uri=oauth_service.oauth.server_metadata["redirect_uri"]
        )
    except Exception as e:
        return UJSONResponse(
            content={"detail": str(e)}, status_code=status.HTTP_400_BAD_REQUEST
        )


@router.get("/auth/{provider}/callback", tags=["Auth"], include_in_schema=False)
async def auth_callback(
    provider: str, code: str, db: AsyncSession = Depends(get_async_db)
):
    try:
        # Get the user info from the OAuth provider
        oauth_service = OAuthService(provider)
        user_info = oauth_service.login(code)

        # Check if the user_info has a status code
        status_code = user_info.get("status") or None
        if status_code and int(status_code) != 200:
            raise HTTPException(
                status_code=int(status_code), detail=user_info.get("message")
            )

        user_repo = UserRepo(db)
        # Check if the user already exists
        existing_user = await user_repo.get_by_email(user_info.get("email"))
        if not existing_user:
            existing_user = await user_repo.get_by_username(user_info.get("username"))

        if existing_user:
            access_token = create_access_token(existing_user)
            # Update airtable with latest login
            try:
                await airtable_service.latest_login(existing_user.email)
            except Exception as e:
                await airtable_service.create_contact(
                    UserResponse(
                        id=str(existing_user.id),
                        username=existing_user.username,
                        email=existing_user.email,
                        name=existing_user.name,
                    )
                )

            return UJSONResponse(
                content={"access_token": access_token, "token_type": "bearer"},
                status_code=status.HTTP_200_OK,
            )

        # Create a new user instance
        new_user = User(
            full_name=user_info.get("name"),
            email=user_info.get("email"),
            username=user_info.get("username"),
            oauth_provider=provider,
            access=1,
        )
        # Add the new user to the database
        await user_repo.create(new_user)

        # Create user response
        user_response = UserResponse(
            id=str(new_user.id),
            username=new_user.username,
            email=new_user.email,
            name=user_info.get("name"),
        )
        await airtable_service.create_contact(user_response)

        access_token = create_access_token(
            {
                "sub": str(new_user.id),
                "email": new_user.email,
                "username": new_user.username,
            }
        )
        return UJSONResponse(
            content={"access_token": access_token, "token_type": "bearer"},
            status_code=status.HTTP_201_CREATED,
        )
    except HTTPException as err:
        logger.error(err.detail)
        raise
    except ValueError as e:
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(str(e))
        return UJSONResponse(
            detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
