import os
import httpx
from typing import Any, Dict
from pydantic import BaseModel
from src.constants import APP_ENV
from src.entities.auth import UserResponse


# from src.models import ProtectedUser
from src.utils.logger import logger

AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY")
AIRTABLE_BASE_ID = os.getenv("AIRTABLE_BASE_ID", "app6sU4AprV9uZze6")
AIRTABLE_TABLE_ID = os.getenv("AIRTABLE_TABLE_ID", "Contacts")

class AirtableUser(BaseModel):
    Name: str | None = None
    Email: str
    Phone: str | None = None
    # Message: str | None = None

class AirtableService:
    def __init__(self):
        self.api_key = AIRTABLE_API_KEY
        self.url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{AIRTABLE_TABLE_ID}"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def create_contact(self, body: UserResponse) -> Any:
        try:
            at_user = AirtableUser(
                Name=body.name,
                Email=body.email,
                # Message=f"New user registered in the app: {body.username} in {APP_ENV} @ {body.email}"
            )
            # Forward the request to Airtable
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.url,
                    json={"fields": at_user.model_dump()},
                    headers=self.headers
                )
                response.raise_for_status()  # Raise an error for bad responses
                return response.json()
        except Exception as e:
            logger.error(f"Error creating contact: {e}")
            return None

# Example usage
# Note: Make sure to call this in an async context
