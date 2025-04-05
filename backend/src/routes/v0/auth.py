from typing import Annotated, Literal
from fastapi import Body, HTTPException, Request, status, Depends, APIRouter
from fastapi.responses import JSONResponse, UJSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
from datetime import datetime, timedelta

from src.services.airtable import AirtableService
from src.services.oauth import OAuthService
from src.services.db import get_db
from src.utils.auth import verify_credentials
from src.utils.logger import logger
from src.models import ProtectedUser, User
from src.constants import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_TOKEN_EXPIRE_MINUTES
from src.entities.auth import UserCreate, UserLogin, UserResponse, TokenResponse

router = APIRouter(tags=["Auth"])

def create_access_token(user: User, expires_delta: timedelta | None = None):
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=JWT_TOKEN_EXPIRE_MINUTES)
    
    # Create JWT payload with user data
    to_encode = {
        "user": {
            "sub": user.email,
            "user_id": str(user.id),
            "username": user.username,
            "email": user.email,
            "name": user.name
        },
        "exp": expire
    }
    
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

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
                            "name": "John Doe"
                        }
                    }
                }
            }
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Username or email already exists"
        }
    }
)
async def register(
    user_data: Annotated[UserCreate, Body()],
    db: Session = Depends(get_db)
):
    # Check if username exists
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    user = User(
        username=user_data.username,
        email=user_data.email,
        name=user_data.name,
        hashed_password=User.get_password_hash(user_data.password)
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create user response
    user_response = UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        name=user.name
    )
    airtable_service = AirtableService()
    await airtable_service.create_contact(user_response)

    # Create access token with full user object
    access_token = create_access_token(user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
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
                            "name": "John Doe"
                        }
                    }
                }
            }
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Incorrect email or password"
        }
    }
)
def login(
    credentials: Annotated[UserLogin, Body()],
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == credentials.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    
    if not User.verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Basic"},
        )

    # Create user response
    user_response = UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        name=user.name
    )

    # Create access token with full user object
    access_token = create_access_token(user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )
    
@router.get("/auth/user", tags=['Auth'])
async def read_user_details(user: User = Depends(verify_credentials)):
    return {"user": user.model_dump()}
    
##################################################################################################################
## OAuth2
##################################################################################################################
@router.get('/auth/{provider}', tags=["Auth"], include_in_schema=False)
async def auth(provider: str = Literal["github", "google", "azure"]):
	try:
		oauth_service = OAuthService(provider)
		return await oauth_service.oauth.create_authorization_url(redirect_uri=oauth_service.oauth.server_metadata['redirect_uri'])
	except Exception as e:
		return UJSONResponse(detail=str(e), status_code=status.HTTP_400_BAD_REQUEST)

@router.get("/auth/{provider}/callback", tags=['Auth'], include_in_schema=False)
async def auth_callback(provider: str, code: str, db: Session = Depends(get_db)):
	try:
		# Get the user info from the OAuth provider
		oauth_service = OAuthService(provider)
		user_info = oauth_service.login(code)
  
		# Check if the user_info has a status code
		status_code = user_info.get('status') or None
		if status_code and int(status_code) != 200:
			raise HTTPException(status_code=int(status_code), detail=user_info.get('message'))
  
		# Check if the user already exists
		existing_user = db.execute(select(User).where((User.email == user_info.get('email')) | (User.username == user_info.get('username'))))
		existing_user = existing_user.scalars().first()
		if existing_user:
			access_token = create_access_token(existing_user)
			return UJSONResponse(
				content={"access_token": access_token, "token_type": "bearer"}, 
    			status_code=status.HTTP_200_OK
       		)
			

		# Create a new user instance
		new_user = User(
			full_name=user_info.get('name'), 
			email=user_info.get('email'),
			username=user_info.get('username'),
			oauth_provider=provider,
			access=1
		)
		# Add the new user to the database
		db.add(new_user)
		await db.commit()
		await db.refresh(new_user)
		
		access_token = create_access_token({
			"sub": str(new_user.id), 
			"email": new_user.email,
			"username": new_user.username
		})
		return UJSONResponse(
			content={"access_token": access_token, "token_type": "bearer"}, 
			status_code=status.HTTP_201_CREATED
		)
	except HTTPException as err:
			logger.error(err.detail)
			raise
	except ValueError as e:
		return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
	except Exception as e:
		logger.exception(str(e))
		return UJSONResponse(detail=str(e), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

