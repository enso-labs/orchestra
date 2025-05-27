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
from gotrue.errors import AuthApiError

from src.services.airtable import AirtableService
from src.services.oauth import OAuthService
from src.services.db import get_db, get_supabase_client
from src.utils.auth import AuthenticatedUser, resolve_user
from src.utils.logger import logger
from src.models import User
from src.constants import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_TOKEN_EXPIRE_MINUTES
from src.entities.auth import UserCreate, UserLogin, UserResponse, TokenResponse

airtable_service = AirtableService()
router = APIRouter(tags=["Auth"])
supabase = get_supabase_client()

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
				"application/json": {"message": f"Registration successful. Please check your [email] to confirm your account."}
			}
		},
		status.HTTP_400_BAD_REQUEST: {
			"description": "Username or email already exists"
		}
	}
)
async def register(
	user_data: Annotated[UserCreate, Body()],
):
	try:
		supabase.auth.sign_up({
			"email": user_data.email,
			"password": user_data.password,
			"options": {
				"data": {
					"username": user_data.username,
					"name": user_data.name
				}
			}
		})
  
		return JSONResponse(
			content={"message": f"Registration successful. Please check {user_data.email} to confirm your account."},
			status_code=status.HTTP_201_CREATED
		)
	except AuthApiError as e:
		logger.error(f"Error registering user: {e}")
		raise HTTPException(status_code=400, detail=e.message)
	except Exception as e:
		logger.error(f"Error registering user: {e}")
		raise HTTPException(status_code=500, detail=str(e))
	
	# # Create user response
	# user_response = UserResponse(
	# 	id=str(user.id),
	# 	username=user.username,
	# 	email=user.email,
	# 	name=user.name
	# )
	# await airtable_service.create_contact(user_response)

	# # Create access token with full user object
	# access_token = create_access_token(user)

	# return TokenResponse(
	# 	access_token=access_token,
	# 	token_type="bearer",
	# 	user=user_response
	# )

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
async def login(
	credentials: Annotated[UserLogin, Body()],
	db: Session = Depends(get_db)
):
	try:
		res = supabase.auth.sign_in_with_password({
			"email": credentials.email,
			"password": credentials.password
		})
		logger.info(f"Login success: {res.model_dump_json()}")
		return TokenResponse(
			access_token=res.session.access_token,
			refresh_token=res.session.refresh_token,
			expires_in=res.session.expires_in,
			expires_at=res.session.expires_at,
			token_type=res.session.token_type,
			user=res.user.user_metadata
		)
	except AuthApiError as e:
		logger.warning(f"Error logging in user: {e}")
		raise HTTPException(status_code=e.status, detail=e.message)
	except Exception as e:
		logger.error(f"Error logging in user: {e}")
		raise HTTPException(status_code=500, detail=str(e))
	
	
@router.get("/auth/user", tags=['Auth'])
async def read_user_details(user: AuthenticatedUser = Depends(resolve_user)):
	return {"user": user}
	
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
			# Update airtable with latest login
			try:
				await airtable_service.latest_login(existing_user.email)
			except Exception as e:
				await airtable_service.create_contact(UserResponse(
					id=str(existing_user.id),
					username=existing_user.username,
					email=existing_user.email,
					name=existing_user.name
				))
	
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
  
		# Create user response
		user_response = UserResponse(
			id=str(new_user.id),
			username=new_user.username,
			email=new_user.email,
			name=user_info.get('name')
		)
		await airtable_service.create_contact(user_response)
		
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

