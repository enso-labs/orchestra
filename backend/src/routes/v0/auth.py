from typing import Annotated
from fastapi import Body, HTTPException, status, Depends, APIRouter
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
from datetime import datetime, timedelta

from src.utils.auth import get_db
from src.models import User
from src.constants import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_TOKEN_EXPIRE_MINUTES

router = APIRouter(tags=["Auth"])

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    name: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    name: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

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
def register(
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
