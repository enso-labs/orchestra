from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from src.models import Token, User
from src.utils.auth import verify_credentials, get_db
from src.constants import TOKEN_ENCRYPTION_KEY
from src.utils.logger import logger

router = APIRouter(tags=["Tokens"])

class TokenCreate(BaseModel):
    key: str
    value: str

@router.post(
    "/tokens",
    status_code=status.HTTP_201_CREATED,
    responses={
        status.HTTP_201_CREATED: {
            "description": "Token created successfully",
            "content": {
                "application/json": {
                    "example": {"message": "Token created successfully"}
                }
            }
        }
    }
)
def create_token(
    token_data: TokenCreate,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    try:
        # Encrypt the token value
        encrypted_value = Token.encrypt_value(token_data.value, TOKEN_ENCRYPTION_KEY)
        
        # Create new token
        token = Token(
            user_id=user.id,
            key=token_data.key,
            value=encrypted_value
        )
        
        # Check if token already exists
        existing_token = db.query(Token).filter_by(
            user_id=user.id,
            key=token_data.key
        ).first()
        
        if existing_token:
            # Update existing token
            existing_token.value = encrypted_value
            db.commit()
            return {"message": "Token updated successfully"}
        
        # Add new token
        db.add(token)
        db.commit()
        return {"message": "Token created successfully"}
        
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database integrity error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error creating token"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.delete(
    "/tokens/{key}",
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_200_OK: {
            "description": "Token deleted successfully",
            "content": {
                "application/json": {
                    "example": {"message": "Token deleted successfully"}
                }
            }
        }
    }
)
def delete_token(
    key: str,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    try:
        # Find and delete token
        result = db.query(Token).filter_by(
            user_id=user.id,
            key=key
        ).delete()
        
        if result == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Token not found"
            )
            
        db.commit()
        return {"message": "Token deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        ) 