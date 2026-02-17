"""User request/response schemas."""
from datetime import datetime
from pydantic import BaseModel


class UserBase(BaseModel):
    email: str | None = None
    name: str | None = None
    avatar_url: str | None = None
    is_guest: bool = False


class UserCreate(UserBase):
    id: str | None = None


class UserRead(UserBase):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
    avatar_url: str | None = None
